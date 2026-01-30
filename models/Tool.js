const mongoose = require('mongoose');

const toolSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  shortDescription: { type: String, required: true, trim: true }, // Short summary for cards
  description: { type: String, required: true, trim: true }, // Full detailed description
  url: { type: String, required: true, trim: true }, // Tool link is now required
  videoUrl: { type: String, trim: true }, // Optional YouTube video URL
  category: { type: String, required: true, trim: true }, // Category for the tool
  snapshotUrl: { type: String, required: true, trim: true }, // Image is now required
  hashtags: { type: [String], default: [] }, // Array of hashtags
  pricing: { type: String, enum: ['Free', 'Freemium', 'Paid', 'Open Source', 'Free Trial', 'Contact'], default: 'Freemium' }, // Pricing model
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedAt: {
    type: Date
  },
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  isAiToolsChoice: {
    type: Boolean,
    default: false
  },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false }, // Optional - can be null for anonymous submissions
}, { timestamps: true });

module.exports = mongoose.model('Tool', toolSchema);