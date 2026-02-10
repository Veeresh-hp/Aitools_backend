const router = require('express').Router();
const Review = require('../models/Review');
const Tool = require('../models/Tool');
const { auth } = require('../middleware/auth');

// Get reviews for a tool
router.get('/:toolId', async (req, res) => {
  try {
    const reviews = await Review.find({ toolId: req.params.toolId }).sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Post a review
router.post('/', auth, async (req, res) => {
  try {
    const { toolId, rating, comment } = req.body;
    
    // Check if user already reviewed
    const existing = await Review.findOne({ user: req.user.id, toolId });
    if (existing) return res.status(400).json({ error: 'You have already reviewed this tool.' });

    const newReview = new Review({
      user: req.user.id,
      username: req.user.username || 'Anonymous', // Assuming auth middleware populates user
      toolId,
      rating,
      comment
    });

    const savedReview = await newReview.save();
    res.json(savedReview);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
