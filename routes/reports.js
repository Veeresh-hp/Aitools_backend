const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const Tool = require('../models/Tool');
const { auth, requireAdmin } = require('../middleware/auth');

// POST /api/reports/submit - Submit a new report
router.post('/submit', async (req, res) => {
  try {
    const { toolId, toolName, reason, description } = req.body;

    // Optional: Attach user if logged in
    let reportedBy = null;
    if (req.headers.authorization) {
        // We can try to decode token manually or rely on a loose auth check
        // For now, let's trust the client provided user info or just check if 'auth' middleware was used?
        // Since this route is likely public, we might want to check token conditionally.
        // But for simplicity, we'll keep it anonymous or basic.
        // Ideally, use the auth middleware if available. 
        // Let's rely on `req.user` if `auth` middleware is used.
        // But this route is public.
    }

    const newReport = new Report({
      toolId,
      toolName,
      reason,
      description,
      reportedBy // will be null for now unless we implement optional auth logic
    });

    await newReport.save();
    res.status(201).json({ message: 'Report submitted successfully' });
  } catch (err) {
    console.error('Submit report error:', err);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// GET /api/reports - Get all reports (Admin only)
router.get('/', auth, requireAdmin, async (req, res) => {
  try {
    const reports = await Report.find()
      .sort({ reportedAt: -1 })
      .populate('toolId', 'name url status'); // Populate tool details if needed
    res.json(reports);
  } catch (err) {
    console.error('Get reports error:', err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// PATCH /api/reports/:id/status - Update report status (Admin only)
router.patch('/:id/status', auth, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const report = await Report.findByIdAndUpdate(
      req.params.id, 
      { status }, 
      { new: true }
    );
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
  } catch (err) {
    console.error('Update report status error:', err);
    res.status(500).json({ error: 'Failed to update report status' });
  }
});

// DELETE /api/reports/:id - Delete a report (Admin only)
router.delete('/:id', auth, requireAdmin, async (req, res) => {
  try {
    await Report.findByIdAndDelete(req.params.id);
    res.json({ message: 'Report deleted' });
  } catch (err) {
    console.error('Delete report error:', err);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

module.exports = router;
