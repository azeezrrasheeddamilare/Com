const express = require('express');
const auth = require('../../middleware/trading-auth-v2');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const router = express.Router();

// Test endpoint to simulate a losing position (for testing only)
router.post('/simulate-loss', auth, async (req, res) => {
    const db = new sqlite3.Database(path.join(__dirname, '../../../database.sqlite'));
    
    try {
        const userId = req.userId;
        const { positionId, lossAmount } = req.body;
        
        if (!positionId || !lossAmount) {
            return res.status(400).json({ error: 'Missing positionId or lossAmount' });
        }
        
        // Get the position
        const position = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM trading_v2_positions WHERE id = ? AND user_id = ?',
                [positionId, userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
        
        if (!position) {
            return res.status(404).json({ error: 'Position not found' });
        }
        
        // Manually update P&L to simulate loss
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE trading_v2_positions SET pnl = ? WHERE id = ?',
                [-lossAmount, positionId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        
        res.json({ 
            success: true, 
            message: `Simulated loss of $${lossAmount} on position ${positionId}` 
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        db.close();
    }
});

module.exports = router;
