require('dotenv').config();
const { getHDWallet } = require('./src/lib/hdwallet');
const { Connection, PublicKey } = require('@solana/web3.js');

async function testWallet() {
    console.log('\n🔐 TESTING NEW HD WALLET');
    console.log('=======================');
    
    try {
        const hdWallet = getHDWallet();
        
        // Master wallet (index 0)
        const master = hdWallet.deriveUserAddress(0);
        console.log(`\n📍 Master Wallet (index 0):`);
        console.log(`   Address: ${master.publicKey}`);
        
        // Check if this matches our expected address
        const expectedMaster = '${NEW_MASTER_PUBKEY}';
        if (master.publicKey === expectedMaster) {
            console.log(`   ✅ Matches expected master address`);
        } else {
            console.log(`   ❌ MISMATCH! Expected: ${expectedMaster}`);
            console.log(`            Got: ${master.publicKey}`);
            console.log(`   Check your .env MASTER_WALLET_MNEMONIC`);
        }
        
        // Generate first 3 user addresses
        console.log(`\n👤 First 3 User Deposit Addresses:`);
        for (let i = 1; i <= 3; i++) {
            const user = hdWallet.deriveUserAddress(i);
            console.log(`   User ${i}: ${user.publicKey}`);
        }
        
        // Check balances
        console.log(`\n💰 Checking balances on devnet...`);
        const connection = new Connection(process.env.SOLANA_RPC);
        
        const masterBalance = await connection.getBalance(new PublicKey(master.publicKey));
        console.log(`   Master balance: ${masterBalance / 1e9} SOL`);
        
        if (masterBalance === 0) {
            console.log(`\n⚠️  Master wallet has 0 SOL. Get test SOL from:`);
            console.log(`   https://solfaucet.com`);
            console.log(`   Send to: ${master.publicKey}`);
        }
        
        console.log(`\n✅ HD Wallet test complete!`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testWallet();
