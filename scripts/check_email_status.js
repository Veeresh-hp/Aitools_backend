const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' }); // Adjust path to root .env

const run = async () => {
    try {
        if (!process.env.MONGO_URI) {
            console.error('❌ MONGO_URI not found in environment');
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to DB');

        // Check ToolNotifications for today
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        // Check for 'ToolNotification' collection directly
        // I need to define the schema or use mongoose.connection.db
        const db = mongoose.connection.db;
        const notifications = await db.collection('toolnotifications').find({
            sentAt: { $gte: startOfDay }
        }).toArray();

        console.log('\n--- EMAIL STATUS REPORT (TODAY) ---');
        if (notifications.length === 0) {
            console.log('❌ No notifications sent today.');
        } else {
            notifications.forEach(n => {
                console.log(`✅ [${n.type.toUpperCase()}] Sent at: ${new Date(n.sentAt).toLocaleString()} | Recipients: ${n.recipientCount} | Tools: ${n.toolCount}`);
            });
        }

        // Check for approved tools today (to see if digest SHOULD have triggered)
        const tools = await db.collection('tools').find({
            status: 'approved',
            approvedAt: { $gte: startOfDay }
        }).toArray();

        console.log(`\n--- TOOLS APPROVED TODAY: ${tools.length} ---`);
        tools.forEach(t => console.log(`- ${t.name}`));

        console.log('\n-----------------------------------');

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

run();
