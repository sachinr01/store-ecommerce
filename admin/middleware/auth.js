const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.admin) {
        return next();
    }
    res.redirect('/store/admin/login');
};

module.exports = { isAuthenticated };