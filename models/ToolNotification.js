const mongoose = require('mongoose');

/**
 * ToolNotification schema tracks when notification emails were sent
 * to prevent duplicate sends and manage scheduling.
 */
const toolNotificationSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['daily', 'weekly'], 
    required: true 
  },
  sentAt: { 
    type: Date, 
    required: true,
    default: Date.now
  },
  toolCount: { 
    type: Number, 
    required: true,
    default: 0
  },
  // Store tool IDs that were included in this notification
  toolIds: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tool' 
  }],
  recipientCount: {
    type: Number,
    default: 0
  },
  // Status tracking for debugging
  status: {
    type: String,
    enum: ['pending', 'sending', 'completed', 'failed'],
    default: 'pending'
  },
  errorMessage: String
}, { timestamps: true });

// Index for efficient querying
toolNotificationSchema.index({ type: 1, sentAt: -1 });

module.exports = mongoose.model('ToolNotification', toolNotificationSchema);
