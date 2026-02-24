import mongoose from 'mongoose';
import { softDelete } from './plugins/softDelete.js';

// Single question within a station (no image here; station has the image)
const ospeQuestionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  type: {
    type: String,
    enum: ['text_mcq', 'picture_mcq', 'guess_until_correct', 'viva_written'],
    default: 'text_mcq',
  },
  options: [{ type: String }],
  correctIndex: { type: Number },
  expectedAnswer: { type: String },
}, { _id: true });

// Station: one picture, multiple questions
const ospeStationSchema = new mongoose.Schema({
  imageUrl: { type: String, trim: true },
  questions: [ospeQuestionSchema],
}, { _id: true });

// Legacy: flat questions (each could have its own image) - kept for backward compatibility
const ospeLegacyQuestionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  imageUrl: { type: String, trim: true },
  type: { type: String, enum: ['picture_mcq', 'viva_written'], required: true },
  options: [{ type: String }],
  correctIndex: { type: Number },
  expectedAnswer: { type: String },
}, { _id: true });

const ospeSchema = new mongoose.Schema(
  {
    module: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['picture_mcq', 'viva_written'] },
    stations: [ospeStationSchema],
    questions: [ospeLegacyQuestionSchema],
  },
  { timestamps: true }
);
softDelete(ospeSchema);

export const Ospe = mongoose.model('Ospe', ospeSchema);
