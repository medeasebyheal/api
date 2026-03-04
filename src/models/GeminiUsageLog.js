import mongoose from 'mongoose';

const GeminiUsageLogSchema = new mongoose.Schema({
  keyIndex: { type: Number, required: true },
  tokens: { type: Number, default: 0 },
  timestamp: { type: Date, default: () => new Date() },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
});

GeminiUsageLogSchema.index({ timestamp: 1 });
GeminiUsageLogSchema.index({ keyIndex: 1 });

export const GeminiUsageLog = mongoose.models.GeminiUsageLog || mongoose.model('GeminiUsageLog', GeminiUsageLogSchema);

export default GeminiUsageLog;

