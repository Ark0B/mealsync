// Controllers translate HTTP <-> service calls. No business rules live here.
const auth = require('../services/auth.service');

exports.register = async (req, res) => res.status(201).json(await auth.register(req.body));
exports.login = async (req, res) => res.json(await auth.login(req.body));
exports.me = async (req, res) => res.json({ user: req.user });
