import mongoose from 'mongoose';

const ospeQuestionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  imageUrl: { type: String, trim: true },
  type: { type: String, enum: ['picture_mcq', 'viva_written'], required: true },
  options: [{ type: String }],
  correctIndex: { type: Number },
  expectedAnswer: { type: String },
  order: { type: Number, default: 0 },
}, { _id: true });

const ospeSchema = new mongoose.Schema(
  {
    module: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['picture_mcq', 'viva_written'], default: 'picture_mcq' },
    questions: [ospeQuestionSchema],
    order: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export const Ospe = mongoose.model('Ospe', ospeSchema);
