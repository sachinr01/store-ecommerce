const crypto = require("crypto");
const https = require("https");
const db = require("../config/db");
const { sendEmail: sendBrevoEmail } = require('./mailer');

const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:3001").replace(/\/+$/, "");
const NEWSLETTER_TOKEN_SECRET = process.env.NEWSLETTER_TOKEN_SECRET || process.env.SESSION_SECRET || "newsletter-secret";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const NEWSLETTER_TABLE = "tbl_newsletter_subscribers";

function base64UrlEncode(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signTokenPayload(payload) {
  return crypto
    .createHmac("sha256", NEWSLETTER_TOKEN_SECRET)
    .update(payload)
    .digest("base64url");
}

function createVerificationToken(email) {
  const payload = base64UrlEncode(JSON.stringify({
    email,
    exp: Date.now() + TOKEN_TTL_MS,
  }));
  return `${payload}.${signTokenPayload(payload)}`;
}

function readVerificationToken(token) {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) return null;

  const expected = signTokenPayload(payload);
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payload));
    const email = String(parsed.email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(email) || Number(parsed.exp) < Date.now()) return null;
    return { email };
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


function subscribeBrevoContact(email) {
  return new Promise((resolve) => {
    if (!BREVO_API_KEY) {
      console.warn("Brevo newsletter contact sync not configured.");
      return resolve(false);
    }

    const payload = {
      email,
      updateEnabled: true,
    };

    if (Number.isInteger(BREVO_NEWSLETTER_LIST_ID) && BREVO_NEWSLETTER_LIST_ID > 0) {
      payload.listIds = [BREVO_NEWSLETTER_LIST_ID];
    }

    const body = JSON.stringify(payload);
    const req = https.request(
      {
        method: "POST",
        hostname: "api.brevo.com",
        port: 443,
        path: "/v3/contacts",
        headers: {
          "api-key": BREVO_API_KEY,
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let responseBody = "";
        res.on("data", (chunk) => (responseBody += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve(true);
          console.error("Brevo newsletter contact sync failed:", res.statusCode, responseBody);
          resolve(false);
        });
      }
    );

    req.on("error", (err) => {
      console.error("Brevo newsletter contact sync error:", err);
      resolve(false);
    });
    req.write(body);
    req.end();
  });
}

function verificationTemplate(email, verifyUrl) {
  const safeEmail = escapeHtml(email);
  const safeUrl = escapeHtml(verifyUrl);

  return `
    <div style="margin:0; padding:0; background:#f5efe8;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f5efe8; padding:32px 0;">
        <tr>
          <td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" width="620" style="max-width:620px; background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #eadfce;">
              <tr>
                <td style="background:#22311d; color:#ffffff; padding:24px 28px; font-family:Arial, sans-serif; font-size:22px; font-weight:700; letter-spacing:1px;">
                  NESTCASE.IN
                </td>
              </tr>
              <tr>
                <td style="padding:28px; font-family:Arial, sans-serif; color:#1b1b1b; line-height:1.6;">
                  <p style="margin:0 0 18px;">Just one more step!
                    Please verify your email address so we can send you updates.</p>
                  <p style="margin:0 0 22px;">
                    <a href="${safeUrl}" style="background:#22311d; color:#ffffff; display:inline-block; padding:12px 20px; border-radius:6px; text-decoration:none; font-weight:700;">Verify Email</a>
                  </p>
                  <p style="margin:0; color:#666; font-size:13px;">If you did not request this, you can ignore this email.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

async function subscribeNewsletter(req, res) {
  const email = String(req.body?.email || "").trim().toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ success: false, message: "Please enter a valid email address." });
  }

  try {
    const [[subscriber]] = await db.query(
      `SELECT id FROM tbl_newsletter_subscribers WHERE email = ? LIMIT 1`,
      [email]
    );

    if (subscriber) {
      return res.json({ success: true, message: "You're already on the list!" });
    }

    const verifyUrl = `${FRONTEND_URL.replace(/\/+$/, "")}/api/newsletter/verify/${createVerificationToken(email)}`;
    const sent = await sendBrevoEmail({
      toEmail: email,
      subject: "Verify your NESTCASE.IN newsletter subscription",
      html: verificationTemplate(email, verifyUrl),
    });

    if (!sent) {
      return res.status(500).json({ success: false, message: "Could not send verification email. Please try again." });
    }

    return res.json({ success: true, message: "We've sent a verification email. Please check your inbox and click the link to confirm your account. Don't see it? Check your spam folder or resend email." });
  } catch (err) {
    console.error("Newsletter subscribe failed:", err);
    return res.status(500).json({ success: false, message: "Could not subscribe right now. Please try again." });
  }
}

async function verifyNewsletter(req, res) {
  const token = String(req.params?.token || "").trim();

  if (!token) {
    return res.status(400).send("Invalid verification link.");
  }

  try {
    const verifiedToken = readVerificationToken(token);
    const verified = Boolean(verifiedToken);

    if (verifiedToken) {
  
      // Check first — avoids burning AUTO_INCREMENT on duplicate key
      const [[existing]] = await db.query(
        `SELECT id, verified_at FROM tbl_newsletter_subscribers WHERE email = ? LIMIT 1`,
        [verifiedToken.email]
      );

      if (!existing) {
        // New subscriber — insert only after email is verified
        await db.execute(
          `INSERT INTO tbl_newsletter_subscribers (email, verified_at) VALUES (?, NOW())`,
          [verifiedToken.email]
        );
      } else if (!existing.verified_at) {
        // Edge case: row exists but not yet verified — mark it now
        await db.execute(
          `UPDATE tbl_newsletter_subscribers SET verified_at = NOW() WHERE id = ?`,
          [existing.id]
        );
      }
      // Already verified — do nothing, no AUTO_INCREMENT burned
    }

    res.status(verified ? 200 : 400).send(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${verified ? "Newsletter Verified" : "Verification Link Expired"}</title>
        </head>
        <body style="font-family:Arial,sans-serif; background:#f5efe8; color:#22311d; display:grid; min-height:100vh; place-items:center; margin:0;">
          <main style="background:#fff; border:1px solid #eadfce; border-radius:12px; padding:32px; max-width:520px; text-align:center;">
            <h1 style="margin:0 0 12px;">${verified ? "You're in!" : "Verification link expired"}</h1>
            <p style="margin:0 0 20px; color:#333;">${verified ? "Thanks for subscribing to NESTCASE.IN updates." : "Please submit the newsletter form again to receive a fresh link."}</p>
            <a href="${escapeHtml(FRONTEND_URL)}" style="color:#22311d; font-weight:700;">Back to NESTCASE.IN</a>
          </main>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("Newsletter verification failed:", err);
    res.status(500).send("Could not verify email right now. Please try again.");
  }
}

module.exports = { subscribeNewsletter, verifyNewsletter };