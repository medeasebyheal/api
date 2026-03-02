import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userAgent: { type: String, trim: true },
    ip: { type: String, trim: true },
    valid: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Session = mongoose.model('Session', sessionSchema);

