import mongoose from 'mongoose';

const ContactSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  subject: { type: String, trim: true },
  message: { type: String, required: true, trim: true },
  packageInterest: { type: String, trim: true },
  resolved: { type: Boolean, default: false },
  ip: { type: String },
  userAgent: { type: String },
}, { timestamps: true });

const Contact = mongoose.models.Contact || mongoose.model('Contact', ContactSchema);
export default Contact;

