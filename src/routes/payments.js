import { Router } from 'express';
import multer from 'multer';
import { auth, requireRole } from '../middleware/auth.js';
import { uploadToCloudinary } from '../config/cloudinary.js';
import { create, list, verify } from '../controllers/paymentController.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post(
  '/',
  auth,
  requireRole('student'),
  upload.single('receipt'),
  async (req, res, next) => {
    if (!req.file) return res.status(400).json({ message: 'Receipt file required' });
    try {
      const result = await uploadToCloudinary(req.file.buffer, 'medease/receipts');
      req.file = { url: result.secure_url };
      next();
    } catch (err) {
      next(err);
    }
  },
  create
);

router.get('/', auth, list);

router.patch(
  '/:id/verify',
  auth,
  requireRole('admin'),
  verify
);

export default router;
