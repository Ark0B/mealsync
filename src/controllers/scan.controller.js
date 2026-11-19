const scans = require('../services/scans.service');

exports.scan = async (req, res) => res.json(await scans.scan(req.user, req.body));
exports.recent = async (req, res) => res.json(await scans.recentForStaff(req.user.id));
