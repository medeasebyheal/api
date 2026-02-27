import mongoose from 'mongoose';
import { softDelete } from './plugins/softDelete.js';

const mcqSchema = new mongoose.Schema(
  {
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctIndex: { type: Number, required: true },
    explanation: { type: String, default: '' },
    type: { type: String, enum: ['text', 'image', 'guess_until_correct'], default: 'text' },
    imageUrl: { type: String, trim: true },
  imageDescription: { type: String, trim: true },
  },
  { timestamps: true }
);
softDelete(mcqSchema);

export const Mcq = mongoose.model('Mcq', mcqSchema);
