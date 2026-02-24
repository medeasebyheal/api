import mongoose from 'mongoose';
import { softDelete } from './plugins/softDelete.js';

const oneShotLectureSchema = new mongoose.Schema(
  {
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    title: { type: String, required: true, trim: true },
    youtubeUrl: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);
softDelete(oneShotLectureSchema);

export const OneShotLecture = mongoose.model('OneShotLecture', oneShotLectureSchema);
