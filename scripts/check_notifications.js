const mongoose = require('mongoose');
require('dotenv').config();
const ToolNotification = require('../models/ToolNotification');

const check = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const notifs = await ToolNotification.find({
            type: 'daily',
            sentAt: { $gte: startOfDay }
        });

        console.log(`Found ${notifs.length} daily notifications sent today.`);
        notifs.forEach(n => {
            console.log(`- Time: ${n.sentAt}, Tools: ${n.toolCount}, Recipients: ${n.recipientCount}, Status: ${n.status}`);
        });

        const Tool = require('../models/Tool');
        const toolsToday = await Tool.countDocuments({
            status: 'approved',
            updatedAt: { $gte: startOfDay } // Checking updatedAt as well as approvedAt to be safe
        });
         const toolsApprovedAtToday = await Tool.countDocuments({
            status: 'approved',
            approvedAt: { $gte: startOfDay } 
        });

        const toolsList = await Tool.find({
            status: 'approved',
            updatedAt: { $gte: startOfDay }
        });
        
        console.log(`Tools with updatedAt >= today: ${toolsToday}`);
        console.log(`Tools with approvedAt >= today: ${toolsApprovedAtToday}`);
        
        toolsList.forEach(t => {
             console.log(`Tool: ${t.name}, ApprovedAt: ${t.approvedAt ? t.approvedAt.toISOString() : 'N/A'}, UpdatedAt: ${t.updatedAt.toISOString()}`);
        });

        process.exit();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

check();
