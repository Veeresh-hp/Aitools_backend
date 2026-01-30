const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Tool = require('../models/Tool');
const Category = require('../models/Category');
const Stack = require('../models/Stack');
const Report = require('../models/Report');
const { sendDigest } = require('../utils/scheduler');
const { auth, requireAdmin } = require('../middleware/auth');

// Middleware: All routes here require Admin access (applied to all)
// Note: The previous file applied it per route. Let's apply globally for safety if that's the intent, 
// OR keep per route. Since this is "adminRoutes", global makes sense, but let's stick to per-route 
// or router.use(auth, requireAdmin) to be clean.
router.use(auth, requireAdmin);


// @route   GET /api/admin/tools
// @desc    Get all tools (searchable, paginated, filterable)
router.get('/tools', async (req, res) => {
    try {
        const { search, status, page = 1, limit = 20 } = req.query;
        const query = {};

        if (status && status !== 'All') {
            query.status = status;
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const tools = await Tool.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const count = await Tool.countDocuments(query);

        res.json({
            tools,
            totalPages: Math.ceil(count / limit),
            currentPage: Number(page),
            totalTools: count
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// @route   GET /api/admin/categories
// @desc    Get all categories
router.get('/categories', async (req, res) => {
    try {
        const categories = await Category.find().sort({ name: 1 });
        res.json(categories);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// @route   GET /api/admin/stats
// @desc    Get dashboard statistics
router.get('/stats', async (req, res) => {
    try {
        const [userCount, toolCount, stackCount, categoryCount, pendingTools, pendingCategories, pendingReports] = await Promise.all([
            User.countDocuments(),
            Tool.countDocuments(),
            Stack.countDocuments(),
            Category.countDocuments(),
            Tool.countDocuments({ status: 'pending' }),
            Category.countDocuments({ status: 'pending' }),
            Report.countDocuments({ status: 'pending' })
        ]);

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const newUsers = await User.countDocuments({ createdAt: { $gte: sevenDaysAgo } });

        res.json({
            overview: {
                users: userCount,
                tools: toolCount,
                stacks: stackCount,
                categories: categoryCount
            },
            pending: {
                tools: pendingTools,
                categories: pendingCategories,
                reports: pendingReports
            },
            growth: {
                newUsersLast7Days: newUsers
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// @route   GET /api/admin/users
// @desc    Get all users (searchable, paginated)
router.get('/users', async (req, res) => {
    try {
        const { search, page = 1, limit = 20 } = req.query;
        const query = {};

        if (search) {
            query.$or = [
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const count = await User.countDocuments(query);

        res.json({
            users,
            totalPages: Math.ceil(count / limit),
            currentPage: Number(page),
            totalUsers: count
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// @route   PUT /api/admin/users/:id/role
// @desc    Toggle Admin Role
router.put('/users/:id/role', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (user._id.toString() === req.user._id && user.role === 'admin') {
             return res.status(400).json({ error: 'Cannot remove your own admin status' });
        }

        user.role = user.role === 'admin' ? 'user' : 'admin';
        await user.save();
        res.json({ message: `User is now ${user.role}`, user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// @route   PUT /api/admin/users/:id/ban
// @desc    Ban/Unban User
router.put('/users/:id/ban', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (user.role === 'admin') return res.status(403).json({ error: 'Cannot ban an admin' });

        user.isBanned = !user.isBanned;
        await user.save();
        res.json({ message: `User ${user.isBanned ? 'Banned' : 'Unbanned'}`, user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// @route   POST /api/admin/trigger-digest
// @desc    Trigger email digest manually
router.post('/trigger-digest', async (req, res) => {
    try {
        const { type } = req.body;
        console.log(`🔧 Admin triggering ${type} digest manually...`);

        let tools = [];
        let title = '';

        if (type === 'daily') {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            tools = await Tool.find({
                status: 'approved',
                approvedAt: { $gte: startOfDay }
            }).sort({ approvedAt: -1 });
            title = 'Daily Digest (Manual)';
        } else if (type === 'weekly') {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            tools = await Tool.find({
                status: 'approved',
                approvedAt: { $gte: oneWeekAgo }
            }).sort({ approvedAt: -1 });
            title = 'Weekly Digest (Manual)';
        } else {
            return res.status(400).json({ error: 'Invalid type. Use "daily" or "weekly".' });
        }

        if (tools.length === 0) {
            return res.status(404).json({ message: 'No tools found for this period.' });
        }

        sendDigest(tools, title).catch(err => console.error('Manual digest error:', err));

        res.json({ 
            success: true, 
            message: `Triggered ${title} for ${tools.length} tools. Emails are sending in background.` 
        });

    } catch (err) {
        console.error('Trigger digest error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
