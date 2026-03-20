const db   = require('../config/db');
const crypto = require('crypto');

// Simple MD5 hash — matches WordPress-style password storage fallback
// For production use bcrypt; this keeps it dependency-free for now
const hashPassword = (pass) => crypto.createHash('md5').update(pass).digest('hex');

// POST /store/api/auth/register
const register = async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
        return res.status(400).json({ success: false, message: 'Username, email and password are required.' });

    try {
        // Check duplicate username or email
        const [[existing]] = await db.query(
            'SELECT ID FROM tbl_users WHERE user_login = ? OR user_email = ? LIMIT 1',
            [username, email]
        );
        if (existing)
            return res.status(409).json({ success: false, message: 'Username or email already exists.' });

        const hashed = hashPassword(password);
        const [result] = await db.query(
            `INSERT INTO tbl_users (user_login, user_email, user_pass, display_name, user_registered)
             VALUES (?, ?, ?, ?, NOW())`,
            [username, email, hashed, username]
        );

        res.json({ success: true, message: 'Account created successfully.', userId: result.insertId });
    } catch (err) {
        console.error('register error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// POST /store/api/auth/login
const login = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
        return res.status(400).json({ success: false, message: 'Username and password are required.' });

    try {
        const [[user]] = await db.query(
            'SELECT ID, user_login, user_email, display_name FROM tbl_users WHERE (user_login = ? OR user_email = ?) LIMIT 1',
            [username, username]
        );
        if (!user)
            return res.status(401).json({ success: false, message: 'Invalid username or password.' });

        // Check hashed password
        const [[passRow]] = await db.query(
            'SELECT user_pass FROM tbl_users WHERE ID = ?',
            [user.ID]
        );
        const hashed = hashPassword(password);
        if (passRow.user_pass !== hashed)
            return res.status(401).json({ success: false, message: 'Invalid username or password.' });

        res.json({
            success: true,
            message: 'Login successful.',
            user: {
                id: user.ID,
                username: user.user_login,
                email: user.user_email,
                displayName: user.display_name,
            }
        });
    } catch (err) {
        console.error('login error:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

module.exports = { register, login };
