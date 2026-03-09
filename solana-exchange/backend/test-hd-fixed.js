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
