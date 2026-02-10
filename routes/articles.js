const router = require('express').Router();
const Article = require('../models/Article');
const { auth } = require('../middleware/auth'); // For creating posts (admin only in future)

// Get all articles (Paginated + DB Source)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const skip = (page - 1) * limit;

    // Fetch published articles
    const articles = await Article.find({ status: 'published' })
      .sort({ publishedAt: -1 }) // Sort by published date
      .skip(skip)
      .limit(limit);

    const total = await Article.countDocuments({ status: 'published' });

    res.json({
      articles,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalArticles: total
    });
  } catch (err) {
    console.error('DB Fetch Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single article by slug
router.get('/:slug', async (req, res) => {
  try {
    const article = await Article.findOne({ slug: req.params.slug });
    if (!article) return res.status(404).json({ error: 'Article not found' });
    res.json(article);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create article (Protected - Ideally check for admin role, but basic auth for now)
router.post('/', auth, async (req, res) => {
  try {
    const { title, content, summary, image, tags, slug } = req.body;
    
    // Auto-generate slug if not provided
    const finalSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const newArticle = new Article({
      title,
      slug: finalSlug,
      content,
      summary,
      image,
      tags
    });

    const saved = await newArticle.save();
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
