/* File: testNotifications.js
   Description: Test script to manually trigger notification emails
*/

require('dotenv').config();
const mongoose = require('mongoose');
const { sendDailyNotification, sendWeeklyDigest } = require('./utils/toolNotificationService');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    runTest();
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err);
    process.exit(1);
  });

async function runTest() {
  try {
    console.log('\n📧 TESTING NOTIFICATION SYSTEM\n');
    
    // Ask which test to run
    const args = process.argv.slice(2);
    const testType = args[0] || 'daily';

    if (testType === 'daily') {
      console.log('🔔 Testing DAILY notification...\n');
      await sendDailyNotification();
    } else if (testType === 'weekly') {
      console.log('📅 Testing WEEKLY digest...\n');
      await sendWeeklyDigest();
    } else {
      console.log('❌ Unknown test type. Use: node testNotifications.js [daily|weekly]');
    }

    console.log('\n✅ Test completed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}
