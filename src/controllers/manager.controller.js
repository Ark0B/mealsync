// Mess office: approvals, cancellations, settings, prices, reports.
const users = require('../services/users.service');
const subscriptions = require('../services/subscriptions.service');
const tokens = require('../services/tokens.service');
const settings = require('../services/settings.service');
const reports = require('../services/reports.service');
const audit = require('../services/audit.service');
const db = require('../db');
const { toId } = require('../utils/validate');
const { today } = require('../utils/time');

exports.listUsers = async (req, res) => res.json(await users.list(req.query));
exports.setUserStatus = async (req, res) => res.json(await users.setStatus(req.user, toId(req.params.id), req.body.status));
exports.setCommittee = async (req, res) => res.json(await users.setCommittee(req.user, toId(req.params.id), Boolean(req.body.is_committee)));
exports.createStaff = async (req, res) => res.status(201).json(await users.createStaff(req.user, req.body));

exports.cancelRequests = async (req, res) => res.json(await subscriptions.listCancelRequests());
exports.decideCancel = async (req, res) => res.json(await subscriptions.decideCancel(req.user, toId(req.params.id), req.body.approve === true));

exports.allPlans = async (req, res) => res.json(await subscriptions.listPlans(null));
exports.updatePlan = async (req, res) => res.json(await subscriptions.updatePlan(req.user, toId(req.params.id), req.body));
exports.setMealPrice = async (req, res) => res.json(await tokens.setPrice(req.user, req.body));

exports.getSettings = async (req, res) => res.json(await settings.getAll());
exports.updateSettings = async (req, res) => res.json(await settings.update(req.user.id, req.body));

exports.headcount = async (req, res) => res.json(await reports.headcount(req.query.date || today()));
exports.summary = async (req, res) => res.json(await reports.summary(req.query.month || today().slice(0, 7)));
exports.fraud = async (req, res) => res.json(await reports.fraudSignals(req.query.month || today().slice(0, 7), Number(req.query.threshold) || 3));
exports.exportCsv = async (req, res) => {
  const month = req.query.month || today().slice(0, 7);
  const csv = await reports.mealLogCsv(month);
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="mealsync-meals-${month}.csv"`);
  res.send(csv);
};
exports.auditLog = async (req, res) => res.json(await audit.recent(db));
