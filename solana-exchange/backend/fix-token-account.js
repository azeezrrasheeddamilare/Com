const { Connection, PublicKey, Transaction } = require('@solana/web3.js');
const { getAssociatedTokenAddress, createCloseAccountInstruction } = require('@solana/spl-token');
const { getHDWallet, USDC_MINT } = require('./src/lib/hdwallet');

async function fixTokenAccount() {
    try {
        const hdWallet = getHDWallet();
        const masterWallet = hdWallet.deriveUserAddress(0);
        const masterPubkey = new PublicKey(masterWallet.publicKey);
        
        console.log('If this is a token account, you need to:');
        console.log('1. Close the token account to recover SOL');
        console.log('2. Or transfer tokens using token program');
        
        // Check if it's a USDC token account
        const ata = await getAssociatedTokenAddress(USDC_MINT, masterPubkey);
        console.log(`\nUSDC Token Account: ${ata.toBase58()}`);
        
    } catch (error) {
        console.error('Error:', error);
    }
}

fixTokenAccount();
