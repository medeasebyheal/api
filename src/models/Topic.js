import mongoose from 'mongoose';
import { softDelete } from './plugins/softDelete.js';

const topicSchema = new mongoose.Schema(
  {
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    name: { type: String, required: true, trim: true },
    imageUrl: { type: String, trim: true },
    videoUrl: { type: String, trim: true },
    content: { type: String, default: '' },
  },
  { timestamps: true }
);
softDelete(topicSchema);

export const Topic = mongoose.model('Topic', topicSchema);
