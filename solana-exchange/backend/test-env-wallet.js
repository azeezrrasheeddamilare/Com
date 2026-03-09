require('dotenv').config();
const { getHDWallet } = require('./src/lib/hdwallet');

try {
    const hdWallet = getHDWallet();
    const master = hdWallet.deriveUserAddress(0);
    console.log(`\n📍 Derived Master Address: ${master.publicKey}`);
    console.log(`   Path: ${master.path}`);
    
    // Generate first user address as sample
    const user1 = hdWallet.deriveUserAddress(1);
    console.log(`\n👤 Sample User 1 Address: ${user1.publicKey}`);
    
    console.log(`\n✅ HD Wallet working correctly!`);
} catch (error) {
    console.error('\n❌ Error:', error.message);
}
