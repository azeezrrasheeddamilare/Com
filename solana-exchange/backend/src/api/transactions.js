const express = require('express');
const authMiddleware = require('../middleware/auth');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const router = express.Router();

// Get all transactions for user
router.get('/', authMiddleware, async (req, res) => {
    const db = new sqlite3.Database(path.join(__dirname, '../../database.sqlite'));
    
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 50;
        
        // Get all transactions (deposits, withdrawals, transfers)
        const transactions = await new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    id,
                    user_id,
                    type,
                    asset,
                    amount,
                    fee,
                    status,
                    tx_signature,
                    to_address,
                    from_address,
                    created_at
                FROM transactions 
                WHERE user_id = ? 
                ORDER BY created_at DESC 
                LIMIT ?
            `;
            
            db.all(sql, [userId, limit], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        // Also get deposits directly from deposits table if not in transactions
        const deposits = await new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    id,
                    user_id,
                    'deposit' as type,
                    asset,
                    amount,
                    0 as fee,
                    'completed' as status,
                    tx_signature,
                    to_address,
                    from_address,
                    created_at
                FROM deposits 
                WHERE user_id = ? 
                AND id NOT IN (SELECT id FROM transactions WHERE user_id = ? AND type = 'deposit')
                ORDER BY created_at DESC
            `;
            
            db.all(sql, [userId, userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        // Combine and sort
        const allTransactions = [...transactions, ...deposits];
        allTransactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        res.json(allTransactions.slice(0, limit));
        
    } catch (error) {
        console.error('Transaction fetch error:', error);
        res.status(500).json({ error: 'Failed to load transactions' });
        
    } finally {
        db.close();
    }
});

// Get single transaction
router.get('/:id', authMiddleware, async (req, res) => {
    const db = new sqlite3.Database(path.join(__dirname, '../../database.sqlite'));
    
    try {
        const { id } = req.params;
        
        const transaction = await new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM transactions WHERE id = ? AND user_id = ?`,
                [id, req.user.id],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
        
        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        
        res.json(transaction);
        
    } catch (error) {
        console.error('Transaction fetch error:', error);
        res.status(500).json({ error: 'Failed to load transaction' });
        
    } finally {
        db.close();
    }
});

module.exports = router;
