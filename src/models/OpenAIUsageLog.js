import mongoose from 'mongoose';

const OpenAIUsageLogSchema = new mongoose.Schema({
  tokens: { type: Number, default: 0 },
  timestamp: { type: Date, default: () => new Date() },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
});

OpenAIUsageLogSchema.index({ timestamp: 1 });

export const OpenAIUsageLog = mongoose.models.OpenAIUsageLog || mongoose.model('OpenAIUsageLog', OpenAIUsageLogSchema);

export default OpenAIUsageLog;

