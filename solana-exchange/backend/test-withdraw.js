require('dotenv').config();
const { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram, Keypair } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const bs58 = require('bs58');

// Get master wallet from HD wallet
const { getHDWallet } = require('./src/lib/hdwallet');

async function testWithdraw() {
    console.log('\n🔍 TESTING WITHDRAWAL WITH DIRECT KEYPAIR');
    console.log('========================================');
    
    try {
        // Check if env is loaded
        console.log('📋 Environment check:');
        console.log(`   SOLANA_RPC: ${process.env.SOLANA_RPC || 'using default'}`);
        console.log(`   MASTER_WALLET_MNEMONIC: ${process.env.MASTER_WALLET_MNEMONIC ? '✓ loaded' : '✗ NOT FOUND'}`);
        
        if (!process.env.MASTER_WALLET_MNEMONIC) {
            console.log('\n❌ ERROR: MASTER_WALLET_MNEMONIC not found in .env file');
            console.log('   Make sure you are running this from the backend directory');
            console.log('   Current directory:', process.cwd());
            return;
        }
        
        // Get master wallet
        const hdWallet = getHDWallet();
        const masterWallet = hdWallet.deriveUserAddress(0);
        const fromKeypair = masterWallet.keypair;
        const fromPubkey = fromKeypair.publicKey;
        
        console.log(`\n📍 MASTER WALLET:`);
        console.log(`   Address: ${fromPubkey.toBase58()}`);
        
        // Save keypair to file for testing
        const keypairFile = './master-keypair.json';
        const secretKey = Array.from(fromKeypair.secretKey);
        fs.writeFileSync(keypairFile, JSON.stringify(secretKey));
        console.log(`   ✓ Keypair saved to ${keypairFile}`);
        
        // Test with solana CLI
        console.log(`\n🔧 Testing with Solana CLI...`);
        
        // Check if solana CLI is available
        try {
            const { execSync } = require('child_process');
            
            // Check solana version
            const version = execSync('solana --version').toString();
            console.log(`   Solana CLI: ${version.trim()}`);
            
            // Set config to devnet
            execSync('solana config set --url https://api.devnet.solana.com', { stdio: 'pipe' });
            console.log(`   ✓ Configured devnet`);
            
            // Check balance
            const balance = execSync(`solana balance ${fromPubkey.toBase58()}`).toString();
            console.log(`   Balance: ${balance.trim()}`);
            
            // Try a simple transfer of 0.001 SOL
            console.log(`\n📤 Attempting transfer of 0.001 SOL...`);
            try {
                const result = execSync(
                    `solana transfer --keypair ${keypairFile} 6685YHRvbXr2tPw8X31sPCc8EXQUpgKJNuq6bv5gA12L 0.001 --allow-unfunded-recipient --fee-payer ${keypairFile}`,
                    { stdio: 'pipe' }
                ).toString();
                
                console.log(`   ✓ Success! Transaction: ${result.trim()}`);
            } catch (transferError) {
                console.error(`   ❌ Transfer failed:`, transferError.message);
                if (transferError.stdout) console.log('   STDOUT:', transferError.stdout.toString());
                if (transferError.stderr) console.log('   STDERR:', transferError.stderr.toString());
            }
            
        } catch (cliError) {
            console.error(`\n❌ Solana CLI Error:`, cliError.message);
            console.log('   Make sure solana CLI is installed:');
            console.log('   sh -c "$(curl -sSfL https://release.solana.com/stable/install)"');
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testWithdraw();
