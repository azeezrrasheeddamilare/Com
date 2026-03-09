const bip39 = require('bip39');
const { derivePath } = require('ed25519-hd-key');
const { Keypair, PublicKey } = require('@solana/web3.js');
const bs58 = require('bs58');

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

class HDWalletService {
    constructor(mnemonic) {
        const seedPhrase = mnemonic || process.env.MASTER_WALLET_MNEMONIC;
        
        if (!seedPhrase) {
            throw new Error('Master mnemonic not found in .env');
        }
        
        console.log('✅ HD Wallet initialized');
        this.masterSeed = bip39.mnemonicToSeedSync(seedPhrase);
    }
    
    deriveUserAddress(userIndex) {
        // Solana derivation path: m/44'/501'/{userIndex}'/0'
        const path = `m/44'/501'/${userIndex}'/0'`;
        
        try {
            const { key } = derivePath(path, this.masterSeed.toString('hex'));
            const keypair = Keypair.fromSeed(key.slice(0, 32));
            
            // bs58 can be used as a function or with .encode
            // Let's use the function style which is more reliable
            const privateKey = typeof bs58 === 'function' 
                ? bs58(keypair.secretKey)
                : bs58.encode(keypair.secretKey);
            
            return {
                publicKey: keypair.publicKey.toBase58(),
                privateKey: privateKey,
                keypair,
                path
            };
        } catch (error) {
            console.error(`Error deriving path for index ${userIndex}:`, error.message);
            throw new Error(`Failed to derive address for index ${userIndex}`);
        }
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
    
    getMainWallet() {
        return this.deriveUserAddress(0);
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
