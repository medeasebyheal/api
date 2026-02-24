import mongoose from 'mongoose';

const paperSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['mcq', 'ospe'], required: true },
}, { _id: true });

const proffSubjectSchema = new mongoose.Schema(
  { name: { type: String } },
  { _id: true }
);

const proffYearSchema = new mongoose.Schema(
  {
    name: { type: String },
    papers: [paperSchema],
    subjects: [proffSubjectSchema],
  },
  { _id: true }
);

const proffStructureSchema = new mongoose.Schema(
  {
    university: { type: String, enum: ['jsmu', 'other'], required: true, unique: true },
    papers: [paperSchema],
    years: [proffYearSchema],
  },
  { timestamps: true }
);

export const ProffStructure = mongoose.model('ProffStructure', proffStructureSchema);
