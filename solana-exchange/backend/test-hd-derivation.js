require('dotenv').config();
const { getHDWallet } = require('./src/lib/hdwallet');

console.log('\n🔐 TESTING HD WALLET DERIVATION');
console.log('==============================');

try {
    const hdWallet = getHDWallet();
    
    // Test deriving addresses for first 5 indices
    for (let i = 0; i <= 5; i++) {
        try {
            const addr = hdWallet.deriveUserAddress(i);
            console.log(`\n✅ Index ${i}:`);
            console.log(`   Path: ${addr.path}`);
            console.log(`   Address: ${addr.publicKey}`);
        } catch (error) {
            console.log(`\n❌ Index ${i}: Failed - ${error.message}`);
            
            // Try simple path as fallback
            try {
                const simpleAddr = hdWallet.deriveUserAddressSimple(i);
                console.log(`   Simple path worked: ${simpleAddr.publicKey}`);
            } catch (e) {
                console.log(`   Simple path also failed`);
            }
        }
    }
    
} catch (error) {
    console.error('Fatal error:', error.message);
}
