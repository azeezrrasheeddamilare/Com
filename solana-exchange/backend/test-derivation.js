require('dotenv').config();
const { getHDWallet } = require('./src/lib/hdwallet');

try {
    const hdWallet = getHDWallet();
    
    // Master wallet (index 0)
    const master = hdWallet.deriveUserAddress(0);
    console.log(`\n📍 Master Wallet (index 0):`);
    console.log(`   Address: ${master.publicKey}`);
    
    // Generate first 5 user addresses
    console.log(`\n👤 First 5 User Deposit Addresses:`);
    for (let i = 1; i <= 5; i++) {
        const user = hdWallet.deriveUserAddress(i);
        console.log(`   User ${i}: ${user.publicKey}`);
    }
    
    console.log(`\n✅ HD Wallet test passed!`);
    
} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}
