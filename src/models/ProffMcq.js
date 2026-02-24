import mongoose from 'mongoose';
import { softDelete } from './plugins/softDelete.js';

const proffMcqSchema = new mongoose.Schema(
  {
    university: { type: String, enum: ['jsmu', 'other'], required: true },
    proffYear: { type: mongoose.Schema.Types.ObjectId, required: true },
    proffPaper: { type: mongoose.Schema.Types.ObjectId },
    proffSubject: { type: mongoose.Schema.Types.ObjectId },
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctIndex: { type: Number, required: true },
    explanation: { type: String, default: '' },
    type: { type: String, enum: ['text', 'image', 'guess_until_correct'], default: 'text' },
    imageUrl: { type: String, trim: true },
  },
  { timestamps: true }
);

proffMcqSchema.index({ proffYear: 1, proffPaper: 1 });
proffMcqSchema.index({ proffYear: 1, proffSubject: 1 });
softDelete(proffMcqSchema);

export const ProffMcq = mongoose.model('ProffMcq', proffMcqSchema);
