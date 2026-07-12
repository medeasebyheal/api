import mongoose from 'mongoose';
import { softDelete } from './plugins/softDelete.js';

const subjectResourceSchema = new mongoose.Schema(
  {
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    type: { type: String, enum: ['pdf', 'link'], required: true },
    title: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);
softDelete(subjectResourceSchema);

export const SubjectResource = mongoose.model('SubjectResource', subjectResourceSchema);
