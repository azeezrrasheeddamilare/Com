const express = require('express');
const authMiddleware = require('../middleware/auth');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const router = express.Router();

// Generate ID
function generateId() {
    return crypto.randomUUID();
}

// Send P2P transfer
router.post('/', authMiddleware, async (req, res) => {
    const db = new sqlite3.Database(path.join(__dirname, '../../database.sqlite'));
    
    try {
        const { toUsername, asset, amount, memo } = req.body;
        const senderId = req.user.id;
        
        console.log('Transfer request:', { toUsername, asset, amount, senderId });
        
        // Validation
        if (!toUsername || !asset || !amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid request' });
        }
        
        if (asset !== 'SOL' && asset !== 'USDC') {
            return res.status(400).json({ error: 'Invalid asset' });
        }
        
        // Start transaction
        await new Promise((resolve, reject) => {
            db.run('BEGIN TRANSACTION', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        // Get sender
        const sender = await new Promise((resolve, reject) => {
            db.get(
                'SELECT id, username, sol_balance, usdc_balance FROM users WHERE id = ?',
                [senderId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
        
        if (!sender) {
            throw new Error('Sender not found');
        }
        
        // Get receiver
        const receiver = await new Promise((resolve, reject) => {
            db.get(
                'SELECT id, username FROM users WHERE username = ? OR email = ?',
                [toUsername, toUsername],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
        
        if (!receiver) {
            throw new Error('Receiver not found');
        }
        
        if (receiver.id === senderId) {
            throw new Error('Cannot send to yourself');
        }
        
        // Check balance
        const balance = asset === 'SOL' ? sender.sol_balance : sender.usdc_balance;
        if (balance < amount) {
            throw new Error(`Insufficient ${asset} balance`);
        }
        
        // Calculate fee (0.1% with max 10)
        const fee = Math.min(amount * 0.001, 10);
        const netAmount = amount - fee;
        
        // Update sender balance
        const balanceColumn = asset === 'SOL' ? 'sol_balance' : 'usdc_balance';
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE users SET ${balanceColumn} = ${balanceColumn} - ? WHERE id = ?`,
                [amount, senderId],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        
        // Update receiver balance
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE users SET ${balanceColumn} = ${balanceColumn} + ? WHERE id = ?`,
                [netAmount, receiver.id],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        
        // Create transfer record
        const transferId = generateId();
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO transfers (id, sender_id, receiver_id, asset, amount, fee, memo, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')`,
                [transferId, senderId, receiver.id, asset, netAmount, fee, memo || null],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        
        // Create transaction records for both users
        const txId1 = generateId();
        const txId2 = generateId();
        
        // Sender transaction
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO transactions (id, user_id, type, asset, amount, fee, to_address, from_address, status)
                 VALUES (?, ?, 'transfer_sent', ?, ?, ?, ?, ?, 'completed')`,
                [txId1, senderId, asset, -amount, fee, receiver.username, sender.username],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        
        // Receiver transaction
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO transactions (id, user_id, type, asset, amount, fee, to_address, from_address, status)
                 VALUES (?, ?, 'transfer_received', ?, ?, 0, ?, ?, 'completed')`,
                [txId2, receiver.id, asset, netAmount, receiver.username, sender.username],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        
        // Commit transaction
        await new Promise((resolve, reject) => {
            db.run('COMMIT', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        console.log(`Transfer completed: ${amount} ${asset} from ${sender.username} to ${receiver.username}`);
        
        res.json({
            success: true,
            message: `Sent ${netAmount} ${asset} to ${receiver.username}`,
            transfer: {
                id: transferId,
                to: receiver.username,
                asset,
                amount: netAmount,
                fee,
                memo: memo || null
            }
        });
        
    } catch (error) {
        // Rollback on error
        await new Promise((resolve) => {
            db.run('ROLLBACK', () => resolve());
        });
        
        console.error('Transfer error:', error.message);
        res.status(400).json({ error: error.message });
        
    } finally {
        db.close();
    }
});

// Get transfer history
router.get('/history', authMiddleware, async (req, res) => {
    const db = new sqlite3.Database(path.join(__dirname, '../../database.sqlite'));
    
    try {
        const userId = req.user.id;
        
        const transfers = await new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    t.*,
                    sender.username as sender_name,
                    receiver.username as receiver_name
                FROM transfers t
                JOIN users sender ON t.sender_id = sender.id
                JOIN users receiver ON t.receiver_id = receiver.id
                WHERE t.sender_id = ? OR t.receiver_id = ?
                ORDER BY t.created_at DESC
                LIMIT 50
            `;
            
            db.all(sql, [userId, userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        res.json(transfers);
        
    } catch (error) {
        console.error('Transfer history error:', error);
        res.status(500).json({ error: 'Failed to load transfers' });
        
    } finally {
        db.close();
    }
});

module.exports = router;
