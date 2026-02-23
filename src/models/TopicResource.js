import mongoose from 'mongoose';

const topicResourceSchema = new mongoose.Schema(
  {
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
    type: { type: String, enum: ['pdf', 'link'], required: true },
    title: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const TopicResource = mongoose.model('TopicResource', topicResourceSchema);
