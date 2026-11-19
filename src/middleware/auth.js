// Authentication (who are you?) and authorisation (are you allowed?) middleware.
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');
const { AppError, asyncHandler } = require('../utils/errors');

// Reads "Authorization: Bearer <jwt>", verifies it and loads the CURRENT user from the DB,
// so a role change or account suspension takes effect immediately, not when the token expires.
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw new AppError(401, 'UNAUTHENTICATED', 'Login required');

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new AppError(401, 'UNAUTHENTICATED', 'Invalid or expired token');
  }

  const user = await db.get(
    `SELECT id, name, email, role, is_committee, roll_no, phone, is_day_scholar, diet_pref, status, photo_url
       FROM users WHERE id = ?`,
    [payload.sub],
  );
  if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'User no longer exists');
  if (user.status === 'disabled' || user.status === 'rejected') {
    throw new AppError(403, 'ACCOUNT_INACTIVE', 'Account is not active');
  }
  req.user = user;
  next();
});

// authorise('manager', 'admin') -> only those roles pass.
// The pseudo-role 'committee' passes any student with is_committee = 1.
function authorise(...allowed) {
  return (req, res, next) => {
    const u = req.user;
    const ok = allowed.includes(u.role) || (allowed.includes('committee') && u.is_committee === 1);
    if (!ok) return next(new AppError(403, 'FORBIDDEN', 'You do not have permission for this action'));
    next();
  };
}

// Students must be approved by the mess manager before subscribing or using a pass.
function requireApproved(req, res, next) {
  if (req.user.status !== 'approved') {
    return next(new AppError(403, 'NOT_APPROVED', 'Your registration is waiting for mess manager approval'));
  }
  next();
}

module.exports = { authenticate, authorise, requireApproved };
