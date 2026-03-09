require('dotenv').config();
const { getHDWallet } = require('./src/lib/hdwallet');
const { Keypair } = require('@solana/web3.js');
const fs = require('fs');

try {
    const hdWallet = getHDWallet();
    const master = hdWallet.deriveUserAddress(0);
    
    // Read the keypair file
    const keypairData = JSON.parse(fs.readFileSync('keys/master-wallet.json', 'utf8'));
    const fileKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
    
    console.log(`\n📍 HD Wallet Master: ${master.publicKey}`);
    console.log(`📍 File Keypair:     ${fileKeypair.publicKey.toBase58()}`);
    
    if (master.publicKey === fileKeypair.publicKey.toBase58()) {
        console.log(`\n✅✅✅ PERFECT! They match! ✅✅✅`);
    } else {
        console.log(`\n❌ They don't match! This shouldn't happen.`);
    }
    
    // Generate user addresses
    console.log(`\n👤 User Deposit Addresses:`);
    for (let i = 1; i <= 5; i++) {
        const user = hdWallet.deriveUserAddress(i);
        console.log(`   User ${i}: ${user.publicKey}`);
    }
    
} catch (error) {
    console.error('Error:', error.message);
}
