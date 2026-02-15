import mongoose from 'mongoose';

const programSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    order: { type: Number, required: true, default: 1 },
  },
  { timestamps: true }
);

export const Program = mongoose.model('Program', programSchema);
