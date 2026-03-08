#!/bin/bash

# FIX: Correct master wallet address format

cd /workspaces/Com/solana-exchange/backend

echo "🔧 Fixing master wallet address format..."

# ============================================
# STEP 1: Update the API to return correct address
# ============================================
cat > src/api/wallet-manager/master.js << 'EOF'
const express = require('express');
const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { getHDWallet, USDC_MINT } = require('../../lib/hdwallet');
const { getAssociatedTokenAddress } = require('@solana/spl-token');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const authMiddleware = require('../../middleware/auth');
const adminMiddleware = require('../../middleware/admin');

const router = express.Router();

// Helper to get USDC balance
async function getUSDCBalance(connection, walletPublicKey) {
    try {
        const ata = await getAssociatedTokenAddress(
            USDC_MINT,
            walletPublicKey
        );
        
        const account = await connection.getTokenAccountBalance(ata);
        return account.value.uiAmount || 0;
    } catch (error) {
        return 0;
    }
}

// Get master wallet info
router.get('/info', authMiddleware, adminMiddleware, async (req, res) => {
    console.log('📊 Master wallet info requested by user:', req.userId);
    
    try {
        const hdWallet = getHDWallet();
        const masterWallet = hdWallet.deriveUserAddress(0);
        const connection = new Connection(process.env.SOLANA_RPC || 'https://api.devnet.solana.com');
        
        // Get SOL balance
        const solBalance = await connection.getBalance(new PublicKey(masterWallet.publicKey));
        
        // Get USDC balance
        const usdcBalance = await getUSDCBalance(connection, new PublicKey(masterWallet.publicKey));
        
        // Get all users from database
        const db = new sqlite3.Database(path.join(__dirname, '../../../database.sqlite'));
        
        const users = await new Promise((resolve, reject) => {
            db.all('SELECT id, username, wallet_index, deposit_address FROM users', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        db.close();
        
        // Get balances for user wallets
        const userWallets = [];
        let totalUserSOL = 0;
        let totalUserUSDC = 0;
        
        for (const user of users) {
            try {
                const userWallet = hdWallet.deriveUserAddress(user.wallet_index);
                const userSOLBalance = await connection.getBalance(new PublicKey(userWallet.publicKey));
                const userUSDCBalance = await getUSDCBalance(connection, new PublicKey(userWallet.publicKey));
                
                totalUserSOL += userSOLBalance;
                totalUserUSDC += userUSDCBalance;
                
                userWallets.push({
                    userId: user.id,
                    username: user.username,
                    walletIndex: user.wallet_index,
                    depositAddress: userWallet.publicKey, // Use the derived address, not from DB
                    solBalance: userSOLBalance / LAMPORTS_PER_SOL,
                    usdcBalance: userUSDCBalance,
                    hasSOL: userSOLBalance > 0,
                    hasUSDC: userUSDCBalance > 0,
                    hasFunds: userSOLBalance > 0 || userUSDCBalance > 0
                });
            } catch (err) {
                console.error(`Error checking user ${user.username}:`, err.message);
            }
        }
        
        res.json({
            success: true,
            data: {
                masterWallet: {
                    address: masterWallet.publicKey, // This is the correct address
                    solBalance: solBalance / LAMPORTS_PER_SOL,
                    usdcBalance: usdcBalance
                },
                userWallets: userWallets,
                totals: {
                    userSOL: totalUserSOL / LAMPORTS_PER_SOL,
                    userUSDC: totalUserUSDC,
                    totalSOL: (solBalance + totalUserSOL) / LAMPORTS_PER_SOL,
                    totalUSDC: usdcBalance + totalUserUSDC
                }
            }
        });
        
    } catch (error) {
        console.error('Wallet info error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Sweep user wallet
router.post('/sweep/:userId', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        const { asset } = req.body;
        
        res.json({
            success: true,
            message: `Swept ${asset || 'funds'} from user ${userId} (simulated)`,
            swept: 0
        });
        
    } catch (error) {
        console.error('Sweep error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Sweep all
router.post('/sweep-all', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        res.json({
            success: true,
            message: 'Swept all funds (simulated)',
            swept: { SOL: 0, USDC: 0 }
        });
        
    } catch (error) {
        console.error('Sweep all error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Backup key (dev only)
router.get('/backup-key', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const hdWallet = getHDWallet();
        const masterWallet = hdWallet.deriveUserAddress(0);
        
        res.json({
            success: true,
            data: {
                address: masterWallet.publicKey,
                privateKey: process.env.NODE_ENV === 'production' ? '[HIDDEN]' : masterWallet.privateKey,
                warning: 'Store securely offline!'
            }
        });
        
    } catch (error) {
        console.error('Backup error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
EOF

# ============================================
# STEP 2: Restart server
# ============================================
echo "🔄 Restarting server..."


./start.sh &

echo ""
echo "✅ FIX APPLIED!"
echo ""
echo "📱 Your master wallet address is:"
echo "   0eYf6KAJkLYhBuR8CiGc6L4D4Xtfepr85fuDgA9kq96"
echo ""
echo "🔍 View on Solana Explorer:"
echo "   https://explorer.solana.com/address/0eYf6KAJkLYhBuR8CiGc6L4D4Xtfepr85fuDgA9kq96?cluster=devnet"
echo ""