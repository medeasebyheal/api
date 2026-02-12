import mongoose from 'mongoose';

const yearSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    order: { type: Number, required: true, default: 1 },
  },
  { timestamps: true }
);

export const Year = mongoose.model('Year', yearSchema);
