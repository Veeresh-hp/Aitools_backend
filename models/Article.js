const mongoose = require('mongoose');

const ArticleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    unique: true // Prevent duplicate titles
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true
  },
  content: {
    type: String, // HTML or Markdown
    required: true
  },
  summary: {
    type: String,
    maxlength: 500
  },
  image: {
    type: String // URL
  },
  author: {
    type: String,
    default: 'Admin'
  },
  tags: [String],
  sourceUrl: {
    type: String,
    unique: true, // Prevent duplicate URLs from NewsAPI
    sparse: true  // Allow nulls for internal articles
  },
  isExternal: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['published', 'draft'],
    default: 'published'
  },
  publishedAt: {
    type: Date,
    default: Date.now,
    index: true // For sorting
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Article', ArticleSchema);
