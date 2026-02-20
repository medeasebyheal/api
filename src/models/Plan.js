import mongoose from 'mongoose';

const planSchema = new mongoose.Schema(
  {
    planKey: {
      type: String,
      enum: ['free-trial', 'half-year', 'full-year', 'master-proff'],
      required: true,
      unique: true,
    },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['year_half_part1', 'year_half_part2', 'year_full', 'master_proff'],
      trim: true,
    },
    year: { type: Number },
    part: { type: Number },
    moduleIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Module' }],
    proffPapers: [{ type: String }],
    isFreeTrial: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Plan = mongoose.model('Plan', planSchema);
