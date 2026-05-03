import mongoose from 'mongoose';
import { softDelete } from './plugins/softDelete.js';

const moduleSchema = new mongoose.Schema(
  {
    year: { type: mongoose.Schema.Types.ObjectId, ref: 'Year', required: true },
    name: { type: String, required: true, trim: true },
    imageUrl: { type: String, trim: true, default: '' },
    subjectIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
    universityType: { type: String, enum: ['Other', 'DOW/KMU', 'Both'], default: 'Other' },
  },
  { timestamps: true }
);
softDelete(moduleSchema);

// indexes
moduleSchema.index({ year: 1 });
moduleSchema.index({ createdAt: 1 });

export const Module = mongoose.model('Module', moduleSchema);
