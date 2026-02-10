// routes/newsletter.js (patched)
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const Subscriber = require('../models/Subscriber');
const crypto = require('crypto');
const { sendEmail, emailTemplates } = require('../utils/emailService');
const MIN_NEW_TOOL_EMAIL_COUNT = parseInt(process.env.MIN_NEW_TOOL_EMAIL_COUNT || '5', 10);

// Rate limiter: max 20 subscribe attempts per IP per hour
const subscribeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many subscription attempts. Please try later.' }
});

// Rate limiter for send-update (admin triggered) to avoid misuse
const sendUpdateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many update triggers. Slow down.' }
});

// Subscribe to newsletter
router.post('/subscribe', subscribeLimiter, async (req, res) => {
  console.log('📧 Subscription request received:', req.body);

  const { email } = req.body;

  if (!email) {
    console.log('❌ No email provided');
    return res.status(400).json({ error: 'Email is required' });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.log('❌ Invalid email format:', email);
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  try {
    const normalizedEmail = email.toLowerCase();
    console.log('🔍 Checking if already subscribed:', normalizedEmail);

    const existing = await Subscriber.findOne({ email: normalizedEmail });
    if (existing) {
      console.log('ℹ️ Already subscribed:', normalizedEmail);
      return res.status(200).json({
        message: 'You are already subscribed to our newsletter!',
      });
    }

  const unsubscribeToken = crypto.randomBytes(24).toString('hex');
  const newSubscriber = new Subscriber({ email: normalizedEmail, unsubscribeToken });
    await newSubscriber.save();
    console.log('✅ New subscriber saved:', normalizedEmail);

    // Send welcome email
    const mailOptions = emailTemplates.welcome(normalizedEmail);
    await sendEmail(mailOptions);
    console.log('📨 Welcome email sent to:', normalizedEmail);

    res.status(201).json({
      message: 'Successfully subscribed! Check your email for confirmation.',
    });

  } catch (error) {
    console.error('❌ Error during subscription:', error);

    // Handle duplicate key error (possible race condition)
    if (error.code === 11000) {
      return res.status(200).json({
        message: 'You are already subscribed to our newsletter!',
      });
    }

    res.status(500).json({
      error: 'Failed to subscribe. Please try again later.',
      details: error.message,
    });
  }
});

// Unsubscribe endpoint (moved outside subscribe handler)
router.get('/unsubscribe/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ error: 'Missing token' });
    const subscriber = await Subscriber.findOne({ unsubscribeToken: token });
    if (!subscriber) return res.status(404).json({ error: 'Invalid unsubscribe token' });
    subscriber.isUnsubscribed = true;
    await subscriber.save();
    res.json({ message: 'You have been unsubscribed successfully.' });
  } catch (err) {
    console.error('❌ Unsubscribe error:', err.message);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

// Send newsletter or new tool collection to all subscribers (admin only) – requires threshold
router.post('/send-update', sendUpdateLimiter, async (req, res) => {
  console.log('📬 Newsletter update request received');

  const { subject, content, toolData } = req.body;

  try {
    const subscribers = await Subscriber.find({});
    console.log(`📊 Sending to ${subscribers.length} subscribers`);

    if (subscribers.length === 0) {
      return res.status(200).json({ message: 'No subscribers found' });
    }

    const emailJobs = subscribers.map(sub => {
      let mailOptions;
      if (toolData && Array.isArray(toolData.tools)) {
        const tools = toolData.tools;
        if (tools.length < MIN_NEW_TOOL_EMAIL_COUNT) {
          return Promise.resolve(); // Skip sending; below threshold
        }
        mailOptions = emailTemplates.newToolDigest({
          recipientEmail: sub.email,
          tools: tools.slice(0, 10),
          unsubscribeUrl: `${process.env.BACKEND_URL || process.env.FRONTEND_URL}/api/newsletter/unsubscribe/${sub.unsubscribeToken}`
        });
      } else if (toolData && toolData.tool) {
        // Single tool optional send only if MIN threshold explicitly met via recentTools passed
        const recent = Array.isArray(toolData.recentTools) ? toolData.recentTools : [];
        if ((recent.length + 1) < MIN_NEW_TOOL_EMAIL_COUNT) {
          return Promise.resolve();
        }
        mailOptions = emailTemplates.newToolAnnouncement({
          recipientEmail: sub.email,
          tool: toolData.tool,
          recentTools: recent.slice(0,5),
          unsubscribeUrl: `${process.env.BACKEND_URL || process.env.FRONTEND_URL}/api/newsletter/unsubscribe/${sub.unsubscribeToken}`
        });
      } else {
        mailOptions = {
          from: `"AI Tools Hub" <${process.env.EMAIL_USER}>`,
          to: sub.email,
          subject: subject || '📧 AI Tools Hub Newsletter',
          html: content || '<p>New update from AI Tools Hub!</p>',
        };
      }
      return mailOptions ? sendEmail(mailOptions) : Promise.resolve();
    });

    await Promise.all(emailJobs);
    console.log(`✅ Newsletter sent to ${subscribers.length} users`);

    res.status(200).json({
      message: `Newsletter sent to ${subscribers.length} subscribers`,
    });

  } catch (error) {
    console.error('❌ Failed to send newsletter:', error);
    res.status(500).json({
      error: 'Failed to send newsletter',
      details: error.message,
    });
  }
});

// Get subscriber count (optional)
router.get('/count', async (req, res) => {
  try {
    const count = await Subscriber.countDocuments();
    res.json({ count });
  } catch (error) {
    console.error('❌ Error getting subscriber count:', error);
    res.status(500).json({ error: 'Failed to get subscriber count' });
  }
});

module.exports = router;
