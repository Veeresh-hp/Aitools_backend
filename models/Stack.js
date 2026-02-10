const mongoose = require('mongoose');

const StackSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  description: {
    type: String,
    maxlength: 200,
    default: ''
  },
  slug: {
    type: String,
    unique: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tools: [{
    type: String, // Storing Tool Names or IDs - flexible for now
    default: []
  }],
  isPublic: {
    type: Boolean,
    default: true
  },
  theme: {
    type: String, // 'default', 'dark', 'gradient' etc
    default: 'default'
  }
}, { timestamps: true });

// Auto-generate slug before saving
StackSchema.pre('save', async function(next) {
  if (!this.isModified('name') && !this.isNew) return next();
  
  if (!this.slug) {
    let baseSlug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
      
    // Append random string to ensure uniqueness
    const random = Math.random().toString(36).substring(2, 7);
    this.slug = `${baseSlug}-${random}`;
  }
  next();
});

module.exports = mongoose.model('Stack', StackSchema);
