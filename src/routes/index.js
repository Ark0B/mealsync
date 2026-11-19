// All API routes. Read top to bottom: path -> who may call it -> controller.
const express = require('express');
const rateLimit = require('express-rate-limit');
const { asyncHandler: h } = require('../utils/errors');
const { authenticate, authorise, requireApproved } = require('../middleware/auth');
const authC = require('../controllers/auth.controller');
const student = require('../controllers/student.controller');
const scanC = require('../controllers/scan.controller');
const mgr = require('../controllers/manager.controller');
const comm = require('../controllers/community.controller');

const router = express.Router();

// Slow down password guessing: 20 attempts per 15 minutes per IP (disabled in tests).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

router.get('/health', (req, res) => res.json({ status: 'ok' }));

// ---- Auth --------------------------------------------------------------
router.post('/auth/register', loginLimiter, h(authC.register));
router.post('/auth/login', loginLimiter, h(authC.login));
router.get('/auth/me', authenticate, h(authC.me));

// Everything below needs a valid login.
router.use(authenticate);

const STUDENT = authorise('student');
const STAFF = authorise('staff', 'manager', 'admin');
const OFFICE = authorise('manager', 'admin');
const COMMITTEE = authorise('committee', 'manager', 'admin');

// ---- Student -----------------------------------------------------------
router.get('/plans', h(student.plans));
router.get('/meal-prices', h(student.mealPrices));
router.post('/subscriptions', STUDENT, requireApproved, h(student.subscribe));
router.get('/subscriptions/mine', STUDENT, h(student.mySubscriptions));
router.delete('/subscriptions/:id', STUDENT, h(student.discardSubscription));
router.post('/subscriptions/:id/cancel', STUDENT, h(student.requestCancel));

router.post('/payments/mock-checkout/:orderId', STUDENT, h(student.mockCheckout));
router.post('/payments/verify', STUDENT, h(student.verifyPayment));
router.get('/payments/mine', STUDENT, h(student.myPayments));

router.get('/pass', STUDENT, requireApproved, h(student.pass));

router.post('/skips', STUDENT, requireApproved, h(student.skip));
router.get('/skips/mine', STUDENT, h(student.mySkips));
router.delete('/skips/:id', STUDENT, h(student.cancelSkip));
router.post('/late-plates', STUDENT, requireApproved, h(student.latePlate));
router.get('/late-plates/mine', STUDENT, h(student.myLatePlates));
router.get('/meals/history', STUDENT, h(student.mealHistory));

router.post('/tokens', STUDENT, requireApproved, h(student.buyToken));
router.get('/tokens/mine', STUDENT, h(student.myTokens));
router.delete('/tokens/:id', STUDENT, h(student.discardToken));
router.get('/wallet', STUDENT, h(student.wallet));

// ---- Counter staff -----------------------------------------------------
router.post('/scans', STAFF, h(scanC.scan));
router.get('/scans/recent', STAFF, h(scanC.recent));

// ---- Complaints, ratings, menu, polls ----------------------------------
router.post('/complaints', STUDENT, h(comm.createComplaint));
router.get('/complaints/mine', STUDENT, h(comm.myComplaints));
router.get('/complaints', COMMITTEE, h(comm.allComplaints));
router.patch('/complaints/:id', COMMITTEE, h(comm.updateComplaint));

router.post('/ratings', STUDENT, h(comm.rate));
router.get('/ratings/summary', COMMITTEE, h(comm.ratingSummary));

router.get('/menu', h(comm.menuWeek));
router.get('/menu/today', h(comm.menuToday));
router.put('/menu', COMMITTEE, h(comm.setMenuItem));

router.get('/polls', h(comm.listPolls));
router.get('/polls/:id', h(comm.getPoll));
router.post('/polls', COMMITTEE, h(comm.createPoll));
router.post('/polls/:id/vote', STUDENT, requireApproved, h(comm.vote));
router.post('/polls/:id/close', COMMITTEE, h(comm.closePoll));

// ---- Mess office (manager / admin) -------------------------------------
router.get('/admin/users', OFFICE, h(mgr.listUsers));
router.post('/admin/users', OFFICE, h(mgr.createStaff));
router.patch('/admin/users/:id/status', OFFICE, h(mgr.setUserStatus));
router.patch('/admin/users/:id/committee', OFFICE, h(mgr.setCommittee));
router.get('/admin/cancel-requests', OFFICE, h(mgr.cancelRequests));
router.post('/admin/subscriptions/:id/cancel-decision', OFFICE, h(mgr.decideCancel));
router.get('/admin/plans', OFFICE, h(mgr.allPlans));
router.patch('/admin/plans/:id', OFFICE, h(mgr.updatePlan));
router.put('/admin/meal-prices', OFFICE, h(mgr.setMealPrice));
router.get('/admin/settings', OFFICE, h(mgr.getSettings));
router.patch('/admin/settings', OFFICE, h(mgr.updateSettings));
router.get('/admin/headcount', authorise('staff', 'manager', 'admin', 'committee'), h(mgr.headcount));
router.get('/admin/reports/summary', OFFICE, h(mgr.summary));
router.get('/admin/reports/fraud', OFFICE, h(mgr.fraud));
router.get('/admin/reports/meals.csv', OFFICE, h(mgr.exportCsv));
router.get('/admin/audit', OFFICE, h(mgr.auditLog));

module.exports = router;
