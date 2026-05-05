import mongoose from 'mongoose';

const contentVisitSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    contentType: { type: String, enum: ['module', 'subject', 'topic', 'ospe'], required: true },
    contentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

// Indexes to speed up queries for analytics
contentVisitSchema.index({ createdAt: 1 });
contentVisitSchema.index({ user: 1, createdAt: 1 });
contentVisitSchema.index({ contentId: 1, contentType: 1 });

export const ContentVisit = mongoose.model('ContentVisit', contentVisitSchema);
