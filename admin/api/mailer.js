'use strict';

const nodemailer = require('nodemailer');

// ─── Validate required config at startup ────────────────────────────────────
const REQUIRED = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_SENDER_EMAIL'];
const missing  = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(
    `[mailer] FATAL: Missing required env vars: ${missing.join(', ')}. ` +
    'Email sending will fail until these are set.'
  );
}

// ─── Build transporter (created once, reused for connection pooling) ─────────
const secure = String(process.env.SMTP_SECURE).toLowerCase() === 'true';

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT) || 587,
  secure,                          // true → port 465 TLS; false → STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Retry on transient network errors
  pool:             true,          // keep a connection pool
  maxConnections:   5,
  maxMessages:      100,
  // Timeouts (ms)
  connectionTimeout: 10_000,       // 10 s to establish TCP connection
  greetingTimeout:   10_000,       // 10 s for SMTP greeting
  socketTimeout:     30_000,       // 30 s of inactivity closes socket
  // TLS settings
  tls: {
    rejectUnauthorized: process.env.NODE_ENV === 'production', // strict in prod
  },
});

// Verify connection at boot (non-fatal — just logs)
transporter.verify((err) => {
  if (err) {
    console.error('[mailer] SMTP connection verification failed:', err.message);
  } else {
    console.log('[mailer] SMTP ready on', process.env.SMTP_HOST + ':' + (process.env.SMTP_PORT || 587));
  }
});

// ─── sendEmail ────────────────────────────────────────────────────────────────
/**
 * Send a transactional HTML email.
 *
 * @param {object} opts
 * @param {string}  opts.toEmail  Recipient address
 * @param {string} [opts.toName]  Recipient display name (optional)
 * @param {string}  opts.subject  Email subject
 * @param {string}  opts.html     HTML body
 * @returns {Promise<boolean>}    true on success, false on failure
 */
async function sendEmail({ toEmail, toName, subject, html }) {
  if (missing.length) {
    console.warn('[mailer] Skipping send — missing env vars:', missing.join(', '));
    return false;
  }

  const fromName  = process.env.SMTP_SENDER_NAME  || 'Nestcase';
  const fromEmail = process.env.SMTP_SENDER_EMAIL;

  const mailOptions = {
    from:    `"${fromName}" <${fromEmail}>`,
    to:      toName ? `"${toName}" <${toEmail}>` : toEmail,
    subject,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[mailer] Sent to ${toEmail} | messageId=${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[mailer] Failed to send to ${toEmail}:`, err.message);
    return false;
  }
}

module.exports = { sendEmail };