import mongoose from 'mongoose';

const mcqAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    mcq: { type: mongoose.Schema.Types.ObjectId, ref: 'Mcq', required: true },
    selectedIndex: { type: Number, required: true },
    correct: { type: Boolean, required: true },
  },
  { timestamps: true }
);

export const McqAttempt = mongoose.model('McqAttempt', mcqAttemptSchema);
