const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true }, // Display name e.g. "Chatbots"
    slug: { type: String, required: true, unique: true, trim: true }, // Internal ID e.g. "chatbots"
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false }, // Optional
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
