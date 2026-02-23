import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import paymentsRoutes from './routes/payments.js';
import packageApplyRoutes from './routes/packageApply.js';
import packagesRoutes from './routes/packages.js';
import contentRoutes from './routes/content.js';
import mcqsRoutes from './routes/mcqs.js';
import ospesRoutes from './routes/ospes.js';
import adminRoutes from './routes/admin.js';
import contactRoutes from './routes/contact.js';
import promoCodeRoutes from './routes/promoCode.js';

const app = express();
const PORT = process.env.PORT || 5000;

connectDB();

const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'https://medease-api-qa.vercel.app',
  'https://medease-qa.vercel.app',
].filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/package-apply', packageApplyRoutes);
app.use('/api/packages', packagesRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/mcqs', mcqsRoutes);
app.use('/api/ospes', ospesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/promo-codes', promoCodeRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

// Only listen when not on Vercel (serverless handles requests via api/index.js)
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
