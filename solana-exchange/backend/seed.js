require('dotenv').config();

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getHDWallet } = require('./src/lib/hdwallet');
const bip39 = require('bip39');

const db = new sqlite3.Database('./database.sqlite');

async function seed() {
    console.log('🌱 Seeding database...');
    
    try {
        // Check mnemonic
        if (!process.env.MASTER_WALLET_MNEMONIC) {
            const mnemonic = bip39.generateMnemonic(256);
            console.log(`\n✅ Generated new mnemonic. Add to .env:`);
            console.log(`MASTER_WALLET_MNEMONIC="${mnemonic}"\n`);
            process.env.MASTER_WALLET_MNEMONIC = mnemonic;
        }
        
        const hdWallet = getHDWallet();
        const hash = await bcrypt.hash('password', 10);
        
        // Check if users exist
        db.get("SELECT COUNT(*) as count FROM users", [], async (err, row) => {
            if (err) {
                console.error('Error checking users:', err);
                return;
            }
            
            if (row.count > 0) {
                console.log('✅ Users already exist');
                
                // Show existing users
                db.all("SELECT username, deposit_address FROM users", [], (err, users) => {
                    if (!err && users.length > 0) {
                        console.log('\n📋 Existing users:');
                        users.forEach(u => {
                            console.log(`   ${u.username}: ${u.deposit_address}`);
                        });
                    }
                    console.log('\n🔑 Login with: username/email and password "password"');
                    db.close();
                });
                return;
            }
            
            // Create users
            const users = [
                {
                    email: 'alice@example.com',
                    username: 'alice',
                    password: hash,
                    walletIndex: 1,
                    address: hdWallet.deriveUserAddress(1).publicKey,
                    solBalance: 100,
                    usdcBalance: 10000
                },
                {
                    email: 'bob@example.com',
                    username: 'bob',
                    password: hash,
                    walletIndex: 2,
                    address: hdWallet.deriveUserAddress(2).publicKey,
                    solBalance: 50,
                    usdcBalance: 5000
                }
            ];
            
            console.log('\n📝 Creating users...');
            
            let completed = 0;
            
            users.forEach(user => {
                const id = crypto.randomUUID();
                db.run(
                    `INSERT INTO users (id, email, username, password, wallet_index, deposit_address, sol_balance, usdc_balance)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [id, user.email, user.username, user.password, user.walletIndex, user.address, user.solBalance, user.usdcBalance],
                    function(err) {
                        if (err) {
                            console.error('❌ Error:', err.message);
                        } else {
                            console.log(`✅ Created: ${user.username} - ${user.address}`);
                        }
                        
                        completed++;
                        if (completed === users.length) {
                            console.log('\n✨ Seed complete!\n');
                            console.log('📍 Deposit addresses:');
                            users.forEach(u => {
                                console.log(`   ${u.username}: ${u.address}`);
                            });
                            console.log('\n🔑 Login: username/email with password "password"');
                            db.close();
                        }
                    }
                );
            });
        });
        
    } catch (error) {
        console.error('❌ Seed failed:', error.message);
    }
}

seed();
