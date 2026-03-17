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

// ✅ basePath variable for EJS templates
app.locals.basePath = process.env.BASE_PATH || '';

const authRoutes  = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const apiRoutes   = require('./api/routes');

app.use('/store/admin', authRoutes);
app.use('/store/admin', adminRoutes);

// CORS for frontend (Next.js on port 3001)
app.use('/store/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3001');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    next();
});
app.use('/store/api', apiRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});