import mongoose from 'mongoose';

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

const ospeStationSchema = new mongoose.Schema({
  imageUrl: { type: String, trim: true },
  questions: [ospeQuestionSchema],
}, { _id: true });

const ospeLegacyQuestionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  imageUrl: { type: String, trim: true },
  type: { type: String, enum: ['picture_mcq', 'viva_written'], required: true },
  options: [{ type: String }],
  correctIndex: { type: Number },
  expectedAnswer: { type: String },
}, { _id: true });

const proffOspeSchema = new mongoose.Schema(
  {
    university: { type: String, enum: ['jsmu', 'other'], required: true },
    proffYear: { type: mongoose.Schema.Types.ObjectId, required: true },
    proffPaper: { type: mongoose.Schema.Types.ObjectId },
    proffSubject: { type: mongoose.Schema.Types.ObjectId },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['picture_mcq', 'viva_written'] },
    stations: [ospeStationSchema],
    questions: [ospeLegacyQuestionSchema],
  },
  { timestamps: true }
);

export const ProffOspe = mongoose.model('ProffOspe', proffOspeSchema);
