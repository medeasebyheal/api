import mongoose from 'mongoose';
import { softDelete } from './plugins/softDelete.js';

const topicSchema = new mongoose.Schema(
  {
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    name: { type: String, required: true, trim: true },
    imageUrl: { type: String, trim: true },
    videoUrl: { type: String, trim: true },
    videoUrls: [{ type: String, trim: true }],
    content: { type: String, default: '' },
  },
  { timestamps: true }
);
softDelete(topicSchema);

// indexes
topicSchema.index({ subject: 1 });
topicSchema.index({ createdAt: 1 });

export const Topic = mongoose.model('Topic', topicSchema);
