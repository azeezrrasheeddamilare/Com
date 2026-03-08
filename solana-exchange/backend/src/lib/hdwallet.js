const bip39 = require('bip39');
const { derivePath } = require('ed25519-hd-key');
const { Keypair, PublicKey } = require('@solana/web3.js');
const bs58 = require('bs58');

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

class HDWalletService {
    constructor(mnemonic) {
        const seedPhrase = mnemonic || process.env.MASTER_WALLET_MNEMONIC;
        if (!seedPhrase) throw new Error('Master mnemonic not found');
        this.masterSeed = bip39.mnemonicToSeedSync(seedPhrase);
    }
    
    deriveUserAddress(userIndex) {
        const path = `m/44'/501'/${userIndex}'/0'`;
        const { key } = derivePath(path, this.masterSeed.toString('hex'));
        const keypair = Keypair.fromSeed(key.slice(0, 32));
        return {
            publicKey: keypair.publicKey.toBase58(),
            keypair
        };
    }
    
    async getUserUSDCAddress(userPublicKey) {
        const [ata] = await PublicKey.findProgramAddress(
            [
                new PublicKey(userPublicKey).toBuffer(),
                new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA').toBuffer(),
                USDC_MINT.toBuffer(),
            ],
            new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
        );
        return ata;
    }
}

let hdWalletInstance = null;

const getHDWallet = () => {
    if (!hdWalletInstance) {
        hdWalletInstance = new HDWalletService();
    }
    return hdWalletInstance;
};

module.exports = { getHDWallet, USDC_MINT };
