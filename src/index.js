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
import bookmarksRoutes from './routes/bookmarks.js';
import analyticsRoutes from './routes/analytics.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ── Per-request DB connection (serverless-safe) ─────────────────────────
// On Vercel every cold start creates a fresh function instance. Instead of
// calling connectDB() at the top-level (which doesn't persist across
// invocations), we call it as middleware so every request ensures the
// cached connection is ready before hitting any handler.
app.use(async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'https://medease-api-qa.vercel.app',
  'https://medease-qa.vercel.app',
  'https://medeasebyheal.com',
  'https://www.medeasebyheal.com',
  'http://localhost:5173',
  'http://localhost:5174'
].filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    // allow requests with no origin (like curl, mobile apps, or server-to-server)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    // disallow other origins
    return cb(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Fallback CORS headers + safe preflight responder.
// Placed before any routes that might redirect so OPTIONS requests don't get redirected.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // allow non-browser clients (curl, server-to-server)
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  );

  if (req.method === 'OPTIONS') {
    // Respond to preflight immediately to avoid redirects or other side-effects
    return res.sendStatus(204);
  }

  next();
});

// Ensure preflight (OPTIONS) requests are handled by cors as well
app.options('*', cors(corsOptions));
app.set('etag', false);
app.use(express.json());

// ── Keepalive / health-check endpoint ───────────────────────────────────
// Set up a cron job (e.g. cron-job.org) to hit /api/ping every 5 minutes.
// This warms both the Vercel function and the MongoDB connection so cold
// starts don't hit real users.
app.get('/api/ping', async (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

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
app.use('/api/bookmarks', bookmarksRoutes);
app.use('/api/analytics', analyticsRoutes);

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
