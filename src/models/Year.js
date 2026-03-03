import mongoose from 'mongoose';
import { softDelete } from './plugins/softDelete.js';

const yearSchema = new mongoose.Schema(
  {
    program: { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);
softDelete(yearSchema);

// index for sorting/faster retrieval
yearSchema.index({ createdAt: 1 });

export const Year = mongoose.model('Year', yearSchema);
