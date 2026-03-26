const { getSessionUser } = require('./session');

const requireLogin = (req, res, next) => {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Login required.' });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  const user = getSessionUser(req);
  if (!user || user.userType !== 1) {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }
  next();
};

const requireAgentOrAdmin = (req, res, next) => {
  const user = getSessionUser(req);
  if (!user || (user.userType !== 1 && user.userType !== 2)) {
    return res.status(403).json({ success: false, message: 'Agent or admin access required.' });
  }
  next();
};

const requireCustomer = (req, res, next) => {
  const user = getSessionUser(req);
  if (!user || user.userType !== 3) {
    return res.status(403).json({ success: false, message: 'Customer access required.' });
  }
  next();
};

module.exports = { requireLogin, requireAdmin, requireAgentOrAdmin, requireCustomer };
