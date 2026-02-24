import mongoose from 'mongoose';
import { softDelete } from './plugins/softDelete.js';

const programSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);
softDelete(programSchema);

export const Program = mongoose.model('Program', programSchema);
