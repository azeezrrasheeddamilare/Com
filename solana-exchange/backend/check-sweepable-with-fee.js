require('dotenv').config();
const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { getHDWallet } = require('./src/lib/hdwallet');

const RENT_EXEMPTION = 890880;
const TX_FEE = 5000;
const REQUIRED_MINIMUM = RENT_EXEMPTION + TX_FEE;

async function checkSweepable() {
    console.log('\n💰 CHECKING SWEEPABLE BALANCES (WITH FEE)');
    console.log('=========================================');
    console.log(`Rent exemption: ${RENT_EXEMPTION / LAMPORTS_PER_SOL} SOL`);
    console.log(`Transaction fee: ${TX_FEE / LAMPORTS_PER_SOL} SOL`);
    console.log(`Required minimum: ${REQUIRED_MINIMUM / LAMPORTS_PER_SOL} SOL\n`);
    
    const hdWallet = getHDWallet();
    const connection = new Connection(process.env.SOLANA_RPC || 'https://api.devnet.solana.com');
    
    const sqlite3 = require('sqlite3').verbose();
    const path = require('path');
    const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'));
    
    db.all('SELECT username, wallet_index FROM users', [], async (err, users) => {
        if (err) {
            console.error('Error:', err);
            return;
        }
        
        console.log('┌──────────┬──────────────────────────────────────────────┬─────────────┬─────────────┐');
        console.log('│ Username │ Address                                      │ Balance     │ Sweepable   │');
        console.log('├──────────┼──────────────────────────────────────────────┼─────────────┼─────────────┤');
        
        let totalSweepable = 0;
        
        for (const user of users) {
            const userWallet = hdWallet.deriveUserAddress(user.wallet_index);
            const balance = await connection.getBalance(new PublicKey(userWallet.publicKey));
            const sweepable = Math.max(0, balance - REQUIRED_MINIMUM);
            const sweepableSOL = sweepable / LAMPORTS_PER_SOL;
            
            totalSweepable += sweepableSOL;
            
            console.log(`│ ${user.username.padEnd(8)} │ ${userWallet.publicKey} │ ${(balance/1e9).toFixed(6)} SOL │ ${sweepableSOL.toFixed(6)} SOL │`);
        }
        
        console.log('└──────────┴──────────────────────────────────────────────┴─────────────┴─────────────┘');
        console.log(`\n💰 TOTAL SWEEPABLE: ${totalSweepable.toFixed(6)} SOL`);
        console.log(`\n✅ Each wallet will keep ${REQUIRED_MINIMUM / LAMPORTS_PER_SOL} SOL for rent + fee`);
        
        db.close();
    });
}

checkSweepable();
