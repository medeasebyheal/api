import mongoose from 'mongoose';

const easeGPTResponseSchema = new mongoose.Schema(
  {
    mcq: { type: mongoose.Schema.Types.ObjectId, ref: 'Mcq', required: true },
    message: { type: String, required: true, trim: true },
    reply: { type: String, required: true },
  },
  { timestamps: true }
);

easeGPTResponseSchema.index({ mcq: 1, message: 1 }, { unique: true });

export const EaseGPTResponse = mongoose.model('EaseGPTResponse', easeGPTResponseSchema);
