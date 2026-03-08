const express = require('express');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const tradingAuth = require('../../middleware/trading/trading-auth');

const router = express.Router();

function generateId() {
    return crypto.randomUUID();
}

// Get balances
router.get('/', tradingAuth, async (req, res) => {
    const db = new sqlite3.Database(path.join(__dirname, '../../../database.sqlite'));
    
    try {
        const userId = req.userId;
        
        // Get main USDC balance
        const mainBalance = await new Promise((resolve, reject) => {
            db.get(
                'SELECT usdc_balance FROM users WHERE id = ?',
                [userId],
                (err, row) => resolve(row ? row.usdc_balance : 0)
            );
        });
        
        // Get trading balance
        const tradingBalance = await new Promise((resolve, reject) => {
            db.get(
                'SELECT usdc_balance FROM trading_balances WHERE user_id = ?',
                [userId],
                (err, row) => resolve(row ? row.usdc_balance : 0)
            );
        });
        
        res.json({
            success: true,
            data: {
                mainUSDC: mainBalance || 0,
                tradingUSDC: tradingBalance || 0
            }
        });
        
    } catch (error) {
        console.error('Balance error:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        db.close();
    }
});

// Transfer to trading
router.post('/to-trading', tradingAuth, async (req, res) => {
    const db = new sqlite3.Database(path.join(__dirname, '../../../database.sqlite'));
    
    try {
        const { amount } = req.body;
        const userId = req.userId;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid amount' });
        }
        
        await new Promise((resolve, reject) => {
            db.run('BEGIN TRANSACTION', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        // Check main balance
        const mainBalance = await new Promise((resolve, reject) => {
            db.get(
                'SELECT usdc_balance FROM users WHERE id = ?',
                [userId],
                (err, row) => resolve(row ? row.usdc_balance : 0)
            );
        });
        
        if (mainBalance < amount) {
            throw new Error('Insufficient USDC balance');
        }
        
        // Deduct from main
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET usdc_balance = usdc_balance - ? WHERE id = ?',
                [amount, userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        
        // Add to trading
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO trading_balances (user_id, usdc_balance) 
                 VALUES (?, ?)
                 ON CONFLICT(user_id) DO UPDATE SET 
                 usdc_balance = usdc_balance + ?,
                 updated_at = CURRENT_TIMESTAMP`,
                [userId, amount, amount],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        
        // Record transfer
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO trading_transfers (id, user_id, direction, amount)
                 VALUES (?, ?, 'main_to_trading', ?)`,
                [generateId(), userId, amount],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        
        await new Promise((resolve, reject) => {
            db.run('COMMIT', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        res.json({ success: true, message: `Transferred $${amount} to trading` });
        
    } catch (error) {
        await new Promise((resolve) => {
            db.run('ROLLBACK', () => resolve());
        });
        res.status(400).json({ success: false, error: error.message });
    } finally {
        db.close();
    }
});

// Transfer to main
router.post('/to-main', tradingAuth, async (req, res) => {
    const db = new sqlite3.Database(path.join(__dirname, '../../../database.sqlite'));
    
    try {
        const { amount } = req.body;
        const userId = req.userId;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid amount' });
        }
        
        await new Promise((resolve, reject) => {
            db.run('BEGIN TRANSACTION', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        // Check trading balance
        const tradingBalance = await new Promise((resolve, reject) => {
            db.get(
                'SELECT usdc_balance FROM trading_balances WHERE user_id = ?',
                [userId],
                (err, row) => resolve(row ? row.usdc_balance : 0)
            );
        });
        
        if (tradingBalance < amount) {
            throw new Error('Insufficient trading balance');
        }
        
        // Check for open positions
        const openPositions = await new Promise((resolve, reject) => {
            db.get(
                'SELECT COUNT(*) as count FROM trading_positions WHERE user_id = ? AND status = "OPEN"',
                [userId],
                (err, row) => resolve(row ? row.count : 0)
            );
        });
        
        if (openPositions > 0) {
            throw new Error('Close all positions first');
        }
        
        // Deduct from trading
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE trading_balances SET usdc_balance = usdc_balance - ? WHERE user_id = ?',
                [amount, userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        
        // Add to main
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET usdc_balance = usdc_balance + ? WHERE id = ?',
                [amount, userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        
        // Record transfer
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO trading_transfers (id, user_id, direction, amount)
                 VALUES (?, ?, 'trading_to_main', ?)`,
                [generateId(), userId, amount],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        
        await new Promise((resolve, reject) => {
            db.run('COMMIT', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        res.json({ success: true, message: `Transferred $${amount} to main` });
        
    } catch (error) {
        await new Promise((resolve) => {
            db.run('ROLLBACK', () => resolve());
        });
        res.status(400).json({ success: false, error: error.message });
    } finally {
        db.close();
    }
});

module.exports = router;
