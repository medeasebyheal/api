import { Router } from 'express';
import multer from 'multer';
import { body, validationResult } from 'express-validator';
import { auth } from '../middleware/auth.js';
import { authApiLimiter } from '../middleware/publicRateLimit.js';
import { register, login, me, createAdmin, verifyOtp, updateProfile, updateProfilePicture, logout, forgotPassword, resetPassword } from '../controllers/authController.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.post(
  '/register',
  authApiLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validate,
  register
);

router.post(
  '/verify-otp',
  authApiLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('otp').trim().notEmpty().withMessage('OTP is required'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validate,
  verifyOtp
);

router.post(
  '/login',
  authApiLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  validate,
  login
);

router.get('/me', auth, me);
router.patch('/profile', auth, updateProfile);
router.patch(
  '/profile-picture',
  auth,
  upload.single('avatar'),
  updateProfilePicture
);

router.post('/logout', auth, logout);
router.post('/forgot-password', authApiLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
], validate, forgotPassword);

router.post('/reset-password', [
  body('token').trim().notEmpty().withMessage('Token is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], validate, resetPassword);

router.post(
  '/create-admin',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').optional().trim(),
    body('contact').optional().trim(),
    body('secret').optional().trim(),
  ],
  validate,
  createAdmin
);

export default router;
