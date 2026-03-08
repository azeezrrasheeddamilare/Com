const db = require('../lib/database');

module.exports = async (req, res, next) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const user = await db.User.findById(req.user.id);
        
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        // Check admin status (allow alice by default)
        if (user.username === 'alice' || user.is_admin === 1) {
            req.admin = user;
            return next();
        }

        return res.status(403).json({ error: 'Admin access required' });
        
    } catch (error) {
        console.error('Admin middleware error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
