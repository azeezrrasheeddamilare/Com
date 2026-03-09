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
