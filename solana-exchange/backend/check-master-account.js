require('dotenv').config();
const { Connection, PublicKey } = require('@solana/web3.js');
const { getHDWallet } = require('./src/lib/hdwallet');

async function checkMasterAccount() {
    console.log('\n🔍 CHECKING MASTER WALLET ACCOUNT');
    console.log('================================');
    
    try {
        // Check if env is loaded
        console.log('📋 Environment check:');
        console.log(`   SOLANA_RPC: ${process.env.SOLANA_RPC || 'using default'}`);
        console.log(`   MASTER_WALLET_MNEMONIC: ${process.env.MASTER_WALLET_MNEMONIC ? '✓ loaded' : '✗ NOT FOUND'}`);
        
        if (!process.env.MASTER_WALLET_MNEMONIC) {
            console.log('\n❌ ERROR: MASTER_WALLET_MNEMONIC not found in .env file');
            console.log('   Current directory:', process.cwd());
            console.log('   Please run this script from the backend directory');
            return;
        }
        
        // Get master wallet
        const hdWallet = getHDWallet();
        const masterWallet = hdWallet.deriveUserAddress(0);
        const masterPubkey = new PublicKey(masterWallet.publicKey);
        
        console.log(`\n📍 Master Wallet Address: ${masterPubkey.toBase58()}`);
        console.log(`   Derived from HD Wallet index 0`);
        
        // Connect to Solana
        const connection = new Connection(process.env.SOLANA_RPC || 'https://api.devnet.solana.com');
        
        // Get account info
        console.log(`\n📡 Fetching account info from ${process.env.SOLANA_RPC || 'devnet'}...`);
        
        const accountInfo = await connection.getAccountInfo(masterPubkey);
        
        if (!accountInfo) {
            console.log('\n❌ Account not found on blockchain!');
            console.log('   This account may not have been initialized yet.');
            console.log('   (This is normal if no SOL has been deposited)');
            return;
        }
        
        console.log('\n📊 ACCOUNT DETAILS:');
        console.log('------------------');
        console.log(`   Lamports: ${accountInfo.lamports} (${accountInfo.lamports / 1e9} SOL)`);
        console.log(`   Data length: ${accountInfo.data.length} bytes`);
        console.log(`   Executable: ${accountInfo.executable}`);
        console.log(`   Rent epoch: ${accountInfo.rentEpoch}`);
        
        // Check owner
        const systemProgramId = '11111111111111111111111111111111';
        const ownerStr = accountInfo.owner.toBase58();
        
        console.log(`\n👤 OWNER: ${ownerStr}`);
        
        if (ownerStr === systemProgramId) {
            console.log('   ✅ OWNER IS SYSTEM PROGRAM (Good for SOL transfers)');
        } else {
            console.log('   ❌ OWNER IS NOT SYSTEM PROGRAM!');
            console.log('   This account is owned by a program, cannot use SystemProgram.transfer');
            console.log('   You must use the owning program to withdraw funds');
        }
        
        // Check if account has data
        if (accountInfo.data.length > 0) {
            console.log(`\n📦 ACCOUNT HAS DATA (${accountInfo.data.length} bytes)`);
            console.log('   ❌ This is NOT a simple wallet - it\'s a program account or token account');
            console.log('   Cannot use SystemProgram.transfer');
            
            // Try to decode as token account
            if (accountInfo.data.length === 165) {
                console.log('   ℹ️ This appears to be a token account (165 bytes)');
                console.log('   Use SPL Token transfer instead of SOL transfer');
            }
        } else {
            console.log(`\n✅ ACCOUNT HAS NO DATA - This is a simple wallet`);
            console.log('   Should work with SystemProgram.transfer');
        }
        
        // Summary
        console.log('\n📋 DIAGNOSIS:');
        if (ownerStr === systemProgramId && accountInfo.data.length === 0) {
            console.log('   ✅ ACCOUNT IS HEALTHY - Should work for SOL transfers');
        } else if (ownerStr !== systemProgramId) {
            console.log('   ❌ ISSUE: Wrong owner - account owned by program');
            console.log('   FIX: Need to use the owning program to withdraw');
        } else if (accountInfo.data.length > 0) {
            console.log('   ❌ ISSUE: Account has data - not a simple wallet');
            console.log('   FIX: This might be a token account, use SPL token transfer');
        }
        
    } catch (error) {
        console.error('\n❌ Error checking account:', error.message);
    }
}

checkMasterAccount().catch(console.error);
