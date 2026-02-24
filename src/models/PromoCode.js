import mongoose from 'mongoose';
import { softDelete } from './plugins/softDelete.js';

const promoCodeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
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
promoCodeSchema.index({ code: 1 }, { unique: true, partialFilterExpression: { deleted: { $ne: true } } });
softDelete(promoCodeSchema);

export const PromoCode = mongoose.model('PromoCode', promoCodeSchema);
