const AuthService = require('../lib/auth');

module.exports = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    const user = AuthService.verifyToken(token);
    
    if (!user) {
        return res.status(401).json({ error: 'Invalid token' });
    }
    
    req.user = user;
    next();
};
