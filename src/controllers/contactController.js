import { sendEmail } from '../utils/email.js';

export const submit = async (req, res, next) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ message: 'Name, email and message are required' });
    }
    const adminEmail = process.env.GMAIL_USER || process.env.CONTACT_EMAIL;
    if (!adminEmail) {
      return res.status(503).json({ message: 'Contact form not configured' });
    }
    await sendEmail({
      to: adminEmail,
      subject: `MEDEASE Contact from ${name}`,
      text: `From: ${name} <${email}>\n\n${message}`,
      html: `<p><strong>From:</strong> ${name} &lt;${email}&gt;</p><p>${message.replace(/\n/g, '<br/>')}</p>`,
    });
    res.json({ message: 'Message sent' });
  } catch (err) {
    next(err);
  }
};
