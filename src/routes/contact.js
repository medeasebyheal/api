import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { contactLimiter } from '../middleware/publicRateLimit.js';
import { auth, requireRole } from '../middleware/auth.js';
import { createContact, listContacts, markResolved, deleteContact } from '../controllers/contactController.js';

const router = Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

// Public endpoint to create contact
router.post(
  '/',
  contactLimiter,
  [
    body('name').optional().trim().escape(),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('phone').optional().trim().escape(),
    body('subject').optional().trim().escape(),
    body('message').trim().notEmpty().withMessage('Message is required').escape(),
    body('packageInterest').optional().trim().escape(),
  ],
  validate,
  createContact
);

// Admin endpoints
router.get('/', auth, requireRole('admin'), listContacts);
router.post('/:id/resolve', auth, requireRole('admin'), markResolved);
router.delete('/:id', auth, requireRole('admin'), deleteContact);

export default router;
