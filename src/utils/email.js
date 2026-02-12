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
  return sendEmail({
    to: email,
    subject: 'Welcome to MEDEASE',
    text: `Hi ${name}, you have successfully registered. Please complete payment and wait for admin verification to access content.`,
    html: `<p>Hi ${name},</p><p>You have successfully registered on MEDEASE. Complete your package payment and wait for admin verification to access content.</p>`,
  });
}

export async function sendPaymentReceived(email, name) {
  return sendEmail({
    to: email,
    subject: 'MEDEASE – Payment received',
    text: `Hi ${name}, we have received your payment. Your account will be activated after admin verification.`,
    html: `<p>Hi ${name},</p><p>We have received your payment. Your account will be activated after admin verification.</p>`,
  });
}

export async function sendPaymentApproved(email, name) {
  return sendEmail({
    to: email,
    subject: 'MEDEASE – Payment approved, access activated',
    text: `Hi ${name}, your payment has been approved. You now have access to your purchased package.`,
    html: `<p>Hi ${name},</p><p>Your payment has been approved. You now have access to your purchased package.</p>`,
  });
}

export async function sendPaymentRejected(email, name, reason) {
  return sendEmail({
    to: email,
    subject: 'MEDEASE – Payment not approved',
    text: `Hi ${name}, your payment could not be approved. ${reason ? `Reason: ${reason}` : ''}`,
    html: `<p>Hi ${name},</p><p>Your payment could not be approved. ${reason ? `<br/>Reason: ${reason}</p>` : '</p>'}`,
  });
}

export async function sendAccountVerified(email, name) {
  return sendEmail({
    to: email,
    subject: 'MEDEASE – Account verified',
    text: `Hi ${name}, your account has been verified by admin.`,
    html: `<p>Hi ${name},</p><p>Your account has been verified by admin.</p>`,
  });
}
