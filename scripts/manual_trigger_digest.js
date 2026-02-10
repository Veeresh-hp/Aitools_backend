const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Tool = require('../models/Tool');
const { sendDigest } = require('../utils/scheduler');

const run = async () => {
    try {
        if (!process.env.MONGO_URI) {
            console.error('❌ MONGO_URI not found');
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to DB');

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const tools = await Tool.find({
            status: 'approved',
            approvedAt: { $gte: startOfDay }
        }).sort({ approvedAt: -1 });

        console.log(`Found ${tools.length} approved tools today.`);

        if (tools.length > 0) {
            console.log('🚀 Triggering manual digest sending...');
            await sendDigest(tools, 'Daily Digest (Manual Trigger)');
            console.log('✅ Manual trigger completed.');
        } else {
            console.log('⚠️ No tools to send.');
        }

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

run();
