import { Payment } from '../models/Payment.js';
import { UserPackage } from '../models/UserPackage.js';
import { User } from '../models/User.js';
import { Package } from '../models/Package.js';
import { sendPaymentApproved, sendPaymentRejected, sendAccountVerified, sendPaymentReceived } from '../utils/email.js';

export const create = async (req, res, next) => {
  try {
    const { packageId, amount } = req.body;
    const receiptUrl = req.file?.url;
    if (!receiptUrl) return res.status(400).json({ message: 'Receipt image is required' });
    const pkg = await Package.findById(packageId);
    if (!pkg) return res.status(404).json({ message: 'Package not found' });
    const payment = await Payment.create({
      user: req.user._id,
      package: packageId,
      amount: amount ?? pkg.price,
      receiptUrl,
      status: 'pending',
    });
    await sendPaymentReceived(req.user.email, req.user.name);
    const populated = await Payment.findById(payment._id).populate('package');
    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
};

export const list = async (req, res, next) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { user: req.user._id };
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
      const user = await User.findById(payment.user._id);
      if (!user.isVerified) {
        user.isVerified = true;
        await user.save();
        await sendAccountVerified(user.email, user.name);
      }
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
