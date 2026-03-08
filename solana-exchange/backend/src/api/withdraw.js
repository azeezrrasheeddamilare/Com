const express = require('express');
const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { createTransferInstruction } = require('@solana/spl-token');
const { getHDWallet, USDC_MINT } = require('../lib/hdwallet');
const authMiddleware = require('../middleware/auth');

// Import database functions
const db = require('../lib/database');
const User = db.User;
const Withdrawal = db.Withdrawal;
const TransactionModel = db.Transaction;

const router = express.Router();
const connection = new Connection(process.env.SOLANA_RPC);

// SOL withdrawal
router.post('/sol', authMiddleware, async (req, res) => {
    try {
        const { amount, toAddress } = req.body;
        const userId = req.user.id;
        
        // Validate
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }
        
        // Validate address
        try {
            new PublicKey(toAddress);
        } catch (err) {
            return res.status(400).json({ error: 'Invalid Solana address' });
        }
        
        // Get user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check balance
        if (user.sol_balance < amount) {
            return res.status(400).json({ error: 'Insufficient SOL balance' });
        }
        
        // Create withdrawal record
        const withdrawal = await Withdrawal.create(userId, 'SOL', amount, toAddress);
        
        // Update user balance (lock the funds)
        await User.updateBalance(userId, 'SOL', -amount);
        
        // Create transaction record
        await TransactionModel.create(
            userId, 
            'withdrawal', 
            'SOL', 
            amount - withdrawal.fee, 
            withdrawal.fee, 
            null, 
            toAddress
        );
        
        res.json({
            success: true,
            message: 'Withdrawal request created',
            withdrawal: {
                id: withdrawal.id,
                amount: (amount - withdrawal.fee).toFixed(4),
                fee: withdrawal.fee.toFixed(4),
                toAddress,
                status: 'pending'
            }
        });
        
    } catch (error) {
        console.error('Withdrawal error:', error);
        res.status(500).json({ error: 'Withdrawal failed: ' + error.message });
    }
});

// USDC withdrawal
router.post('/usdc', authMiddleware, async (req, res) => {
    try {
        const { amount, toAddress } = req.body;
        const userId = req.user.id;
        
        // Validate
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }
        
        // Validate address
        try {
            new PublicKey(toAddress);
        } catch (err) {
            return res.status(400).json({ error: 'Invalid Solana address' });
        }
        
        // Get user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check balance
        if (user.usdc_balance < amount) {
            return res.status(400).json({ error: 'Insufficient USDC balance' });
        }
        
        // Create withdrawal record
        const withdrawal = await Withdrawal.create(userId, 'USDC', amount, toAddress);
        
        // Update user balance (lock the funds)
        await User.updateBalance(userId, 'USDC', -amount);
        
        // Create transaction record
        await TransactionModel.create(
            userId, 
            'withdrawal', 
            'USDC', 
            amount - withdrawal.fee, 
            withdrawal.fee, 
            null, 
            toAddress
        );
        
        res.json({
            success: true,
            message: 'Withdrawal request created',
            withdrawal: {
                id: withdrawal.id,
                amount: (amount - withdrawal.fee).toFixed(2),
                fee: withdrawal.fee.toFixed(2),
                toAddress,
                status: 'pending'
            }
        });
        
    } catch (error) {
        console.error('Withdrawal error:', error);
        res.status(500).json({ error: 'Withdrawal failed: ' + error.message });
    }
});

// Get withdrawal history
router.get('/history', authMiddleware, async (req, res) => {
    try {
        const withdrawals = await Withdrawal.findByUser(req.user.id, 20);
        res.json(withdrawals);
    } catch (error) {
        console.error('History error:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

module.exports = router;
