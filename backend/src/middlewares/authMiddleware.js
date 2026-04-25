const { findById } = require('../repositories/usersRepository');
const { getOrganizationById } = require('../repositories/organizationsRepository');
const { verifyAccessToken } = require('../utils/security');
const { HttpError } = require('../utils/httpError');

const requireAuth = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token) {
      throw new HttpError(401, 'Missing bearer token');
    }

    const payload = verifyAccessToken(token);
    const user = await findById(payload.sub);

    if (!user) {
      throw new HttpError(401, 'Invalid token user');
    }

    if (user.role !== 'superadmin') {
      if (!user.organization_id) {
        throw new HttpError(403, 'User is missing organization context');
      }
      if (payload.organization_id && payload.organization_id !== user.organization_id) {
        throw new HttpError(401, 'Token organization mismatch');
      }
      const org = await getOrganizationById({ organizationId: user.organization_id });
      if (org.is_active === false) {
        throw new HttpError(403, 'Organization disabled');
      }
      user.organization_name = org.name;
    }

    if (user.is_active === false) {
      throw new HttpError(403, 'Account disabled');
    }

    req.user = user;
    req.auth = { sessionId: payload.sid };
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new HttpError(401, 'Invalid or expired token'));
    }
    return next(error);
  }
};

module.exports = { requireAuth };
