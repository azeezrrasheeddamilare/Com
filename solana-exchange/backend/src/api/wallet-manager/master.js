const express = require('express');
const { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram } = require('@solana/web3.js');
const { getAssociatedTokenAddress, createTransferInstruction, getOrCreateAssociatedTokenAccount } = require('@solana/spl-token');
const { getHDWallet, USDC_MINT } = require('../../lib/hdwallet');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const authMiddleware = require('../../middleware/auth');
const adminMiddleware = require('../../middleware/admin');

const router = express.Router();

// Rent exemption amount (minimum balance to keep account alive)
const RENT_EXEMPTION = 890880; // lamports (~0.00089 SOL)
const TX_FEE = 5000; // lamports (0.000005 SOL) - standard transaction fee

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

// Helper to get USDC token account
async function getUSDCTokenAccount(connection, walletPublicKey) {
    try {
        const ata = await getAssociatedTokenAddress(
            USDC_MINT,
            walletPublicKey
        );
        return ata;
    } catch (error) {
        return null;
    }
}

// Get master wallet info
router.get('/info', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const hdWallet = getHDWallet();
        const masterWallet = hdWallet.deriveUserAddress(0);
        const connection = new Connection(process.env.SOLANA_RPC || 'https://api.devnet.solana.com');
        
        const solBalance = await connection.getBalance(new PublicKey(masterWallet.publicKey));
        const usdcBalance = await getUSDCBalance(connection, new PublicKey(masterWallet.publicKey));
        
        const db = new sqlite3.Database(path.join(__dirname, '../../../database.sqlite'));
        
        const users = await new Promise((resolve, reject) => {
            db.all('SELECT id, username, wallet_index, deposit_address FROM users', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        db.close();
        
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
                
                // Calculate sweepable amount (leave rent exemption + fee)
                const requiredMinimum = RENT_EXEMPTION + TX_FEE;
                const sweepableSOL = userSOLBalance > requiredMinimum ? (userSOLBalance - requiredMinimum) / LAMPORTS_PER_SOL : 0;
                
                userWallets.push({
                    userId: user.id,
                    username: user.username,
                    walletIndex: user.wallet_index,
                    depositAddress: userWallet.publicKey,
                    solBalance: userSOLBalance / LAMPORTS_PER_SOL,
                    sweepableSOL: sweepableSOL,
                    requiredMinimum: requiredMinimum / LAMPORTS_PER_SOL,
                    usdcBalance: userUSDCBalance,
                    hasSOL: userSOLBalance > requiredMinimum,
                    hasUSDC: userUSDCBalance > 0,
                    hasFunds: userSOLBalance > requiredMinimum || userUSDCBalance > 0
                });
            } catch (err) {
                console.error(`Error checking user ${user.username}:`, err.message);
            }
        }
        
        res.json({
            success: true,
            data: {
                masterWallet: {
                    address: masterWallet.publicKey,
                    solBalance: solBalance / LAMPORTS_PER_SOL,
                    sweepableSOL: solBalance > (RENT_EXEMPTION + TX_FEE) ? (solBalance - RENT_EXEMPTION - TX_FEE) / LAMPORTS_PER_SOL : 0,
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

// ============================================
// FIXED SWEEP FUNCTION - Includes transaction fee
// ============================================
router.post('/sweep/:userId', authMiddleware, adminMiddleware, async (req, res) => {
    const db = new sqlite3.Database(path.join(__dirname, '../../../database.sqlite'));
    
    try {
        const { userId } = req.params;
        const { asset } = req.body; // 'SOL' or 'USDC'
        
        console.log(`💰 Sweeping ${asset || 'funds'} for user ${userId}`);
        
        // Get user info
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        const hdWallet = getHDWallet();
        const masterWallet = hdWallet.deriveUserAddress(0);
        const userWallet = hdWallet.deriveUserAddress(user.wallet_index);
        
        const connection = new Connection(process.env.SOLANA_RPC || 'https://api.devnet.solana.com');
        
        let sweptAmount = 0;
        let message = '';
        let signature = '';
        
        // ===== SWEEP SOL =====
        if (asset === 'SOL' || !asset) {
            const solBalance = await connection.getBalance(new PublicKey(userWallet.publicKey));
            
            console.log(`   User ${user.username} balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);
            console.log(`   Rent exemption: ${RENT_EXEMPTION / LAMPORTS_PER_SOL} SOL`);
            console.log(`   Transaction fee: ${TX_FEE / LAMPORTS_PER_SOL} SOL`);
            
            // Calculate sweepable amount (leave rent exemption + fee)
            const requiredMinimum = RENT_EXEMPTION + TX_FEE;
            const requiredMinimumSOL = requiredMinimum / LAMPORTS_PER_SOL;
            
            if (solBalance <= requiredMinimum) {
                console.log(`   ⚠️  No sweepable SOL - need > ${requiredMinimumSOL} SOL (have ${solBalance / LAMPORTS_PER_SOL} SOL)`);
            } else {
                const sweepableAmount = solBalance - requiredMinimum;
                const sweepableSOL = sweepableAmount / LAMPORTS_PER_SOL;
                
                console.log(`   ✅ Sweepable: ${sweepableSOL.toFixed(6)} SOL`);
                console.log(`   (Leaving ${requiredMinimumSOL} SOL for rent + fee)`);
                
                // Create and send transaction
                const transaction = new Transaction().add(
                    SystemProgram.transfer({
                        fromPubkey: new PublicKey(userWallet.publicKey),
                        toPubkey: new PublicKey(masterWallet.publicKey),
                        lamports: sweepableAmount
                    })
                );
                
                // Get recent blockhash
                const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
                transaction.recentBlockhash = blockhash;
                transaction.feePayer = new PublicKey(userWallet.publicKey);
                transaction.lastValidBlockHeight = lastValidBlockHeight;
                
                // Sign with user's private key
                transaction.sign(userWallet.keypair);
                
                // Send transaction
                signature = await connection.sendTransaction(transaction, [userWallet.keypair]);
                await connection.confirmTransaction(signature);
                
                sweptAmount = sweepableSOL;
                message += `${sweptAmount.toFixed(6)} SOL `;
                
                console.log(`   ✅ Swept ${sweptAmount.toFixed(6)} SOL - Tx: ${signature}`);
            }
        }
        
        // ===== SWEEP USDC =====
        if (asset === 'USDC' || !asset) {
            const usdcBalance = await getUSDCBalance(connection, new PublicKey(userWallet.publicKey));
            
            if (usdcBalance > 0) {
                console.log(`   Sweeping ${usdcBalance} USDC from ${user.username}`);
                
                // Get token accounts
                const fromATA = await getUSDCTokenAccount(connection, new PublicKey(userWallet.publicKey));
                const toATA = await getUSDCTokenAccount(connection, new PublicKey(masterWallet.publicKey));
                
                const transaction = new Transaction().add(
                    createTransferInstruction(
                        fromATA,
                        toATA,
                        new PublicKey(userWallet.publicKey),
                        usdcBalance * 1_000_000 // USDC has 6 decimals
                    )
                );
                
                // Get recent blockhash
                const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
                transaction.recentBlockhash = blockhash;
                transaction.feePayer = new PublicKey(userWallet.publicKey);
                transaction.lastValidBlockHeight = lastValidBlockHeight;
                
                // Sign with user's private key
                transaction.sign(userWallet.keypair);
                
                // Send transaction
                const usdcSignature = await connection.sendTransaction(transaction, [userWallet.keypair]);
                await connection.confirmTransaction(usdcSignature);
                
                sweptAmount = usdcBalance;
                message += `${usdcBalance} USDC `;
                signature = usdcSignature;
                
                console.log(`   ✅ Swept ${usdcBalance} USDC - Tx: ${usdcSignature}`);
            }
        }
        
        if (!sweptAmount) {
            return res.json({
                success: true,
                message: `No sweepable funds from ${user.username} (need > ${(RENT_EXEMPTION + TX_FEE) / LAMPORTS_PER_SOL} SOL for rent + fee)`,
                swept: 0
            });
        }
        
        res.json({
            success: true,
            message: `✅ Swept ${message}from ${user.username}`,
            swept: sweptAmount,
            signature: signature,
            fromAddress: userWallet.publicKey,
            toAddress: masterWallet.publicKey,
            explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`
        });
        
    } catch (error) {
        console.error('❌ Sweep error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            details: error.toString()
        });
    } finally {
        db.close();
    }
});

// ============================================
// WITHDRAW FUNCTION (updated with fee)
// ============================================
router.post('/withdraw', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { toAddress, asset, amount } = req.body;
        
        console.log(`💸 Withdrawing ${amount} ${asset} to ${toAddress}`);
        
        // Validate address
        let toPubkey;
        try {
            toPubkey = new PublicKey(toAddress);
        } catch (err) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid destination address' 
            });
        }
        
        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid amount' });
        }
        
        if (asset !== 'SOL') {
            return res.status(400).json({ success: false, error: 'Only SOL withdrawals supported' });
        }
        
        const hdWallet = getHDWallet();
        const masterWallet = hdWallet.deriveUserAddress(0);
        const connection = new Connection(process.env.SOLANA_RPC || 'https://api.devnet.solana.com');
        
        const fromKeypair = masterWallet.keypair;
        const fromPubkey = fromKeypair.publicKey;
        
        const balance = await connection.getBalance(fromPubkey);
        const amountLamports = Math.floor(amount * LAMPORTS_PER_SOL);
        
        // For withdrawals, we need to leave rent + fee in the master wallet
        const requiredMinimum = RENT_EXEMPTION + TX_FEE;
        const maxWithdrawable = balance - requiredMinimum;
        
        console.log(`   Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
        console.log(`   Required minimum: ${requiredMinimum / LAMPORTS_PER_SOL} SOL (rent + fee)`);
        console.log(`   Max withdrawable: ${maxWithdrawable / LAMPORTS_PER_SOL} SOL`);
        
        if (maxWithdrawable < amountLamports) {
            return res.status(400).json({ 
                success: false, 
                error: `Max withdrawable: ${(maxWithdrawable / LAMPORTS_PER_SOL).toFixed(6)} SOL (need to leave ${requiredMinimum / LAMPORTS_PER_SOL} SOL)` 
            });
        }
        
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey,
                toPubkey,
                lamports: amountLamports
            })
        );
        
        const { blockhash } = await connection.getLatestBlockhash('finalized');
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fromPubkey;
        transaction.sign(fromKeypair);
        
        const signature = await connection.sendTransaction(transaction, [fromKeypair]);
        await connection.confirmTransaction(signature, 'confirmed');
        
        res.json({
            success: true,
            message: `✅ Withdrawn ${amount} SOL`,
            signature,
            explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`
        });
        
    } catch (error) {
        console.error('❌ Withdrawal error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// SWEEP ALL USERS
router.post('/sweep-all', authMiddleware, adminMiddleware, async (req, res) => {
    const db = new sqlite3.Database(path.join(__dirname, '../../../database.sqlite'));
    
    try {
        const users = await new Promise((resolve, reject) => {
            db.all('SELECT id, username, wallet_index FROM users', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        const hdWallet = getHDWallet();
        const masterWallet = hdWallet.deriveUserAddress(0);
        const connection = new Connection(process.env.SOLANA_RPC || 'https://api.devnet.solana.com');
        
        const results = [];
        let totalSOLSwept = 0;
        let totalUSDCSwept = 0;
        
        for (const user of users) {
            try {
                const userWallet = hdWallet.deriveUserAddress(user.wallet_index);
                
                // Check SOL
                const solBalance = await connection.getBalance(new PublicKey(userWallet.publicKey));
                const requiredMinimum = RENT_EXEMPTION + TX_FEE;
                
                if (solBalance > requiredMinimum) {
                    const sweepableAmount = solBalance - requiredMinimum;
                    const sweepableSOL = sweepableAmount / LAMPORTS_PER_SOL;
                    
                    console.log(`   Sweeping ${sweepableSOL.toFixed(6)} SOL from ${user.username}`);
                    
                    const transaction = new Transaction().add(
                        SystemProgram.transfer({
                            fromPubkey: new PublicKey(userWallet.publicKey),
                            toPubkey: new PublicKey(masterWallet.publicKey),
                            lamports: sweepableAmount
                        })
                    );
                    
                    const { blockhash } = await connection.getLatestBlockhash();
                    transaction.recentBlockhash = blockhash;
                    transaction.feePayer = new PublicKey(userWallet.publicKey);
                    transaction.sign(userWallet.keypair);
                    
                    const signature = await connection.sendTransaction(transaction, [userWallet.keypair]);
                    await connection.confirmTransaction(signature);
                    
                    totalSOLSwept += sweepableSOL;
                    results.push({
                        username: user.username,
                        asset: 'SOL',
                        amount: sweepableSOL,
                        signature: signature
                    });
                }
                
            } catch (err) {
                console.error(`Error sweeping ${user.username}:`, err.message);
            }
        }
        
        res.json({
            success: true,
            message: `✅ Swept ${totalSOLSwept.toFixed(6)} SOL from ${results.length} wallets`,
            swept: totalSOLSwept,
            results
        });
        
    } catch (error) {
        console.error('Sweep all error:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        db.close();
    }
});

// BACKUP KEY
router.get('/backup-key', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const hdWallet = getHDWallet();
        const masterWallet = hdWallet.deriveUserAddress(0);
        
        res.json({
            success: true,
            data: {
                address: masterWallet.publicKey,
                privateKey: process.env.NODE_ENV === 'production' ? '[HIDDEN]' : masterWallet.privateKey,
                warning: 'Store securely offline! Never share!'
            }
        });
        
    } catch (error) {
        console.error('Backup error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
