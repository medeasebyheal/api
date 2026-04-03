
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { softDelete } from './plugins/softDelete.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    contact: {
      type: String,
      trim: true,

    },
    role: { type: String, enum: ['student', 'admin', 'superadmin'], default: 'student' },
    isVerified: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    freeTrialUsed: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', default: null },
    activePlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', default: null },
    avatarUrl: { type: String, trim: true },
    university: { type: String, trim: true },
    college: { type: String, trim: true },
    academicDetails: {
      institution: String,
      year: Number,
      rollNumber: String,
      batch: String,
    },
    // Study streak tracking
    studyStreakDays: { type: Number, default: 0 },
    studyStreakLastDate: { type: Date, default: null },
    studyStreakGoal: { type: Number, default: 30 },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { deleted: { $ne: true } } });
softDelete(userSchema);

export const User = mongoose.model('User', userSchema);
