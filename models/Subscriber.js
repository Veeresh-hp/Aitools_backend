const mongoose = require('mongoose');

const subscriberSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function (v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Please enter a valid email address',
    },
  },
  subscribedAt: {
    type: Date,
    default: Date.now,
  },
  unsubscribeToken: {
    type: String,
    index: true,
  },
  isUnsubscribed: {
    type: Boolean,
    default: false,
    index: true,
  },
  lastSentAt: {
    type: Date,
  },
});

// ❌ Removed duplicate .index() — not needed since `unique: true` on `email`

module.exports = mongoose.model('Subscriber', subscriberSchema);
