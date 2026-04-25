const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const required = ['JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

const decodeJwtRole = (token) => {
  const parts = String(token || '').split('.');
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    return payload?.role || null;
  } catch {
    return null;
  }
};

const supabaseRole = decodeJwtRole(process.env.SUPABASE_SERVICE_ROLE_KEY);
if (supabaseRole && supabaseRole !== 'service_role') {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is not a service_role key. Please use the service_role key from Supabase.');
}

const env = {
  apiPort: Number(process.env.API_PORT || 3001),
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS || 14),
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseSchema: process.env.SUPABASE_SCHEMA || 'frostflow_data',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  bootstrapAdminToken: process.env.BOOTSTRAP_ADMIN_TOKEN || '',
  frontendUrl: process.env.FRONTEND_URL || '',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || '',
  smtpSecure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
  reconciliationCutoffHourUtc: Number(process.env.RECONCILIATION_CUTOFF_HOUR_UTC || 20),
};

module.exports = { env };
