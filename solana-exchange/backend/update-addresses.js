require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { getHDWallet } = require('./src/lib/hdwallet');

const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'));
const hdWallet = getHDWallet();

// Start transaction
db.run('BEGIN TRANSACTION');

// Get all users
db.all('SELECT id, username, wallet_index, deposit_address FROM users ORDER BY wallet_index', [], (err, users) => {
    if (err) {
        console.error('Error:', err);
        db.run('ROLLBACK');
        return;
    }
    
    let completed = 0;
    let updated = [];
    
    users.forEach(user => {
        const newAddress = hdWallet.deriveUserAddress(user.wallet_index).publicKey;
        
        db.run(
            'UPDATE users SET deposit_address = ? WHERE id = ?',
            [newAddress, user.id],
            function(err) {
                if (err) {
                    console.error(`   ❌ Failed to update ${user.username}:`, err.message);
                } else {
                    console.log(`   ✅ ${user.username.padEnd(8)} → ${newAddress}`);
                    updated.push({
                        username: user.username,
                        old: user.deposit_address,
                        new: newAddress
                    });
                }
                
                completed++;
                if (completed === users.length) {
                    db.run('COMMIT', (err) => {
                        if (err) {
                            console.error('Commit error:', err);
                            db.run('ROLLBACK');
                        } else {
                            console.log('\n✅ All user addresses updated successfully!');
                            
                            // Save mapping to file
                            const fs = require('fs');
                            fs.writeFileSync(
                                'address-mapping.json',
                                JSON.stringify(updated, null, 2)
                            );
                            console.log('📁 Address mapping saved to address-mapping.json');
                        }
                        db.close();
                    });
                }
            }
        );
    });
});
