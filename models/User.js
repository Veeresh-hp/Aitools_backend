const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/\S+@\S+\.\S+/, 'is invalid'],
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: 3,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  password: {
    type: String,
    minlength: 6, // No longer required
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true, // Important for optional unique field
  },
  passwordResetToken: String,
  passwordResetExpires: Date,
  favorites: {
    type: [String],
    default: [],
  },
  isBanned: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Hash password before saving, but only if it exists and has been modified
userSchema.pre('save', async function (next) {
  // Only run this function if password was actually modified (or is new) and exists
  if (!this.isModified('password') || !this.password) return next();

  // Hash the password with a salt round of 12
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  // If the user signed up with Google, they won't have a password
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);