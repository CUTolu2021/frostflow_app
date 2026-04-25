const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { env } = require('../config/env');

const ACCESS_TOKEN_TYPE = 'access';

const hashToken = (plainToken) => crypto.createHash('sha256').update(plainToken).digest('hex');

const generateRefreshToken = () => crypto.randomBytes(64).toString('hex');

const hashPassword = async (plainPassword) => bcrypt.hash(plainPassword, 12);

const verifyPassword = async (plainPassword, passwordHash) =>
  bcrypt.compare(plainPassword, passwordHash);

const issueAccessToken = (user, sessionId) =>
  jwt.sign(
    {
      typ: ACCESS_TOKEN_TYPE,
      sub: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
      organization_id: user.organization_id || null,
      sid: sessionId,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );

const verifyAccessToken = (token) => jwt.verify(token, env.jwtSecret);

const getRefreshExpiry = () => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.refreshTokenTtlDays);
  return expiresAt.toISOString();
};

const generateTempPassword = () => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%';
  const all = upper + lower + digits + symbols;

  const pick = (chars) => chars[crypto.randomInt(0, chars.length)];
  const base = [
    pick(upper),
    pick(lower),
    pick(digits),
    pick(symbols),
  ];
  for (let i = 0; i < 8; i += 1) {
    base.push(pick(all));
  }

  // Shuffle
  for (let i = base.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [base[i], base[j]] = [base[j], base[i]];
  }
  return base.join('');
};

module.exports = {
  ACCESS_TOKEN_TYPE,
  generateRefreshToken,
  getRefreshExpiry,
  generateTempPassword,
  hashPassword,
  hashToken,
  issueAccessToken,
  verifyAccessToken,
  verifyPassword,
};
