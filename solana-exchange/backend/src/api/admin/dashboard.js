const express = require('express');
const authMiddleware = require('../../middleware/auth');
const adminMiddleware = require('../../middleware/admin');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const router = express.Router();
router.use(authMiddleware, adminMiddleware);

// ==================== DASHBOARD STATS ====================
router.get('/stats', async (req, res) => {
    const db = new sqlite3.Database(path.join(__dirname, '../../../database.sqlite'));
    
    try {
        const stats = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    (SELECT COUNT(*) FROM users) as total_users,
                    (SELECT COUNT(*) FROM users WHERE is_admin = 1) as total_admins,
                    (SELECT COUNT(*) FROM users WHERE date(created_at) = date('now')) as users_today,
                    
                    (SELECT COUNT(*) FROM deposits) as total_deposits,
                    (SELECT IFNULL(SUM(amount), 0) FROM deposits) as total_deposit_amount,
                    (SELECT COUNT(*) FROM deposits WHERE date(created_at) = date('now')) as deposits_today,
                    
                    (SELECT COUNT(*) FROM withdrawals) as total_withdrawals,
                    (SELECT IFNULL(SUM(amount), 0) FROM withdrawals WHERE status = 'completed') as total_withdrawal_amount,
                    (SELECT COUNT(*) FROM withdrawals WHERE status = 'pending') as pending_withdrawals,
                    (SELECT IFNULL(SUM(amount), 0) FROM withdrawals WHERE status = 'pending') as pending_amount,
                    
                    (SELECT COUNT(*) FROM transfers) as total_transfers,
                    (SELECT IFNULL(SUM(amount), 0) FROM transfers) as total_transfer_amount,
                    
                    (SELECT IFNULL(SUM(fee), 0) FROM withdrawals) as total_fees_collected,
                    (SELECT IFNULL(SUM(sol_balance), 0) FROM users) as total_sol_balance,
                    (SELECT IFNULL(SUM(usdc_balance), 0) FROM users) as total_usdc_balance
            `, [], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        // Log action
        const logId = crypto.randomUUID();
        db.run(
            `INSERT INTO admin_logs (id, admin_id, action, details)
             VALUES (?, ?, 'view_stats', ?)`,
            [logId, req.admin.id, JSON.stringify({ timestamp: new Date() })],
            (err) => {}
        );
        
        res.json({ success: true, stats });
        
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ error: error.message });
    } finally {
        db.close();
    }
});

// ==================== USER MANAGEMENT ====================
router.get('/users', async (req, res) => {
    const db = new sqlite3.Database(path.join(__dirname, '../../../database.sqlite'));
    
    try {
        const users = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    id, email, username, deposit_address,
                    sol_balance, usdc_balance, is_admin,
                    created_at,
                    (SELECT COUNT(*) FROM deposits WHERE user_id = users.id) as deposit_count
                FROM users
                ORDER BY created_at DESC
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        res.json(users);
        
    } catch (error) {
        console.error('Admin users error:', error);
        res.status(500).json({ error: error.message });
    } finally {
        db.close();
    }
});

router.put('/users/:id', async (req, res) => {
    const db = new sqlite3.Database(path.join(__dirname, '../../../database.sqlite'));
    
    try {
        const { id } = req.params;
        const { is_admin, sol_balance, usdc_balance } = req.body;
        
        db.run('BEGIN TRANSACTION');
        
        const updates = [];
        const params = [];
        
        if (is_admin !== undefined) {
            updates.push('is_admin = ?');
            params.push(is_admin ? 1 : 0);
        }
        if (sol_balance !== undefined) {
            updates.push('sol_balance = ?');
            params.push(sol_balance);
        }
        if (usdc_balance !== undefined) {
            updates.push('usdc_balance = ?');
            params.push(usdc_balance);
        }
        
        if (updates.length > 0) {
            params.push(id);
            db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
        }
        
        const logId = crypto.randomUUID();
        db.run(
            `INSERT INTO admin_logs (id, admin_id, action, details)
             VALUES (?, ?, 'update_user', ?)`,
            [logId, req.admin.id, JSON.stringify({ user_id: id, changes: req.body })]
        );
        
        db.run('COMMIT');
        
        res.json({ success: true, message: 'User updated' });
        
    } catch (error) {
        db.run('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        db.close();
    }
});

// ==================== WITHDRAWAL MANAGEMENT ====================
router.get('/withdrawals/pending', async (req, res) => {
    const db = new sqlite3.Database(path.join(__dirname, '../../../database.sqlite'));
    
    try {
        const withdrawals = await new Promise((resolve, reject) => {
            db.all(`
                SELECT w.*, u.username, u.email
                FROM withdrawals w
                JOIN users u ON w.user_id = u.id
                WHERE w.status = 'pending'
                ORDER BY w.created_at ASC
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        res.json(withdrawals);
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        db.close();
    }
});

router.post('/withdrawals/:id/approve', async (req, res) => {
    const db = new sqlite3.Database(path.join(__dirname, '../../../database.sqlite'));
    
    try {
        const { id } = req.params;
        
        db.run('BEGIN TRANSACTION');
        
        db.run(
            `UPDATE withdrawals SET status = 'completed', approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [req.admin.id, id]
        );
        
        const logId = crypto.randomUUID();
        db.run(
            `INSERT INTO admin_logs (id, admin_id, action, details)
             VALUES (?, ?, 'approve_withdrawal', ?)`,
            [logId, req.admin.id, JSON.stringify({ withdrawal_id: id })]
        );
        
        db.run('COMMIT');
        
        res.json({ success: true, message: 'Withdrawal approved' });
        
    } catch (error) {
        db.run('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        db.close();
    }
});

router.post('/withdrawals/:id/reject', async (req, res) => {
    const db = new sqlite3.Database(path.join(__dirname, '../../../database.sqlite'));
    
    try {
        const { id } = req.params;
        
        db.run('BEGIN TRANSACTION');
        
        const withdrawal = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM withdrawals WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!withdrawal) throw new Error('Withdrawal not found');
        
        const column = withdrawal.asset === 'SOL' ? 'sol_balance' : 'usdc_balance';
        db.run(
            `UPDATE users SET ${column} = ${column} + ? WHERE id = ?`,
            [withdrawal.amount + withdrawal.fee, withdrawal.user_id]
        );
        
        db.run(
            `UPDATE withdrawals SET status = 'rejected', approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [req.admin.id, id]
        );
        
        const logId = crypto.randomUUID();
        db.run(
            `INSERT INTO admin_logs (id, admin_id, action, details)
             VALUES (?, ?, 'reject_withdrawal', ?)`,
            [logId, req.admin.id, JSON.stringify({ withdrawal_id: id })]
        );
        
        db.run('COMMIT');
        
        res.json({ success: true, message: 'Withdrawal rejected' });
        
    } catch (error) {
        db.run('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        db.close();
    }
});

// ==================== SETTINGS ====================
router.get('/settings', async (req, res) => {
    const db = new sqlite3.Database(path.join(__dirname, '../../../database.sqlite'));
    
    try {
        const settings = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM system_settings ORDER BY key', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        res.json(settings);
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        db.close();
    }
});

router.put('/settings/:key', async (req, res) => {
    const db = new sqlite3.Database(path.join(__dirname, '../../../database.sqlite'));
    
    try {
        const { key } = req.params;
        const { value } = req.body;
        
        db.run(
            `UPDATE system_settings SET value = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE key = ?`,
            [value, req.admin.id, key]
        );
        
        const logId = crypto.randomUUID();
        db.run(
            `INSERT INTO admin_logs (id, admin_id, action, details)
             VALUES (?, ?, 'update_setting', ?)`,
            [logId, req.admin.id, JSON.stringify({ key, value })]
        );
        
        res.json({ success: true, message: 'Setting updated' });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        db.close();
    }
});

// ==================== LOGS ====================
router.get('/logs', async (req, res) => {
    const db = new sqlite3.Database(path.join(__dirname, '../../../database.sqlite'));
    
    try {
        const logs = await new Promise((resolve, reject) => {
            db.all(`
                SELECT l.*, u.username as admin_username
                FROM admin_logs l
                JOIN users u ON l.admin_id = u.id
                ORDER BY l.created_at DESC
                LIMIT 100
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        res.json(logs);
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        db.close();
    }
});

module.exports = router;
