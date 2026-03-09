require('dotenv').config();
const { Connection, PublicKey } = require('@solana/web3.js');
const { getAssociatedTokenAddress } = require('@solana/spl-token');
const { getHDWallet, USDC_MINT } = require('./src/lib/hdwallet');

async function checkTokenAccount() {
    try {
        const hdWallet = getHDWallet();
        const masterWallet = hdWallet.deriveUserAddress(0);
        const masterPubkey = new PublicKey(masterWallet.publicKey);
        
        const connection = new Connection(process.env.SOLANA_RPC || 'https://api.devnet.solana.com');
        
        // Get USDC token account
        const ata = await getAssociatedTokenAddress(USDC_MINT, masterPubkey);
        console.log(`\n💵 USDC Token Account: ${ata.toBase58()}`);
        
        const accountInfo = await connection.getAccountInfo(ata);
        if (accountInfo) {
            const balance = await connection.getTokenAccountBalance(ata);
            console.log(`   Balance: ${balance.value.uiAmount} USDC`);
            console.log(`   Owner: ${accountInfo.owner.toBase58()}`);
        } else {
            console.log(`   No USDC token account found (normal if no USDC deposits)`);
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkTokenAccount();
