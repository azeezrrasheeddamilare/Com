require('dotenv').config();
const { getHDWallet } = require('./src/lib/hdwallet');

console.log('\n🔐 TESTING HD WALLET');
console.log('===================');

try {
    const hdWallet = getHDWallet();
    
    // Master wallet (index 0)
    const master = hdWallet.deriveUserAddress(0);
    console.log(`\n📍 Master Wallet (index 0):`);
    console.log(`   Address: ${master.publicKey}`);
    console.log(`   Path:    ${master.path}`);
    
    // Generate first 5 user addresses
    console.log(`\n👤 First 5 User Deposit Addresses:`);
    for (let i = 1; i <= 5; i++) {
        const user = hdWallet.deriveUserAddress(i);
        console.log(`   User ${i}: ${user.publicKey}`);
    }
    
    console.log(`\n✅ HD Wallet is working correctly!`);
    
} catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n⚠️  Make sure .env has the correct MASTER_WALLET_MNEMONIC');
}
