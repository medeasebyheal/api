import mongoose from 'mongoose';

const topicAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
    score: { type: Number, required: true }, // Out of 100 or total correct
    totalMcqs: { type: Number, required: true },
    timeTakenSeconds: { type: Number, required: true },
  },
  { timestamps: true }
);

// Indexes
topicAttemptSchema.index({ user: 1, topic: 1 });
topicAttemptSchema.index({ createdAt: 1 });

export const TopicAttempt = mongoose.model('TopicAttempt', topicAttemptSchema);
