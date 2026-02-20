import mongoose from 'mongoose';

const oneShotLectureSchema = new mongoose.Schema(
  {
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
    title: { type: String, required: true, trim: true },
    youtubeUrl: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const OneShotLecture = mongoose.model('OneShotLecture', oneShotLectureSchema);
