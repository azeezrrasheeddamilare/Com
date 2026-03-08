const jwt = require('jsonwebtoken');

module.exports = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false,
                error: 'No token provided' 
            });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (!decoded || !decoded.id) {
            return res.status(401).json({ 
                success: false,
                error: 'Invalid token' 
            });
        }

        req.userId = decoded.id;
        req.username = decoded.username;
        next();
    } catch (error) {
        return res.status(401).json({ 
            success: false,
            error: 'Authentication failed' 
        });
    }
};
