import mongoose from 'mongoose';

const mcqSchema = new mongoose.Schema(
  {
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctIndex: { type: Number, required: true },
    explanation: { type: String, default: '' },
    videoUrl: { type: String, trim: true },
    type: { type: String, enum: ['text', 'image', 'guess_until_correct'], default: 'text' },
    imageUrl: { type: String, trim: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Mcq = mongoose.model('Mcq', mcqSchema);
