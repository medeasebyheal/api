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

const app = express();
const PORT = process.env.PORT || 5000;

connectDB();

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
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

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
