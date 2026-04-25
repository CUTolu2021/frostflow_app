const { Router } = require('express');
const { healthHandler } = require('../controllers/healthController');

const router = Router();
router.get('/', healthHandler);

module.exports = { healthRoutes: router };
