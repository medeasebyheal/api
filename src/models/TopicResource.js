import mongoose from 'mongoose';
import { softDelete } from './plugins/softDelete.js';

const topicResourceSchema = new mongoose.Schema(
  {
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
    type: { type: String, enum: ['pdf', 'link'], required: true },
    title: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);
softDelete(topicResourceSchema);

export const TopicResource = mongoose.model('TopicResource', topicResourceSchema);
