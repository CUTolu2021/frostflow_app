const { Router } = require('express');
const { bootstrapPasswordHandler } = require('../controllers/bootstrapController');
const { authLimiter } = require('../middlewares/rateLimitMiddleware');

const router = Router();

router.post('/password', authLimiter, bootstrapPasswordHandler);

module.exports = { bootstrapRoutes: router };
