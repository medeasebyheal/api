import mongoose from 'mongoose';

const userPackageSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    package: { type: mongoose.Schema.Types.ObjectId, ref: 'Package', required: true },
    status: { type: String, enum: ['active', 'expired'], default: 'active' },
    approvedAt: { type: Date, required: true },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

export const UserPackage = mongoose.model('UserPackage', userPackageSchema);
