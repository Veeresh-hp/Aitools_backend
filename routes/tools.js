const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Tool = require('../models/Tool');
const Subscriber = require('../models/Subscriber');
const { sendNewToolEmail } = require('../utils/emailService');
const User = require('../models/User');
const { auth, requireAdmin } = require('../middleware/auth');

// Cloudinary setup (if configured, else fallback to local)
let upload;
let cloudinaryV2;
let hasCloudinary = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;

if (hasCloudinary) {
  try {
    cloudinaryV2 = require('cloudinary').v2;
    const { CloudinaryStorage } = require('multer-storage-cloudinary');

    cloudinaryV2.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });

    const cloudinaryStorage = new CloudinaryStorage({
      cloudinary: cloudinaryV2,
      params: {
        folder: 'ai-tools-pending', // Store in pending folder initially
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        transformation: [{ width: 800, height: 600, crop: 'limit' }]
      }
    });

    upload = multer({ storage: cloudinaryStorage, limits: { fileSize: 5 * 1024 * 1024 } });
    console.log('✅ Using Cloudinary for image storage');
  } catch (err) {
    console.error('❌ Cloudinary setup failed:', err.message);
    console.log('⚠️ Falling back to local storage');
    hasCloudinary = false; // Force fallback
  }
}

if (!hasCloudinary) {
  // Fallback to local storage for development
  const uploadsDir = path.join(__dirname, '..', 'uploads');

  // Ensure uploads directory exists
  if (!fs.existsSync(uploadsDir)) {
    try {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('📁 Created uploads directory');
    } catch (err) {
      console.error('❌ Failed to create uploads directory:', err.message);
    }
  }

  const localStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
      cb(null, unique);
    }
  });
  upload = multer({ storage: localStorage, limits: { fileSize: 5 * 1024 * 1024 } });
  console.log('⚠️ Using local storage for images (not suitable for production)');
}

// POST /api/tools/upload - upload snapshot image (no auth required - open to everyone)
router.post('/upload', (req, res) => {
  const uploadMiddleware = upload.single('snapshot');

  uploadMiddleware(req, res, (err) => {
    if (err) {
      console.error('Multer upload error:', err.message);
      return res.status(500).json({
        error: 'File upload failed',
        details: err.message,
        hint: hasCloudinary ? 'Check Cloudinary credentials' : 'Check uploads folder permissions'
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Return Cloudinary URL if using cloud storage, else local path
      const fileUrl = req.file.path || `/uploads/${req.file.filename}`;
      console.log('✅ File uploaded successfully:', fileUrl);
      res.json({ url: fileUrl });
    } catch (err) {
      console.error('Upload processing error:', err.message);
      res.status(500).json({ error: 'Failed to process uploaded file' });
    }
  });
});

// GET /api/tools/approved - get all approved tools (public)
router.get('/approved', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = { status: 'approved' };

    if (category && category !== 'All') {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { shortDescription: { $regex: search, $options: 'i' } },
        { hashtags: { $regex: search, $options: 'i' } }
      ];
    }

    const tools = await Tool.find(query)
      .sort({ isAiToolsChoice: -1, createdAt: -1 });

    res.json({ tools });
  } catch (err) {
    console.error('Get tools error:', err.message);
    res.status(500).json({ error: 'Failed to fetch tools' });
  }
});

// GET /api/tools/pending - get pending tools (admin only)
router.get('/pending', auth, requireAdmin, async (req, res) => {
  try {
    const tools = await Tool.find({ status: 'pending' }).sort({ createdAt: -1 });
    res.json({ tools });
  } catch (err) {
    console.error('Get pending tools error:', err.message);
    res.status(500).json({ error: 'Failed to fetch pending tools' });
  }
});

// GET /api/tools/my-submissions - get tools submitted by the current user
router.get('/my-submissions', auth, async (req, res) => {
  try {
    const tools = await Tool.find({ submittedBy: req.user._id })
      .select('name shortDescription description status createdAt approvedAt url snapshotUrl category pricing hashtags')
      .sort({ createdAt: -1 });
      
    res.json({ tools });
  } catch (err) {
    console.error('Get my submissions error:', err.message);
    res.status(500).json({ error: 'Failed to fetch your submissions' });
  }
});

// GET /api/tools/check-duplicate - check if tool exists by URL
router.get('/check-duplicate', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const existingTool = await Tool.findOne({ url: url.trim() });
    
    if (existingTool) {
       return res.json({ exists: true, tool: existingTool });
    }
    
    res.json({ exists: false });
  } catch (err) {
    console.error('Check duplicate error:', err.message);
    res.status(500).json({ error: 'Failed to check duplicate' });
  }
});

// POST /api/tools/submit - submit a new tool
router.post('/submit', async (req, res) => {
  try {
    const { name, shortDescription, description, url, videoUrl, category, pricing, snapshotUrl, hashtags } = req.body;

    // Optional: Determine submitter if logged in
    let submittedBy = null;
    const authHeader = req.headers.authorization;
    console.log('📝 Submission attempt. Auth Header:', authHeader ? 'Present' : 'Missing');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        if (token) {
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                submittedBy = decoded.userId;
                console.log('✅ Linked submission to user:', submittedBy);
            } catch (e) {
                console.warn('⚠️ Invalid token during submission link attempt:', e.message);
                // Continue as anonymous if token is invalid
            }
        }
    } else {
        console.log('ℹ️ Anonymous submission (no valid auth header)');
    }

    // Check for duplicates (Name or URL)
    const existingTool = await Tool.findOne({
      $or: [
        { name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } },
        { url: url.trim() }
      ]
    });

    if (existingTool) {
      return res.status(409).json({ 
        error: 'Duplicate Tool',
        message: `A tool with this name or URL already exists (Status: ${existingTool.status}).`
      });
    }

    const newTool = new Tool({
      name,
      shortDescription,
      description,
      url,
      videoUrl,
      category,
      pricing,
      snapshotUrl,
      hashtags: Array.isArray(hashtags)
        ? hashtags.map(tag => tag.trim())
        : (hashtags ? hashtags.split(',').map(tag => tag.trim()) : []),
      status: 'pending',
      submittedBy: submittedBy
    });

    await newTool.save();
    res.json({ message: 'Tool submitted successfully', tool: newTool });
  } catch (err) {
    console.error('Submit tool error:', err.message);
    res.status(500).json({ error: 'Failed to submit tool' });
  }
});



// POST /api/tools/:id/approve - approve a tool (admin only)
router.post('/:id/approve', auth, requireAdmin, async (req, res) => {
  try {
    const tool = await Tool.findById(req.params.id);
    if (!tool) return res.status(404).json({ error: 'Tool not found' });

    // Move image from 'pending' to 'snapshots' on Cloudinary if it exists there
    if (hasCloudinary && cloudinaryV2 && tool.snapshotUrl && tool.snapshotUrl.includes('ai-tools-pending')) {
      try {
        // Extract public ID from URL
        // Example: .../upload/v123/ai-tools-pending/filename.jpg
        const parts = tool.snapshotUrl.split('/upload/');
        if (parts.length > 1) {
             const versionAndPath = parts[1];
             const pathOnly = versionAndPath.replace(/^v\d+\//, ''); // Remove version prefix
             const publicId = pathOnly.split('.').slice(0, -1).join('.'); // Remove extension
             
             if (publicId.startsWith('ai-tools-pending/')) {
                 const newPublicId = publicId.replace('ai-tools-pending/', 'ai-tools-snapshots/');
                 
                 await cloudinaryV2.uploader.rename(publicId, newPublicId, { overwrite: true });
                 console.log(`✅ Moved approved image to: ${newPublicId}`);
                 
                 // Update URL to point to snapshots
                 tool.snapshotUrl = tool.snapshotUrl.replace('ai-tools-pending', 'ai-tools-snapshots');
             }
        }
      } catch (cloudErr) {
          console.error('⚠️ Failed to move approved image on Cloudinary:', cloudErr.message);
      }
    }

    tool.status = 'approved';
    tool.approvedAt = new Date();
    await tool.save();

    // Email notifications are now handled by the scheduler (utils/scheduler.js)
    console.log(`Tool "${tool.name}" approved. Scheduled for digest.`);

    res.json({ message: 'Tool approved' });
  } catch (err) {
    console.error('Approve tool error:', err.message);
    res.status(500).json({ error: 'Failed to approve tool' });
  }
});

// POST /api/tools/:id/reject - reject a tool (admin only)
router.post('/:id/reject', auth, requireAdmin, async (req, res) => {
  try {
    const tool = await Tool.findById(req.params.id);
    if (!tool) return res.status(404).json({ error: 'Tool not found' });

    // Move image to 'rejected' folder on Cloudinary if applicable
    // User requested to keep images in pending folder if not approved ("otherwise keep in that folder only").
    // So we comment out the move-to-rejected logic for now.
    /*
    if (hasCloudinary && cloudinaryV2 && tool.snapshotUrl && tool.snapshotUrl.includes('res.cloudinary.com')) {
      try {
        // ... (existing move logic) ...
          if (publicId.startsWith('ai-tools-snapshots/')) {
             const newPublicId = publicId.replace('ai-tools-snapshots/', 'ai-tools-rejected/');
             await cloudinaryV2.uploader.rename(publicId, newPublicId, { overwrite: true });
             // ...
             tool.snapshotUrl = tool.snapshotUrl.replace('ai-tools-snapshots', 'ai-tools-rejected');
          }
      } catch (cloudErr) { ... }
    }
    */

    tool.status = 'rejected';
    await tool.save();
    res.json({ message: 'Tool rejected' });
  } catch (err) {
    console.error('Reject tool error:', err.message);
    res.status(500).json({ error: 'Failed to reject tool' });
  }
});

// Legacy route for notifying subscribers when a tool is added manually by admin
router.post('/notify-add', auth, requireAdmin, async (req, res) => {
  const { name, description, link } = req.body;
  const tool = { name, description, link };

  try {
    if ((process.env.BATCH_SEND_ENABLED || 'true').toLowerCase() === 'true') {
      registerTool(tool);
      return res.status(200).json({ message: '✅ Tool queued for digest announcement.' });
    }
    const [subscribers, users] = await Promise.all([
      Subscriber.find({}, 'email unsubscribeToken isUnsubscribed lastSentAt'),
      User.find({}, 'email')
    ]);
    const userEmailSet = new Set(users.map(u => u.email));
    const targetSubscribers = subscribers.filter(s => !userEmailSet.has(s.email));
    const recentTools = await Tool.find({ status: 'approved' })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name description url');

    await sendNewToolEmail(tool, targetSubscribers, recentTools);
    res.status(200).json({ message: '✅ Announcement emails sent to non‑registered subscribers!' });
  } catch (error) {
    console.error('❌ Failed to notify subscribers:', error);
    res.status(500).json({ message: 'Failed to notify subscribers.' });
  }
});

// PUT /api/tools/:id/edit - update a tool (admin only)
router.put('/:id/edit', auth, requireAdmin, async (req, res) => {
  try {
    const { name, shortDescription, description, url, videoUrl, category, pricing, snapshotUrl, hashtags, isAiToolsChoice } = req.body;
    
    const tool = await Tool.findById(req.params.id);
    if (!tool) return res.status(404).json({ error: 'Tool not found' });

    // Update fields
    if (name) tool.name = name;
    if (shortDescription !== undefined) tool.shortDescription = shortDescription;
    if (description) tool.description = description;
    if (url) tool.url = url;
    if (videoUrl !== undefined) tool.videoUrl = videoUrl;
    if (category) tool.category = category;
    if (pricing) tool.pricing = pricing;
    if (snapshotUrl) tool.snapshotUrl = snapshotUrl;
    if (isAiToolsChoice !== undefined) tool.isAiToolsChoice = isAiToolsChoice;

    if (hashtags) {
        tool.hashtags = Array.isArray(hashtags)
        ? hashtags.map(tag => tag.trim())
        : hashtags.split(',').map(tag => tag.trim());
    }

    await tool.save();
    console.log(`Tool "${tool.name}" updated by admin.`);
    res.json({ message: 'Tool updated successfully', tool });
  } catch (err) {
    console.error('Update tool error:', err.message);
    res.status(500).json({ error: 'Failed to update tool' });
  }
});

// PUT /api/tools/:id/toggle-choice - toggle admin choice status (admin only)
router.put('/:id/toggle-choice', auth, requireAdmin, async (req, res) => {
  try {
    const tool = await Tool.findById(req.params.id);
    if (!tool) return res.status(404).json({ error: 'Tool not found' });

    tool.isAiToolsChoice = !tool.isAiToolsChoice;
    await tool.save();

    res.json({ message: `Tool choice status updated to ${tool.isAiToolsChoice}`, tool });
  } catch (err) {
    console.error('Toggle choice error:', err.message);
    res.status(500).json({ error: 'Failed to toggle choice status' });
  }
});

// GET /api/tools/tool-of-the-day - get a random approved tool
router.get('/tool-of-the-day', async (req, res) => {
  try {
    const count = await Tool.countDocuments({ status: 'approved' });
    if (count === 0) {
      return res.status(404).json({ error: 'No approved tools found' });
    }
    const random = Math.floor(Math.random() * count);
    const tool = await Tool.findOne({ status: 'approved' }).skip(random);
    res.json(tool);
  } catch (err) {
    console.error('Tool of the day error:', err.message);
    res.status(500).json({ error: 'Failed to fetch tool of the day' });
  }
});

module.exports = router;