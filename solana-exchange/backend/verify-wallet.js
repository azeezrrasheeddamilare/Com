const bip39 = require('bip39');
const { derivePath } = require('ed25519-hd-key');
const { Keypair } = require('@solana/web3.js');
const fs = require('fs');

const MNEMONIC = process.argv[2];
const KEYPAIR_FILE = process.argv[3];

async function verify() {
    // Derive from mnemonic
    const seed = bip39.mnemonicToSeedSync(MNEMONIC);
    const { key } = derivePath("m/44'/501'/0'/0'", seed.toString('hex'));
    const derivedKeypair = Keypair.fromSeed(key.slice(0, 32));
    
    // Read keypair file
    const keypairData = JSON.parse(fs.readFileSync(KEYPAIR_FILE, 'utf8'));
    const fileKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
    
    console.log(`\n📊 VERIFICATION RESULTS:`);
    console.log(`   Derived address: ${derivedKeypair.publicKey.toBase58()}`);
    console.log(`   File address:    ${fileKeypair.publicKey.toBase58()}`);
    
    if (derivedKeypair.publicKey.toBase58() === fileKeypair.publicKey.toBase58()) {
        console.log(`\n✅ SUCCESS! Mnemonic matches keypair!`);
        return true;
    } else {
        console.log(`\n❌ ERROR: Mnemonic does NOT match keypair!`);
        return false;
    }
}

verify().then(success => {
    process.exit(success ? 0 : 1);
});
