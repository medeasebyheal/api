import mongoose from 'mongoose';
import { softDelete } from './plugins/softDelete.js';

const packageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Allow '-free' suffix variants for free-trial packages (e.g. 'year_half_part1-free')
    type: {
      type: String,
      enum: [
        'year_half_part1',
        'year_half_part2',
        'year_full',
        'master_proff',
        'single_module',
        'year_half_part1-free',
        'year_half_part2-free',
        'year_full-free',
        'master_proff-free',
        'single_module-free'
      ],
      required: true,
    },
    year: { type: Number },
    part: { type: Number },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
    moduleIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Module' }],
    proffPapers: [{ type: String }],
    price: { type: Number, default: 0 },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);
softDelete(packageSchema);

export const Package = mongoose.model('Package', packageSchema);
