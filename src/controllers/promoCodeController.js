import { PromoCode } from '../models/PromoCode.js';

export const validate = async (req, res, next) => {
  try {
    const { code, originalAmount } = req.body;
    if (!code) return res.status(400).json({ message: 'Promo code is required' });
    const amount = Number(originalAmount) || 0;

    const promo = await PromoCode.findOne({ code: code.trim().toUpperCase() });
    if (!promo) return res.status(404).json({ message: 'Invalid promo code' });
    if (!promo.isActive) return res.status(400).json({ message: 'Promo code is not active' });

    const now = new Date();
    if (promo.validFrom && now < promo.validFrom) {
      return res.status(400).json({ message: 'Promo code is not yet valid' });
    }
    if (promo.validTo && now > promo.validTo) {
      return res.status(400).json({ message: 'Promo code has expired' });
    }
    if (promo.usageLimit != null && promo.usageCount >= promo.usageLimit) {
      return res.status(400).json({ message: 'Promo code usage limit reached' });
    }

    let discount = 0;
    if (promo.discountType === 'fixed') {
      discount = Math.min(promo.discountValue, amount);
    } else {
      discount = (amount * promo.discountValue) / 100;
    }
    const finalAmount = Math.max(0, amount - discount);

    res.json({
      valid: true,
      code: promo.code,
      discount,
      finalAmount,
      promoCodeId: promo._id,
    });
  } catch (err) {
    next(err);
  }
};
