require('dotenv').config();
const { Connection, PublicKey, LAMPORTS_PER_SOL, Keypair } = require('@solana/web3.js');
const { getHDWallet } = require('./src/lib/hdwallet');

async function testDeposit() {
    console.log('\n💰 TEST DEPOSIT SIMULATOR');
    console.log('=========================');
    
    const hdWallet = getHDWallet();
    const connection = new Connection(process.env.SOLANA_RPC || 'https://api.devnet.solana.com');
    
    // Show user addresses
    console.log('\n📋 User Deposit Addresses (from HD wallet):');
    for (let i = 1; i <= 3; i++) {
        const user = hdWallet.deriveUserAddress(i);
        const balance = await connection.getBalance(new PublicKey(user.publicKey));
        console.log(`   User ${i}: ${user.publicKey}`);
        console.log(`   Balance: ${balance / 1e9} SOL\n`);
    }
    
    console.log('\n📝 To test deposits:');
    console.log('   1. Get test SOL from: https://solfaucet.com');
    console.log('   2. Send to any user address above');
    console.log('   3. Watch the deposit monitor logs');
    console.log('\n   The deposit monitor will detect it within 10-30 seconds!');
}

testDeposit().catch(console.error);
