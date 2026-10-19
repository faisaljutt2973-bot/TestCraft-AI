const nodemailer = require('nodemailer');

let transporter = null;
let transporterSignature = '';

const getConfig = () => ({
  host: process.env.SMTP_HOST || '',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@testcraft.ai',
});

const isConfigured = () => {
  const config = getConfig();
  return Boolean(config.host && config.user && config.pass);
};

const getTransporter = () => {
  if (!isConfigured()) return null;
  const config = getConfig();
  const signature = `${config.host}:${config.port}:${config.user}`;
  if (!transporter || signature !== transporterSignature) {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
    });
    transporterSignature = signature;
  }
  return transporter;
};

const sendMail = async ({ to, subject, text, html }) => {
  const client = getTransporter();
  if (!client) {
    console.log(`[Email] SMTP is not configured. Email to ${to} was not sent (${subject}).`);
    return { sent: false, reason: 'smtp_not_configured' };
  }
  try {
    await client.sendMail({
      from: getConfig().from,
      to,
      subject,
      text,
      html,
    });
    return { sent: true };
  } catch (err) {
    console.error('[Email] Failed to send email:', err.message);
    return { sent: false, reason: err.message };
  }
};

const getClientUrl = () => (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

module.exports = {
  sendMail,
  isConfigured,
  getClientUrl,
};
