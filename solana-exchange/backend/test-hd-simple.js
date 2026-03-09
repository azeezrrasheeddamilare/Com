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
