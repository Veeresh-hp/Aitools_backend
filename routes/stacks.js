const router = require('express').Router();
const Stack = require('../models/Stack');
const { auth } = require('../middleware/auth'); 
const jwt = require('jsonwebtoken'); 

// 1. Create a Stack
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, isPublic, tools } = req.body;
    
    if (!name) return res.status(400).json({ error: 'Stack name is required' });

    // Limit max stacks per user (e.g., 20)
    const count = await Stack.countDocuments({ user: req.user._id });
    if (count >= 20) {
      return res.status(403).json({ error: 'Maximum limit of 20 stacks reached' });
    }

    const newStack = new Stack({
      user: req.user._id,
      name,
      description,
      isPublic: isPublic !== undefined ? isPublic : true,
      tools: tools || []
    });

    const savedStack = await newStack.save();
    res.status(201).json(savedStack);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get User's Stacks (Private + Public)
router.get('/my-stacks', auth, async (req, res) => {
  try {
    const stacks = await Stack.find({ user: req.user._id }).sort({ updatedAt: -1 });
    res.json(stacks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get Public Stacks (Explore)
router.get('/explore', async (req, res) => {
    try {
        const stacks = await Stack.find({ isPublic: true })
            .sort({ createdAt: -1 })
            .limit(20)
            .populate('user', 'username avatar'); // Requires User model population
        res.json(stacks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Get Single Stack by Slug (Public or Owner)
router.get('/:slug', async (req, res) => {
  try {
    const stack = await Stack.findOne({ slug: req.params.slug }).populate('user', 'username avatar');
    if (!stack) return res.status(404).json({ error: 'Stack not found' });

    // Check visibility
    // If private, verify ownership via token header (manual check since this route is arguably public-first)
    // Check visibility
    if (!stack.isPublic) {
        // If private, verify ownership
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(403).json({ error: 'This stack is private.' });
        }

        try {
            const token = authHeader.split(' ')[1];
            const jwt = require('jsonwebtoken'); // Ensure jwt is available
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Compare requesting user ID with stack owner ID
            if (decoded.userId !== stack.user._id.toString()) {
                return res.status(403).json({ error: 'You do not have permission to view this private stack.' });
            }
        } catch (err) {
             return res.status(403).json({ error: 'Invalid authentication for private stack.' });
        }
    }

    res.json(stack);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Update Stack
router.put('/:id', auth, async (req, res) => {
  try {
    const stack = await Stack.findOne({ _id: req.params.id, user: req.user._id });
    if (!stack) return res.status(404).json({ error: 'Stack not found or unauthorized' });

    const { name, description, isPublic, tools } = req.body;
    if (name) stack.name = name;
    if (description !== undefined) stack.description = description;
    if (isPublic !== undefined) stack.isPublic = isPublic;
    if (tools) stack.tools = tools;

    const updated = await stack.save();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Delete Stack
router.delete('/:id', auth, async (req, res) => {
  try {
    const deleted = await Stack.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!deleted) return res.status(404).json({ error: 'Stack not found or unauthorized' });
    res.json({ message: 'Stack deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Clone Stack
router.post('/:id/clone', auth, async (req, res) => {
    try {
        const originalStack = await Stack.findById(req.params.id);
        if (!originalStack) return res.status(404).json({ error: 'Stack not found' });

        // Check if public or owner
        if (!originalStack.isPublic && originalStack.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Cannot clone private stack' });
        }

        // Check limit
        const count = await Stack.countDocuments({ user: req.user._id });
        if (count >= 20) {
            return res.status(403).json({ error: 'Maximum limit of 20 stacks reached' });
        }

        const newStack = new Stack({
            user: req.user._id,
            name: `${originalStack.name} (Copy)`,
            description: originalStack.description,
            isPublic: false, // Default to private when cloned
            tools: originalStack.tools
        });

        const savedStack = await newStack.save();
        res.status(201).json(savedStack);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
