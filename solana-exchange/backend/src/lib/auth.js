const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('./database');
const { getHDWallet } = require('./hdwallet');

const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;

class AuthService {
    async register(email, username, password, phone) {
        const existing = await User.findByIdentifier(email);
        if (existing) throw new Error('Email or username already exists');
        
        const lastIndex = await User.getLastWalletIndex();
        const walletIndex = lastIndex + 1;
        
        const hdWallet = getHDWallet();
        const { publicKey } = hdWallet.deriveUserAddress(walletIndex);
        
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        
        const user = await User.create(
            email, username, hashedPassword, walletIndex, publicKey, phone
        );
        
        return this.generateToken({ 
            ...user, 
            solBalance: 0, 
            usdcBalance: 0, 
            is_admin: 0 
        });
    }
    
    async login(identifier, password) {
        const user = await User.findByIdentifier(identifier);
        if (!user) throw new Error('Invalid credentials');
        
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) throw new Error('Invalid credentials');
        
        return this.generateToken({
            id: user.id,
            email: user.email,
            username: user.username,
            depositAddress: user.deposit_address,
            solBalance: user.sol_balance,
            usdcBalance: user.usdc_balance,
            is_admin: user.is_admin || 0
        });
    }
    
    generateToken(user) {
        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                username: user.username,
                is_admin: user.is_admin 
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                depositAddress: user.depositAddress,
                solBalance: user.solBalance || 0,
                usdcBalance: user.usdcBalance || 0,
                is_admin: user.is_admin || 0
            }
        };
    }
    
    static verifyToken(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch {
            return null;
        }
    }
}

module.exports = AuthService;
