import mongoose from 'mongoose';
import { softDelete } from './plugins/softDelete.js';

const subjectSchema = new mongoose.Schema(
  {
    module: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true },
    name: { type: String, required: true, trim: true },
    imageUrl: { type: String, trim: true },
    topicIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Topic' }],
  },
  { timestamps: true }
);
softDelete(subjectSchema);

export const Subject = mongoose.model('Subject', subjectSchema);
