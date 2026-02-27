import mongoose from 'mongoose';

const ospeEaseGPTResponseSchema = new mongoose.Schema(
  {
    ospe: { type: mongoose.Schema.Types.ObjectId, ref: 'Ospe', required: true },
    questionIndex: { type: Number, required: true },
    message: { type: String, required: true, trim: true },
    reply: { type: String, required: true },
  },
  { timestamps: true }
);

// Unique per OSPE question + message
ospeEaseGPTResponseSchema.index({ ospe: 1, questionIndex: 1, message: 1 }, { unique: true });

export const OspeEaseGPTResponse = mongoose.model('OspeEaseGPTResponse', ospeEaseGPTResponseSchema);

