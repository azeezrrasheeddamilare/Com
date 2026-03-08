const express = require('express');
const db = require('../lib/database');
const authMiddleware = require('../middleware/auth');

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
        
        // Make sure is_admin is included and properly formatted
        res.json({
            id: user.id,
            email: user.email,
            username: user.username,
            deposit_address: user.deposit_address || 'Address not available',
            sol_balance: user.sol_balance || 0,
            usdc_balance: user.usdc_balance || 0,
            is_admin: user.is_admin ? 1 : 0
        });
        
    } catch (error) {
        console.error('User fetch error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
