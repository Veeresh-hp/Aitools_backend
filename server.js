// server.js (FINAL - paste exactly into VS Code)
//
// Updated: consistent `path` usage, uploads dir creation, static serving before routes,
// improved /api/test-email with helpful hints, global error handler, and minor cleanups.
// NOTE: For local preview image (you uploaded an image), the absolute path is included below.
// That path is: /mnt/data/c5f7f900-1f71-4392-ab86-dc5f6ceedddb.png
// (If you want to use this in production emails, replace with a public HTTPS URL or set EMAIL_LOGO_URL)

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const cron = require('node-cron');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const contactRoutes = require('./routes/contact');
const newsletterRoutes = require('./routes/newsletter');
const toolRoutes = require('./routes/tools');
const categoryRoutes = require('./routes/categories');
const adminRoutes = require('./routes/adminRoutes'); // New admin routes
const { checkEnv } = require('./utils/envCheck');
const { initScheduler } = require('./utils/scheduler'); // Email scheduler
const { initNewsScheduler } = require('./utils/newsScheduler'); // Blog scheduler
const { sendEmail } = require('./utils/emailService');

const app = express();
checkEnv();

// Initialize Schedulers
initScheduler();
initNewsScheduler();

// Ensure uploads directory exists (create if missing)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Trust proxy (useful on Render/proxy hosting)
app.set('trust proxy', 1);

// -------------------------
// CORS configuration
// -------------------------
const allowedOrigins = [
  'https://ai-tools-rj5xk8ao0-veeresh-h-ps-projects.vercel.app',
  'https://ai-tools-7bbauireq-veeresh-h-ps-projects.vercel.app',
  'https://ai-tools-3rvvq91dm-veeresh-h-ps-projects.vercel.app',
  'https://ai-alltools.vercel.app',
  'https://myalltools.vercel.app',
  'https://ai-tools-seven-jet.vercel.app',
  'https://www.myalltools.shop',
  'https://myalltools.shop',
  'http://localhost:3000',
  'http://localhost:3001'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) {
      // Allow non-browser clients like curl/postman
      callback(null, true);
      return;
    }
    const isVercelPreview = !!origin.match(/^https:\/\/ai-tools-[a-z0-9]+-veeresh-h-ps-projects\.vercel\.app$/);
    if (allowedOrigins.includes(origin) || isVercelPreview) {
      callback(null, true);
    } else {
      callback(new Error(`❌ CORS blocked from origin: ${origin}`));
    }
  },
  credentials: true,
}));

// Handle OPTIONS preflight globally
app.options('*', cors({
  origin: function (origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    const isVercelPreview = !!origin.match(/^https:\/\/ai-tools-[a-z0-9]+-veeresh-h-ps-projects\.vercel\.app$/);
    if (allowedOrigins.includes(origin) || isVercelPreview) {
      callback(null, true);
    } else {
      callback(new Error(`❌ CORS preflight blocked from origin: ${origin}`));
    }
  },
  credentials: true,
}));

// -------------------------
// Security, parsers, rate-limit
// -------------------------
app.use(express.json());
app.use(helmet({ crossOriginResourcePolicy: false }));

const genericLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(genericLimiter);

// -------------------------
// Serve uploads publicly (static) - placed early so static assets are quickly served
// Cache-Control helps with client/CDN caching
// -------------------------
app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res, filePath) => {
    res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
  }
}));

// -------------------------
// API Routes
// -------------------------
app.use('/api/tools', toolRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/stacks', require('./routes/stacks'));
app.use('/api/articles', require('./routes/articles'));
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', require('./routes/reports'));

// Health check
app.get('/', (req, res) => {
  res.send('✅ Backend working!');
});

// -------------------------
// MongoDB connection with retry logic
// -------------------------
mongoose.connect(process.env.MONGO_URI, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  retryWrites: true,
})
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    console.error('📝 Retrying connection in 10 seconds...');
    setTimeout(() => {
      mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      }).catch(retryErr => {
        console.error('❌ Retry failed:', retryErr.message);
        console.error('⚠️ Check MongoDB Atlas and IP whitelist');
      });
    }, 10000);
  });

mongoose.connection.on('connected', () => console.log('✅ Mongoose connected to MongoDB'));
mongoose.connection.on('error', (err) => console.error('❌ Mongoose connection error:', err));
mongoose.connection.on('disconnected', () => console.warn('⚠️ Mongoose disconnected from MongoDB'));

// -------------------------
// Cron jobs are handled by utils/scheduler.js
// -------------------------

// -------------------------
// Test email route (helpful hints & DEV override)
// -------------------------
app.get('/api/test-email', async (req, res) => {
  try {
    const testRecipient = process.env.DEV_TEST_EMAIL || 'aitoolshub2@gmail.com';
    await sendEmail({
      to: testRecipient,
      subject: '✅ Test email from AI Tools Hub (Resend)',
      html: '<p>If you see this, Resend is working correctly! 🎉</p>',
    });
    res.json({ success: true, message: 'Test email sent.' });
  } catch (err) {
    console.error('❌ Test email failed:', (err && err.message) ? err.message : err);
    const hint = (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
      ? 'Missing RESEND_API_KEY or EMAIL_FROM in .env'
      : undefined;
    res.status(500).json({ success: false, error: (err && err.message) ? err.message : String(err), hint });
  }
});

// -------------------------
// Global error handler (catches errors like CORS blocking and others)
// -------------------------
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err && err.message ? err.message : err);
  if (err && typeof err.message === 'string' && err.message.startsWith('❌ CORS')) {
    return res.status(403).json({ success: false, error: err.message });
  }
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// -------------------------
// Start server
// -------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  // Helpful runtime hints
  console.log('ENV HINTS:');
  console.log(`  BACKEND_URL=${process.env.BACKEND_URL || '(not set)'}`);
  console.log(`  EMAIL_LOGO_URL=${process.env.EMAIL_LOGO_URL || '(not set)'}`);
});
