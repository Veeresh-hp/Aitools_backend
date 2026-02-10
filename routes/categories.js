
const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const slugify = require('slugify');
const { auth, requireAdmin } = require('../middleware/auth');

// GET /api/categories - get all approved categories (public)
router.get('/', async (req, res) => {
    try {
        const categories = await Category.find({ status: 'approved' }).sort({ name: 1 });
        res.json(categories);
    } catch (err) {
        console.error('Get categories error:', err.message);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// GET /api/categories/pending - get pending categories (admin only)
router.get('/pending', auth, requireAdmin, async (req, res) => {
    try {
        const pending = await Category.find({ status: 'pending' }).sort({ createdAt: -1 });
        res.json(pending);
    } catch (err) {
        console.error('Get pending categories error:', err.message);
        res.status(500).json({ error: 'Failed to fetch pending categories' });
    }
});

// POST /api/categories/request - request a new category (public/auth optional)
router.post('/request', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Category name is required' });

        const slug = slugify(name, { lower: true, strict: true });

        // Check if exists
        const existing = await Category.findOne({ slug });
        if (existing) {
            if (existing.status === 'approved') {
                return res.status(400).json({ error: 'Category already exists' });
            } else if (existing.status === 'pending') {
                return res.status(400).json({ error: 'Category is already pending approval' });
            }
        }

        // Check auth for submitter (optional)
        let submittedBy = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.split(' ')[1];
                const jwt = require('jsonwebtoken');
                const payload = jwt.verify(token, process.env.JWT_SECRET);
                submittedBy = payload.userId;
            } catch (err) {
                // Ignore invalid token
            }
        }

        const category = await Category.create({
            name,
            slug,
            status: 'pending',
            submittedBy
        });

        res.status(201).json({ message: 'Category requested', category });
    } catch (err) {
        console.error('Request category error:', err.message);
        res.status(500).json({ error: 'Failed to request category' });
    }
});

// POST /api/categories/:id/approve - approve category (admin only)
router.post('/:id/approve', auth, requireAdmin, async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ error: 'Category not found' });

        category.status = 'approved';
        await category.save();

        res.json({ message: 'Category approved', category });
    } catch (err) {
        console.error('Approve category error:', err.message);
        res.status(500).json({ error: 'Failed to approve category' });
    }
});

// POST /api/categories/:id/reject - reject category (admin only)
router.post('/:id/reject', auth, requireAdmin, async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ error: 'Category not found' });

        category.status = 'rejected';
        await category.save();

        res.json({ message: 'Category rejected' });
    } catch (err) {
        console.error('Reject category error:', err.message);
        res.status(500).json({ error: 'Failed to reject category' });
    }
});

// PUT /api/categories/:id - update category (admin only)
router.put('/:id', auth, requireAdmin, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ error: 'Category not found' });

        const slug = slugify(name, { lower: true, strict: true });

        // Check if new slug exists (excluding current category)
        const existing = await Category.findOne({ slug, _id: { $ne: req.params.id } });
        if (existing) {
            return res.status(400).json({ error: 'Category with this name already exists' });
        }

        category.name = name;
        category.slug = slug;
        await category.save();

        res.json({ message: 'Category updated', category });
    } catch (err) {
        console.error('Update category error:', err.message);
        res.status(500).json({ error: 'Failed to update category' });
    }
});

module.exports = router;
