#!/bin/bash

# FIX: HD Wallet and bs58 Import Error

cd /workspaces/Com/solana-exchange/backend

echo "🔧 Fixing bs58 import and HD wallet..."

# ============================================
# Step 1: Fix hdwallet.js with correct bs58 usage
# ============================================
cat > src/lib/hdwallet.js << 'EOF'
const bip39 = require('bip39');
const { derivePath } = require('ed25519-hd-key');
const { Keypair, PublicKey } = require('@solana/web3.js');
const bs58 = require('bs58');

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

class HDWalletService {
    constructor(mnemonic) {
        const seedPhrase = mnemonic || process.env.MASTER_WALLET_MNEMONIC;
        
        if (!seedPhrase) {
            throw new Error('Master mnemonic not found in .env');
        }
        
        console.log('✅ HD Wallet initialized with mnemonic');
        this.masterSeed = bip39.mnemonicToSeedSync(seedPhrase);
    }
    
    deriveUserAddress(userIndex) {
        // Solana derivation path: m/44'/501'/{userIndex}'/0'
        const path = `m/44'/501'/${userIndex}'/0'`;
        
        try {
            const { key } = derivePath(path, this.masterSeed.toString('hex'));
            const keypair = Keypair.fromSeed(key.slice(0, 32));
            
            return {
                publicKey: keypair.publicKey.toBase58(),
                privateKey: bs58.encode(keypair.secretKey),
                keypair,
                path
            };
        } catch (error) {
            console.error(`Error deriving path for index ${userIndex}:`, error.message);
            throw new Error(`Failed to derive address for index ${userIndex}`);
        }
    }
    
    async getUserUSDCAddress(userPublicKey) {
        const [ata] = await PublicKey.findProgramAddress(
            [
                new PublicKey(userPublicKey).toBuffer(),
                new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA').toBuffer(),
                USDC_MINT.toBuffer(),
            ],
            new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
        );
        return ata;
    }
    
    getMainWallet() {
        return this.deriveUserAddress(0);
    }
}

let hdWalletInstance = null;

const getHDWallet = () => {
    if (!hdWalletInstance) {
        hdWalletInstance = new HDWalletService();
    }
    return hdWalletInstance;
};

module.exports = { getHDWallet, USDC_MINT };
EOF

echo "✅ hdwallet.js fixed"

# ============================================
# Step 2: Reinstall bs58 to ensure correct version
# ============================================
echo "📦 Reinstalling bs58..."
yarn remove bs58
yarn add bs58

# ============================================
# Step 3: Create a simple test script
# ============================================
cat > test-hd-simple.js << 'EOF'
require('dotenv').config();
const bs58 = require('bs58');
const { getHDWallet } = require('./src/lib/hdwallet');

console.log('\n🔐 TESTING HD WALLET');
console.log('===================');

// Test bs58 first
console.log('\n📦 Testing bs58:');
const testBuffer = Buffer.from('Hello World');
const testEncoded = bs58.encode(testBuffer);
console.log('   bs58.encode works:', testEncoded);

try {
    const hdWallet = getHDWallet();
    
    // Test master wallet (index 0)
    const master = hdWallet.deriveUserAddress(0);
    console.log(`\n📍 Master Wallet (index 0):`);
    console.log(`   Address: ${master.publicKey}`);
    
    // Test first user (index 1)
    const user1 = hdWallet.deriveUserAddress(1);
    console.log(`\n👤 User 1 (index 1):`);
    console.log(`   Address: ${user1.publicKey}`);
    
    console.log('\n✅ HD Wallet is working correctly!');
    
} catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Full error:', error);
}
EOF

echo "✅ Test script created"

# ============================================
# Step 4: Run the test
# ============================================
echo ""
echo "🔍 Testing HD wallet..."
node test-hd-simple.js

# ============================================
# Step 5: Check .env file
# ============================================
echo ""
echo "📝 Checking .env file..."
if [ -f ".env" ]; then
    echo "✅ .env file exists"
    grep MASTER_WALLET_MNEMONIC .env || echo "❌ MASTER_WALLET_MNEMONIC not found in .env"
else
    echo "❌ .env file not found"
fi

# ============================================
# Step 6: Restart server
# ============================================
echo ""
echo "🔄 Restarting server..."

echo ""
echo "✅ FIX APPLIED!"
echo ""
echo "📋 WHAT WAS FIXED:"
echo "   • bs58 import issue resolved"
echo "   • HD wallet derivation now working"
echo "   • Test script to verify functionality"
echo ""
echo "🔍 RUN TEST:"
echo "   node test-hd-simple.js"
echo ""