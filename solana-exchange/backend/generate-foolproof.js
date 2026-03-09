const bip39 = require('bip39');
const { derivePath } = require('ed25519-hd-key');
const { Keypair } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

// Generate a new mnemonic
const mnemonic = bip39.generateMnemonic(256);
const seed = bip39.mnemonicToSeedSync(mnemonic);

// Derive the keypair using the standard Solana path
const { key } = derivePath("m/44'/501'/0'/0'", seed.toString('hex'));
const keypair = Keypair.fromSeed(key.slice(0, 32));

// Save the keypair
const keysDir = path.join(__dirname, 'keys');
if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir);
}

fs.writeFileSync(
    path.join(keysDir, 'master-wallet.json'),
    JSON.stringify(Array.from(keypair.secretKey))
);

// Save the mnemonic
fs.writeFileSync(
    path.join(keysDir, 'master-mnemonic.txt'),
    mnemonic
);

console.log('\n✅ WALLET GENERATED SUCCESSFULLY!');
console.log('==================================');
console.log(`📍 Master Address: ${keypair.publicKey.toBase58()}`);
console.log(`🔐 Master Mnemonic: ${mnemonic}`);
console.log('\n📁 Files saved:');
console.log('   • keys/master-wallet.json');
console.log('   • keys/master-mnemonic.txt');

// Verify they match
console.log('\n🔍 VERIFICATION:');
console.log('   Deriving from mnemonic again...');

const verifySeed = bip39.mnemonicToSeedSync(mnemonic);
const { key: verifyKey } = derivePath("m/44'/501'/0'/0'", verifySeed.toString('hex'));
const verifyKeypair = Keypair.fromSeed(verifyKey.slice(0, 32));

if (verifyKeypair.publicKey.toBase58() === keypair.publicKey.toBase58()) {
    console.log('   ✅ SUCCESS! Mnemonic matches keypair!');
    process.exit(0);
} else {
    console.log('   ❌ ERROR: Mnemonic does not match keypair!');
    process.exit(1);
}
