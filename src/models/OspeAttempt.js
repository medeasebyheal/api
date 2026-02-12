import mongoose from 'mongoose';

const ospeAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ospe: { type: mongoose.Schema.Types.ObjectId, ref: 'Ospe', required: true },
    answers: [{
      questionIndex: Number,
      selectedIndex: Number,
      writtenAnswer: String,
      correct: Boolean,
    }],
  },
  { timestamps: true }
);

export const OspeAttempt = mongoose.model('OspeAttempt', ospeAttemptSchema);
