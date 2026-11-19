// Complaints, ratings, menu, polls — shared by students, committee and manager.
const complaints = require('../services/complaints.service');
const ratings = require('../services/ratings.service');
const menu = require('../services/menu.service');
const polls = require('../services/polls.service');
const { toId } = require('../utils/validate');

exports.createComplaint = async (req, res) => res.status(201).json(await complaints.create(req.user, req.body));
exports.myComplaints = async (req, res) => res.json(await complaints.mine(req.user.id));
exports.allComplaints = async (req, res) => res.json(await complaints.list(req.query));
exports.updateComplaint = async (req, res) => res.json(await complaints.updateStatus(req.user, toId(req.params.id), req.body));

exports.rate = async (req, res) => res.status(201).json(await ratings.rate(req.user, req.body));
exports.ratingSummary = async (req, res) => res.json(await ratings.summary(Number(req.query.days) || 30));

exports.menuWeek = async (req, res) => res.json(await menu.week());
exports.menuToday = async (req, res) => res.json(await menu.todays());
exports.setMenuItem = async (req, res) => res.json(await menu.setItem(req.user, req.body));

exports.listPolls = async (req, res) => res.json(await polls.list(req.user.id));
exports.getPoll = async (req, res) => res.json(await polls.get(toId(req.params.id), req.user.id));
exports.createPoll = async (req, res) => res.status(201).json(await polls.create(req.user, req.body));
exports.vote = async (req, res) => res.json(await polls.vote(req.user, toId(req.params.id), req.body));
exports.closePoll = async (req, res) => res.json(await polls.close(req.user, toId(req.params.id)));
