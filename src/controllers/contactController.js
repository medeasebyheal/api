import Contact from '../models/Contact.js';
import escapeStringRegexp from 'escape-string-regexp';

export async function createContact(req, res, next) {
  try {
    const { name, email, phone, subject, message, packageInterest } = req.body;
    if (!email || !message) {
      return res.status(400).json({ message: 'Email and message are required' });
    }
    const contact = await Contact.create({
      name,
      email,
      phone,
      subject,
      message,
      packageInterest,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    return res.status(201).json({ id: contact._id });
  } catch (err) {
    next(err);
  }
}

export async function listContacts(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 200);
    const q = {};
    if (req.query.resolved === 'true') q.resolved = true;
    if (req.query.resolved === 'false') q.resolved = false;
    if (req.query.search) {
      const s = escapeStringRegexp(req.query.search);
      q.$or = [
        { name: { $regex: s, $options: 'i' } },
        { email: { $regex: s, $options: 'i' } },
        { subject: { $regex: s, $options: 'i' } },
      ];
    }
    const total = await Contact.countDocuments(q);
    const docs = await Contact.find(q)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    res.json({ docs, total, page, limit });
  } catch (err) {
    next(err);
  }
}

export async function markResolved(req, res, next) {
  try {
    const id = req.params.id;
    const contact = await Contact.findByIdAndUpdate(id, { resolved: true }, { new: true });
    if (!contact) return res.status(404).json({ message: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function deleteContact(req, res, next) {
  try {
    const id = req.params.id;
    await Contact.findByIdAndDelete(id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

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
