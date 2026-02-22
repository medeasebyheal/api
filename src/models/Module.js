import mongoose from 'mongoose';

const moduleSchema = new mongoose.Schema(
  {
    year: { type: mongoose.Schema.Types.ObjectId, ref: 'Year', required: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, default: 1 },
    imageUrl: { type: String, trim: true, default: '' },
    subjectIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
  },
  { timestamps: true }
);

export const Module = mongoose.model('Module', moduleSchema);
