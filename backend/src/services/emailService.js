const nodemailer = require('nodemailer');
const { env } = require('../config/env');

let transporter = null;

const isConfigured = () => Boolean(env.smtpUser && env.smtpPass && (env.smtpHost || env.smtpUser.includes('@gmail.com')));

const buildTransporter = () => {
  if (!isConfigured()) return null;
  if (transporter) return transporter;

  if (env.smtpHost) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass,
      },
    });
    return transporter;
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });
  return transporter;
};

const sendEmail = async ({ to, subject, text, html }) => {
  if (!to || !subject || (!text && !html)) {
    throw new Error('sendEmail requires to, subject and text/html');
  }

  const mailer = buildTransporter();
  if (!mailer) {
    console.warn('[email] SMTP is not configured. Skipping outbound email.');
    return { skipped: true, reason: 'smtp_not_configured' };
  }

  const fromAddress = env.smtpFrom || env.smtpUser;
  const info = await mailer.sendMail({
    from: fromAddress,
    to,
    subject,
    text,
    html,
  });

  return {
    skipped: false,
    messageId: info.messageId,
    accepted: info.accepted || [],
  };
};

module.exports = {
  sendEmail,
};
