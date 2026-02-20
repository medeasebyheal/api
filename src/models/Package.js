import mongoose from 'mongoose';

const packageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['year_half_part1', 'year_half_part2', 'year_full', 'master_proff'], required: true },
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

export const Package = mongoose.model('Package', packageSchema);
