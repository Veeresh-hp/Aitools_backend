const mongoose = require('mongoose');
require('dotenv').config();

const Tool = require('../models/Tool');
// We need to import sendDigest. 
// scheduler.js exports { initScheduler, sendDigest }
// path from backend/scripts/trigger_daily_digest.js to backend/utils/scheduler.js is ../utils/scheduler
const { sendDigest } = require('../utils/scheduler');

const trigger = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to DB');

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        // scheduler.js uses approvedAt, check_notifications used updatedAt. 
        // I will use approvedAt to match scheduler logic exactly.
        // If that finds 0 tools, I'll fallback to updatedAt.
        
        let tools = await Tool.find({
            status: 'approved',
            approvedAt: { $gte: startOfDay }
        }).sort({ approvedAt: -1 });

        console.log(`Found ${tools.length} tools (approvedAt >= today).`);

        if (tools.length === 0) {
            console.log("Checking updatedAt as fallback...");
            tools = await Tool.find({
                status: 'approved',
                updatedAt: { $gte: startOfDay }
            }).sort({ updatedAt: -1 });
            console.log(`Found ${tools.length} tools (updatedAt >= today).`);
        }

        if (tools.length > 0) {
            console.log('Sending digest...');
            await sendDigest(tools, 'Daily Digest (Manual Trigger)');
        } else {
            console.log('No tools found.');
        }

        console.log('Done (waiting 5s for emails to send)');
        setTimeout(() => process.exit(0), 5000);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

trigger();
