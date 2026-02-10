const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  toolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tool',
    required: true
  },
  toolName: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    enum: ['Broken Link', 'Outdated Information', 'Duplicate', 'Inappropriate Content', 'Other'],
    default: 'Broken Link'
  },
  description: {
    type: String, // Optional user comment
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
    default: 'pending'
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // Can be anonymous
  },
  reportedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Report', reportSchema);
