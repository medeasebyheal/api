import { Payment } from '../models/Payment.js';
import { PromoCode } from '../models/PromoCode.js';
import { UserPackage } from '../models/UserPackage.js';
import { User } from '../models/User.js';
import { Package } from '../models/Package.js';
import { Plan } from '../models/Plan.js';
import { sendPaymentApproved, sendPaymentRejected, sendAccountVerified, sendPaymentReceived } from '../utils/email.js';

export const create = async (req, res, next) => {
  try {
    const {
      packageId,
      amount,
      promoCode: promoCodeInput,
      institution,
      college,
      rollNumber,
      batch,
      year,
      part,
    } = req.body;
    const receiptUrl = req.file?.url;
    if (!receiptUrl) return res.status(400).json({ message: 'Receipt image is required' });
    const pkg = await Package.findById(packageId);
    if (!pkg) return res.status(404).json({ message: 'Package not found' });

    const originalAmount = Number(amount ?? pkg.price) || 0;
    let finalAmount = originalAmount;
    let appliedPromoId = null;

    if (promoCodeInput) {
      const promo = await PromoCode.findOne({
        code: String(promoCodeInput).trim().toUpperCase(),
      });
      if (promo && promo.isActive) {
        const now = new Date();
        if ((!promo.validFrom || now >= promo.validFrom) && (!promo.validTo || now <= promo.validTo)) {
          if (promo.usageLimit == null || promo.usageCount < promo.usageLimit) {
            const discount = promo.discountType === 'fixed'
              ? Math.min(promo.discountValue, originalAmount)
              : (originalAmount * promo.discountValue) / 100;
            finalAmount = Math.max(0, originalAmount - discount);
            appliedPromoId = promo._id;
          }
        }
      }
    }

    const academicDetails =
      institution != null || college != null || rollNumber != null || batch != null || year != null || part != null
        ? {
            institution: institution?.trim?.() || undefined,
            college: college?.trim?.() || undefined,
            rollNumber: rollNumber?.trim?.() || undefined,
            batch: batch?.trim?.() || undefined,
            year: year !== '' && year !== undefined ? Number(year) : undefined,
            part: part !== '' && part !== undefined ? Number(part) : undefined,
          }
        : undefined;

    const payment = await Payment.create({
      user: req.user._id,
      package: packageId,
      amount: finalAmount,
      originalAmount: appliedPromoId ? originalAmount : undefined,
      promoCode: appliedPromoId,
      receiptUrl,
      status: 'pending',
      ...(academicDetails && { academicDetails }),
    });

    if (appliedPromoId) {
      await PromoCode.findByIdAndUpdate(appliedPromoId, { $inc: { usageCount: 1 } });
    }

    await sendPaymentReceived(req.user.email, req.user.name);
    const populated = await Payment.findById(payment._id).populate('package').populate('promoCode');
    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
};

export const list = async (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      return res.status(403).json({ message: 'Access denied. Revenue and payments are only available to super admin.' });
    }
    const filter = req.user.role === 'superadmin' ? {} : { user: req.user._id };
    const payments = await Payment.find(filter)
      .populate('user', 'name email')
      .populate('package')
      .sort({ createdAt: -1 });
    res.json(payments);
  } catch (err) {
    next(err);
  }
};

export const verify = async (req, res, next) => {
  try {
    const { status, rejectionReason } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'status must be approved or rejected' });
    }
    const payment = await Payment.findById(req.params.id).populate('user').populate('package');
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    if (payment.status !== 'pending') {
      return res.status(400).json({ message: 'Payment already processed' });
    }
    payment.status = status;
    payment.verifiedBy = req.user._id;
    payment.verifiedAt = new Date();
    if (status === 'rejected') payment.rejectionReason = rejectionReason || '';
    await payment.save();

    if (status === 'approved') {
      await UserPackage.create({
        user: payment.user._id,
        package: payment.package._id,
        status: 'active',
        approvedAt: new Date(),
      });
      const pkg = await Package.findById(payment.package._id).populate('plan');
      let plan = pkg?.plan;
      if (!plan && pkg) {
        if (pkg.type === 'master_proff') {
          plan = await Plan.findOne({ planKey: 'master-proff' });
        } else {
          plan = await Plan.findOne({ year: pkg.year, part: pkg.part, type: pkg.type });
        }
      }
      const user = await User.findById(payment.user._id);
      if (plan) {
        user.activePlanId = plan._id;
      }
      if (!user.isVerified) {
        user.isVerified = true;
        await sendAccountVerified(user.email, user.name);
      }
      await user.save();
      await sendPaymentApproved(payment.user.email, payment.user.name);
    } else {
      await sendPaymentRejected(payment.user.email, payment.user.name, rejectionReason);
    }

    const updated = await Payment.findById(payment._id)
      .populate('user', 'name email')
      .populate('package');
    res.json(updated);
  } catch (err) {
    next(err);
  }
};
