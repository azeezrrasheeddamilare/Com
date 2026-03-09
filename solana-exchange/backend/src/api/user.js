const express = require('express');
const db = require('../lib/database');
const authMiddleware = require('../middleware/auth');
const { getHDWallet } = require('../lib/hdwallet');

const User = db.User;
const router = express.Router();

router.get('/:id', authMiddleware, async (req, res) => {
    try {
        if (req.params.id !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        let depositAddress = user.deposit_address;
        
        // Try to get the correct address from HD wallet
        try {
            const hdWallet = getHDWallet();
            const correctAddress = hdWallet.deriveUserAddress(user.wallet_index).publicKey;
            
            // If database has wrong address, update it
            if (user.deposit_address !== correctAddress) {
                console.log(`Fixing deposit address for user ${user.username} (index ${user.wallet_index})`);
                
                // Update in database
                const sqlite3 = require('sqlite3').verbose();
                const path = require('path');
                const db2 = new sqlite3.Database(path.join(__dirname, '../../database.sqlite'));
                db2.run('UPDATE users SET deposit_address = ? WHERE id = ?', [correctAddress, user.id], (err) => {
                    if (err) console.error('Error updating address:', err);
                    db2.close();
                });
                
                depositAddress = correctAddress;
            }
        } catch (error) {
            console.error(`HD Wallet error for user ${user.username}:`, error.message);
            // Fall back to database address
        }
        
        res.json({
            id: user.id,
            email: user.email,
            username: user.username,
            deposit_address: depositAddress,
            sol_balance: user.sol_balance || 0,
            usdc_balance: user.usdc_balance || 0,
            is_admin: user.is_admin || 0
        });
        
    } catch (error) {
        console.error('User fetch error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
