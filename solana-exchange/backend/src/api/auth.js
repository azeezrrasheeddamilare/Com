const express = require('express');
const AuthService = require('../lib/auth');
const { User } = require('../lib/database');

const router = express.Router();
const authService = new AuthService();

router.post('/', async (req, res) => {
    try {
        const { action, email, username, password, phone } = req.body;
        
        let result;
        if (action === 'register') {
            result = await authService.register(email, username, password, phone);
        } else if (action === 'login') {
            result = await authService.login(email, password);
        } else {
            return res.status(400).json({ error: 'Invalid action' });
        }
        
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.get('/verify', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    const payload = AuthService.verifyToken(token);
    
    if (!payload) {
        return res.status(401).json({ error: 'Invalid token' });
    }
    
    const user = await User.findById(payload.id);
    
    // Make sure is_admin is included
    res.json({ 
        user: {
            id: user.id,
            email: user.email,
            username: user.username,
            deposit_address: user.deposit_address,
            sol_balance: user.sol_balance,
            usdc_balance: user.usdc_balance,
            is_admin: user.is_admin ? 1 : 0
        }
    });
});

module.exports = router;
