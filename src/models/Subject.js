import mongoose from 'mongoose';

const subjectSchema = new mongoose.Schema(
  {
    module: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, default: 1 },
    topicIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Topic' }],
  },
  { timestamps: true }
);

export const Subject = mongoose.model('Subject', subjectSchema);
