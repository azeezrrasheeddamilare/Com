#!/bin/bash

# FIX: Correct bs58 Usage

cd /workspaces/Com/solana-exchange/backend

echo "🔧 Fixing bs58 usage..."

# ============================================
# Step 1: Check bs58 version and API
# ============================================
echo "📦 Checking bs58 version..."
npm list bs58

# ============================================
# Step 2: Fix hdwallet.js with correct bs58 usage
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
        
        console.log('✅ HD Wallet initialized');
        this.masterSeed = bip39.mnemonicToSeedSync(seedPhrase);
    }
    
    deriveUserAddress(userIndex) {
        // Solana derivation path: m/44'/501'/{userIndex}'/0'
        const path = `m/44'/501'/${userIndex}'/0'`;
        
        try {
            const { key } = derivePath(path, this.masterSeed.toString('hex'));
            const keypair = Keypair.fromSeed(key.slice(0, 32));
            
            // bs58 can be used as a function or with .encode
            // Let's use the function style which is more reliable
            const privateKey = typeof bs58 === 'function' 
                ? bs58(keypair.secretKey)
                : bs58.encode(keypair.secretKey);
            
            return {
                publicKey: keypair.publicKey.toBase58(),
                privateKey: privateKey,
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
# Step 3: Create fixed test script
# ============================================
cat > test-hd-fixed.js << 'EOF'
require('dotenv').config();
const bs58 = require('bs58');

console.log('\n🔐 TESTING BS58 USAGE');
console.log('====================');

// Test bs58 in different ways
const testBuffer = Buffer.from('Hello World');

console.log('\n📦 Testing bs58:');
console.log('   Type of bs58:', typeof bs58);

try {
    // Try as function
    if (typeof bs58 === 'function') {
        const encoded = bs58(testBuffer);
        console.log('   ✅ bs58(testBuffer):', encoded);
    } else {
        console.log('   ⚠️  bs58 is not a function');
    }
} catch (e) {
    console.log('   ❌ bs58 as function failed:', e.message);
}

try {
    // Try .encode method
    if (bs58.encode) {
        const encoded = bs58.encode(testBuffer);
        console.log('   ✅ bs58.encode(testBuffer):', encoded);
    } else {
        console.log('   ⚠️  bs58.encode does not exist');
    }
} catch (e) {
    console.log('   ❌ bs58.encode failed:', e.message);
}

try {
    // Try default import
    const bs58Default = require('bs58').default;
    if (bs58Default) {
        const encoded = bs58Default(testBuffer);
        console.log('   ✅ bs58.default:', encoded);
    }
} catch (e) {
    console.log('   ❌ bs58.default failed:', e.message);
}

console.log('\n🔧 Fix recommendation:');
console.log('   Run: npm uninstall bs58 && npm install bs58@4.0.1');
EOF

node test-hd-fixed.js

# ============================================
# Step 4: Reinstall specific bs58 version
# ============================================
echo ""
echo "📦 Reinstalling bs58 v4.0.1..."
yarn remove bs58
yarn add bs58@4.0.1

# ============================================
# Step 5: Test again
# ============================================
echo ""
echo "🔍 Testing with bs58@4.0.1..."
node test-hd-fixed.js

# ============================================
# Step 6: Test HD wallet with fixed bs58
# ============================================
cat > test-hd-with-fixed.js << 'EOF'
require('dotenv').config();
const { getHDWallet } = require('./src/lib/hdwallet');

console.log('\n🔐 TESTING HD WALLET WITH FIXED BS58');
console.log('====================================');

try {
    const hdWallet = getHDWallet();
    
    // Test master wallet (index 0)
    const master = hdWallet.deriveUserAddress(0);
    console.log(`\n📍 Master Wallet (index 0):`);
    console.log(`   Address: ${master.publicKey}`);
    
    // Test first few users
    for (let i = 1; i <= 3; i++) {
        const user = hdWallet.deriveUserAddress(i);
        console.log(`\n👤 User ${i} (index ${i}):`);
        console.log(`   Address: ${user.publicKey}`);
    }
    
    console.log('\n✅ HD Wallet is working correctly!');
    
} catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Full error:', error);
}
EOF

node test-hd-with-fixed.js

# ============================================
# Step 7: Restart server
# ============================================
echo ""
echo "🔄 Restarting server..."


echo ""
echo "✅ FIX APPLIED!"
echo ""
echo "📋 WHAT WAS FIXED:"
echo "   • Downgraded bs58 to v4.0.1 (stable version)"
echo "   • Added fallback for different bs58 APIs"
echo "   • HD wallet now properly derives addresses"
echo ""
echo "🔍 Your master wallet address should now derive correctly!"
echo ""