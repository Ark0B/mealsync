// Everything a student does: plans, subscriptions, pass, skips, late plates, tokens, wallet.
const subscriptions = require('../services/subscriptions.service');
const payments = require('../services/payments.service');
const tokens = require('../services/tokens.service');
const meals = require('../services/meals.service');
const wallet = require('../services/wallet.service');
const passToken = require('../utils/passToken');
const { toId } = require('../utils/validate');

exports.plans = async (req, res) => res.json(await subscriptions.listPlans(req.user));
exports.mealPrices = async (req, res) => res.json(await tokens.prices());

exports.subscribe = async (req, res) => res.status(201).json(await subscriptions.create(req.user, req.body));
exports.mySubscriptions = async (req, res) => res.json(await subscriptions.mine(req.user.id));
exports.discardSubscription = async (req, res) => { await subscriptions.discardPending(req.user, toId(req.params.id)); res.status(204).end(); };
exports.requestCancel = async (req, res) => res.json(await subscriptions.requestCancel(req.user, toId(req.params.id)));

exports.mockCheckout = async (req, res) => res.json(await payments.mockCheckout(req.user, req.params.orderId));
exports.verifyPayment = async (req, res) => res.json(await payments.verify(req.user, req.body));
exports.myPayments = async (req, res) => res.json(await payments.mine(req.user.id));

exports.pass = async (req, res) => res.json(passToken.issue(req.user.id));

exports.skip = async (req, res) => res.status(201).json(await meals.createSkip(req.user, req.body));
exports.cancelSkip = async (req, res) => { await meals.cancelSkip(req.user, req.params.id); res.status(204).end(); };
exports.mySkips = async (req, res) => res.json(await meals.mySkips(req.user.id));
exports.latePlate = async (req, res) => res.status(201).json(await meals.createLatePlate(req.user, req.body));
exports.myLatePlates = async (req, res) => res.json(await meals.myLatePlates(req.user.id));
exports.mealHistory = async (req, res) => res.json(await meals.history(req.user.id));

exports.buyToken = async (req, res) => res.status(201).json(await tokens.buy(req.user, req.body));
exports.myTokens = async (req, res) => res.json(await tokens.mine(req.user.id));
exports.discardToken = async (req, res) => { await tokens.discardPending(req.user, req.params.id); res.status(204).end(); };

exports.wallet = async (req, res) => res.json({
  balance_paise: await wallet.balance(req.user.id),
  transactions: await wallet.history(req.user.id),
});
