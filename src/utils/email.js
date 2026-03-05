import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    console.warn('Gmail SMTP not configured (GMAIL_USER, GMAIL_APP_PASSWORD). Emails will not be sent.');
    return null;
  }
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
  return transporter;
}

const EMAIL_STYLES = `
  body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #334155; -webkit-font-smoothing: antialiased; }
  .wrapper { width: 100%; background-color: #f1f5f9; padding: 32px 16px; }
  .container { max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1); overflow: hidden; }
  .header { background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); padding: 28px 32px; text-align: center; }
  .brand { font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px; margin: 0; }
  .content { padding: 32px; }
  .greeting { font-size: 18px; font-weight: 600; color: #0f172a; margin: 0 0 16px 0; }
  .body-text { margin: 0 0 16px 0; color: #475569; }
  .body-text:last-child { margin-bottom: 0; }
  .highlight { background-color: #ccfbf1; color: #0f766e; padding: 2px 8px; border-radius: 6px; font-weight: 600; }
  .otp-box { display: inline-block; background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: 8px; padding: 16px 24px; border-radius: 12px; margin: 16px 0; }
  .reason-box { background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0; color: #991b1b; font-size: 15px; }
  .footer { padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b; text-align: center; }
  .footer a { color: #0d9488; text-decoration: none; font-weight: 500; }
  .divider { height: 1px; background-color: #e2e8f0; margin: 24px 0; }
  .status-badge { display: inline-block; padding: 6px 12px; border-radius: 9999px; font-size: 13px; font-weight: 600; }
  .status-success { background-color: #d1fae5; color: #065f46; }
  .status-pending { background-color: #fef3c7; color: #92400e; }
  .status-rejected { background-color: #fee2e2; color: #991b1b; }
`;

function wrapEmailHtml(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MEDEASE</title>
  <style>${EMAIL_STYLES}</style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1 class="brand">MEDEASE</h1>
      </div>
      <div class="content">
        ${content}
      </div>
      <div class="footer">
        This email was sent by MEDEASE. If you did not expect it, you can safely ignore it.
      </div>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendEmail({ to, subject, text, html }) {
  const trans = getTransporter();
  if (!trans) return { sent: false, error: 'Email not configured' };
  try {
    await trans.sendMail({
      from: process.env.GMAIL_USER,
      to,
      subject,
      text: text || undefined,
      html: html || undefined,
    });
    return { sent: true };
  } catch (err) {
    console.error('Send email error:', err);
    return { sent: false, error: err.message };
  }
}

export async function sendRegistrationConfirmation(email, name) {
  const safeName = escapeHtml(name);
  return sendEmail({
    to: email,
    subject: 'Welcome to MEDEASE',
    text: `Hi ${name}, you have successfully registered. Please complete payment and wait for admin verification to access content.`,
    html: wrapEmailHtml(`
      <p class="greeting">Hi ${safeName},</p>
      <p class="body-text">You have successfully registered on <span class="highlight">MEDEASE</span>.</p>
      <p class="body-text">Next steps:</p>
      <ul style="margin: 0 0 16px 0; padding-left: 24px; color: #475569;">
        <li style="margin-bottom: 8px;">Complete your package payment</li>
        <li style="margin-bottom: 8px;">Wait for admin verification</li>
        <li>Then you can access all your purchased content</li>
      </ul>
      <p class="body-text">We're glad to have you on board.</p>
    `),
  });
}

export async function sendPaymentReceived(email, name, subscriptionId) {
  const safeName = escapeHtml(name);
  const safeSub = escapeHtml(subscriptionId);
  return sendEmail({
    to: email,
    subject: 'MEDEASE – Payment received',
    text: `Hi ${name}, we have received your payment (Subscription ID: ${subscriptionId}). Your account will be activated after admin verification.`,
    html: wrapEmailHtml(`
      <p class="greeting">Hi ${safeName},</p>
      <p class="body-text">We have received your payment.</p>
      ${safeSub ? `<p class="body-text">Subscription ID: <span class="highlight">${safeSub}</span></p>` : ''}
      <p class="body-text"><span class="status-badge status-pending">Pending verification</span> — Your account will be activated after admin verification. We'll notify you as soon as it's done.</p>
      <div class="divider"></div>
      <p class="body-text">Thank you for choosing MEDEASE.</p>
    `),
  });
}

export async function sendPaymentApproved(email, name, subscriptionId) {
  const safeName = escapeHtml(name);
  const safeSub = escapeHtml(subscriptionId);
  return sendEmail({
    to: email,
    subject: 'MEDEASE – Payment approved, access activated',
    text: `Hi ${name}, your payment (Subscription ID: ${subscriptionId}) has been approved. You now have access to your purchased package.`,
    html: wrapEmailHtml(`
      <p class="greeting">Hi ${safeName},</p>
      <p class="body-text"><span class="status-badge status-success">Payment approved</span></p>
      ${safeSub ? `<p class="body-text">Subscription ID: <span class="highlight">${safeSub}</span></p>` : ''}
      <p class="body-text">Your payment has been approved. You now have full access to your purchased package. Log in to your account to start learning.</p>
      <div class="divider"></div>
      <p class="body-text">Happy studying!</p>
    `),
  });
}

export async function sendPaymentRejected(email, name, reason) {
  const safeName = escapeHtml(name);
  const safeReason = reason ? escapeHtml(reason) : '';
  return sendEmail({
    to: email,
    subject: 'MEDEASE – Payment not approved',
    text: `Hi ${name}, your payment could not be approved. ${reason ? `Reason: ${reason}` : ''}`,
    html: wrapEmailHtml(`
      <p class="greeting">Hi ${safeName},</p>
      <p class="body-text"><span class="status-badge status-rejected">Payment not approved</span></p>
      <p class="body-text">Your payment could not be approved at this time.</p>
      ${safeReason ? `<div class="reason-box"><strong>Reason:</strong> ${safeReason}</div>` : ''}
      <p class="body-text">If you have questions or would like to try again, please contact us or make a new payment.</p>
    `),
  });
}

export async function sendOtpVerification(email, otp, name) {
  const safeName = escapeHtml(name);
  const safeOtp = escapeHtml(otp);
  return sendEmail({
    to: email,
    subject: 'MEDEASE – Verify your email',
    text: `Hi ${name}, your verification code is ${otp}. It expires in 10 minutes.`,
    html: wrapEmailHtml(`
      <p class="greeting">Hi ${safeName},</p>
      <p class="body-text">Use the code below to verify your email:</p>
      <p style="text-align: center; margin: 20px 0;"><span class="otp-box">${safeOtp}</span></p>
      <p class="body-text">This code expires in <strong>10 minutes</strong>. If you did not request this, please ignore this email.</p>
    `),
  });
}

export async function sendAccountVerified(email, name) {
  const safeName = escapeHtml(name);
  return sendEmail({
    to: email,
    subject: 'MEDEASE – Account verified',
    text: `Hi ${name}, your account has been verified by admin.`,
    html: wrapEmailHtml(`
      <p class="greeting">Hi ${safeName},</p>
      <p class="body-text"><span class="status-badge status-success">Account verified</span></p>
      <p class="body-text">Your account has been verified by our team. You now have full access to MEDEASE. Log in and start learning.</p>
    `),
  });
}

export async function sendPasswordResetEmail(email, token, name) {
  const safeName = escapeHtml(name || '');
  const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
  return sendEmail({
    to: email,
    subject: 'MEDEASE – Reset your password',
    text: `Hi ${name || ''}, reset your password using this link: ${resetUrl}`,
    html: wrapEmailHtml(`
      <p class="greeting">Hi ${safeName || 'there'},</p>
      <p class="body-text">We received a request to reset your password. Click the button below to reset it. This link is valid for ${process.env.PASSWORD_RESET_EXPIRES_MINUTES || 60} minutes.</p>
      <div style="text-align:center; margin: 24px 0;">
        <a href="${resetUrl}" style="display:inline-block padding:12px 20px; border-radius:8px; background:linear-gradient(135deg,#0d9488,#0f766e); color:white; text-decoration:none; font-weight:600;">Reset password</a>
      </div>
      <p class="body-text">If you didn't request a password reset, you can safely ignore this email.</p>
    `),
  });
}
