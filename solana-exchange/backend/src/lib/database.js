const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

// Export the database connection
const db = new sqlite3.Database(path.join(__dirname, '../../database.sqlite'));

function generateId() {
    return crypto.randomUUID();
}

const User = {
    create: (email, username, password, walletIndex, depositAddress, phone) => {
        return new Promise((resolve, reject) => {
            const id = generateId();
            db.run(
                `INSERT INTO users (id, email, username, password, wallet_index, deposit_address, phone)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, email, username, password, walletIndex, depositAddress, phone],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id, email, username, depositAddress, solBalance: 0, usdcBalance: 0 });
                }
            );
        });
    },
    
    findByIdentifier: (identifier) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM users WHERE email = ? OR username = ?`,
                [identifier, identifier],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    },
    
    findById: (id) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT id, email, username, deposit_address, sol_balance, usdc_balance 
                 FROM users WHERE id = ?`,
                [id],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    },
    
    updateBalance: (userId, asset, amount) => {
        return new Promise((resolve, reject) => {
            const column = asset === 'SOL' ? 'sol_balance' : 'usdc_balance';
            const sql = `UPDATE users SET ${column} = ${column} + ? WHERE id = ?`;
            
            db.run(sql, [amount, userId], function(err) {
                if (err) {
                    console.error('Balance update error:', err);
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    },
    
    getLastWalletIndex: () => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT MAX(wallet_index) as maxIndex FROM users`,
                [],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row?.maxIndex || 0);
                }
            );
        });
    },
    
    getAll: () => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT id, wallet_index, deposit_address FROM users`,
                [],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }
};

const Deposit = {
    create: (userId, asset, amount, txSignature, fromAddress, toAddress) => {
        return new Promise((resolve, reject) => {
            const id = generateId();
            db.run(
                `INSERT INTO deposits (id, user_id, asset, amount, tx_signature, from_address, to_address)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, userId, asset, amount, txSignature, fromAddress, toAddress],
                function(err) {
                    if (err) reject(err);
                    else resolve(id);
                }
            );
        });
    },
    
    findBySignature: (txSignature) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM deposits WHERE tx_signature = ?`,
                [txSignature],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    },
    
    findByUser: (userId, limit = 10) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM deposits WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
                [userId, limit],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }
};

const Withdrawal = {
    create: (userId, asset, amount, toAddress) => {
        return new Promise((resolve, reject) => {
            const id = generateId();
            const fee = amount * 0.001;
            const netAmount = amount - fee;
            
            db.run(
                `INSERT INTO withdrawals (id, user_id, asset, amount, fee, to_address, status)
                 VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
                [id, userId, asset, netAmount, fee, toAddress],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id, fee, netAmount });
                }
            );
        });
    },
    
    updateStatus: (withdrawalId, status, txSignature = null) => {
        return new Promise((resolve, reject) => {
            let sql = `UPDATE withdrawals SET status = ?`;
            const params = [status];
            
            if (txSignature) {
                sql += `, tx_signature = ?`;
                params.push(txSignature);
            }
            
            sql += ` WHERE id = ?`;
            params.push(withdrawalId);
            
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    },
    
    findByUser: (userId, limit = 10) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
                [userId, limit],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    },
    
    findPending: () => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT w.*, u.deposit_address as user_address, u.wallet_index 
                 FROM withdrawals w
                 JOIN users u ON w.user_id = u.id
                 WHERE w.status = 'pending' 
                 ORDER BY w.created_at ASC`,
                [],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }
};

const Transaction = {
    create: (userId, type, asset, amount, fee = 0, txSignature = null, toAddress = null, fromAddress = null) => {
        return new Promise((resolve, reject) => {
            const id = generateId();
            db.run(
                `INSERT INTO transactions (id, user_id, type, asset, amount, fee, tx_signature, to_address, from_address)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, userId, type, asset, amount, fee, txSignature, toAddress, fromAddress],
                function(err) {
                    if (err) reject(err);
                    else resolve(id);
                }
            );
        });
    },
    
    findByUser: (userId, limit = 20) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
                [userId, limit],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }
};

// Export both the models AND the database connection
module.exports = { 
    User, 
    Deposit, 
    Withdrawal, 
    Transaction,
    db  // Export the database connection for direct use
};
