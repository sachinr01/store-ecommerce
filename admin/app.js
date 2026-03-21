const express = require('express');
const path = require('path');
const session = require('express-session');
require('dotenv').config();

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Serve static files on BOTH paths (local + VPS)
app.use('/store/admin/css', express.static(path.join(__dirname, 'public/css')));
app.use('/store/admin/js', express.static(path.join(__dirname, 'public/js')));
app.use('/store/admin/images', express.static(path.join(__dirname, 'public/images')));
app.use('/store/admin/fonts', express.static(path.join(__dirname, 'public/fonts')));
app.use('/store/admin/libs', express.static(path.join(__dirname, 'public/libs')));
// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// ✅ Local paths working too
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/fonts', express.static(path.join(__dirname, 'public/fonts')));
app.use('/libs', express.static(path.join(__dirname, 'public/libs')));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// ✅ Auto pass admin session to all views
app.use((req, res, next) => {
    res.locals.admin = req.session.admin || null;
    res.locals.basePath = process.env.BASE_PATH || '';
    res.locals.currentRoute = req.path; // ✅ add this
    next();
});

const authRoutes  = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const productRoutes = require('./routes/productRoutes');
const userRoutes = require('./routes/userRoutes');
const apiRoutes   = require('./api/routes');
const orderRoutes = require('./routes/orderRoutes');

app.use('/store/admin', orderRoutes);
app.use('/store/admin', authRoutes);
app.use('/store/admin', adminRoutes);
app.use('/store/admin', productRoutes);
app.use('/store/admin', userRoutes);

// CORS for frontend
app.use('/store/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3001');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});
app.use('/store/api', apiRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});