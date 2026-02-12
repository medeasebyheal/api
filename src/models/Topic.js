import mongoose from 'mongoose';

const topicSchema = new mongoose.Schema(
  {
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, default: 1 },
    videoUrl: { type: String, trim: true },
    content: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Topic = mongoose.model('Topic', topicSchema);
