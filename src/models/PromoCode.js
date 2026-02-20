import mongoose from 'mongoose';

const promoCodeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, unique: true, uppercase: true },
    discountType: { type: String, enum: ['fixed', 'percent'], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    validFrom: { type: Date },
    validTo: { type: Date },
    usageLimit: { type: Number, default: null },
    usageCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const PromoCode = mongoose.model('PromoCode', promoCodeSchema);
