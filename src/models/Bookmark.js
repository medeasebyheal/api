import mongoose from 'mongoose';

const BookmarkSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
    mcq: { type: mongoose.Schema.Types.ObjectId, ref: 'Mcq', required: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

BookmarkSchema.index({ user: 1, topic: 1, mcq: 1 }, { unique: true });

export const Bookmark = mongoose.models.Bookmark || mongoose.model('Bookmark', BookmarkSchema);

export default Bookmark;

