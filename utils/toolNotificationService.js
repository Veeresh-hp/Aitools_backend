/* File: utils/toolNotificationService.js
   Description: Automated email notifications for new tools (daily + weekly digests)
*/

const Tool = require('../models/Tool');
const User = require('../models/User');
const Subscriber = require('../models/Subscriber');
const ToolNotification = require('../models/ToolNotification');
const { sendEmail, emailTemplates } = require('./emailService');

/**
 * Sends daily notification if 5+ tools were approved today
 * Called by cron job at 9 PM daily
 */
const sendDailyNotification = async () => {
  try {
    console.log('🔔 Checking for daily tool notification...');
    
    // Get today's date range (start of day to now)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const now = new Date();

    // Check if we already sent today's notification
    const alreadySent = await ToolNotification.findOne({
      type: 'daily',
      sentAt: { $gte: todayStart }
    });

    if (alreadySent) {
      console.log('✅ Daily notification already sent today');
      return;
    }

    // Find approved tools from today
    const todaysTools = await Tool.find({
      status: 'approved',
      updatedAt: { $gte: todayStart, $lte: now }
    }).sort({ updatedAt: -1 });

    console.log(`📊 Found ${todaysTools.length} tools approved today`);

    // Only send if 5 or more tools
    if (todaysTools.length < 5) {
      console.log('⏭️ Less than 5 tools today, skipping daily notification');
      return;
    }

    // Get all recipients (subscribers + registered users)
    const recipients = await getAllRecipients();
    
    if (recipients.length === 0) {
      console.log('⚠️ No recipients found for daily notification');
      return;
    }

    console.log(`📧 Sending daily notification to ${recipients.length} recipients...`);

    // Create notification record
    const notification = await ToolNotification.create({
      type: 'daily',
      toolCount: todaysTools.length,
      toolIds: todaysTools.map(t => t._id),
      recipientCount: recipients.length,
      status: 'sending'
    });

    // Send emails
    let successCount = 0;
    let failCount = 0;

    const emailPromises = recipients.map(async (recipient) => {
      try {
        const unsubscribeUrl = getUnsubscribeUrl(recipient);
        const mailOptions = emailTemplates.newToolDigest({
          recipientEmail: recipient.email,
          tools: todaysTools,
          unsubscribeUrl
        });

        await sendEmail(mailOptions);
        successCount++;
        
        // Update lastSentAt for subscribers
        if (recipient.type === 'subscriber' && recipient._id) {
          await Subscriber.updateOne(
            { _id: recipient._id },
            { $set: { lastSentAt: new Date() } }
          );
        }
      } catch (error) {
        console.error(`❌ Failed to send to ${recipient.email}:`, error.message);
        failCount++;
      }
    });

    await Promise.all(emailPromises);

    // Update notification status
    await ToolNotification.updateOne(
      { _id: notification._id },
      {
        status: 'completed',
        recipientCount: successCount
      }
    );

    console.log(`✅ Daily notification sent! Success: ${successCount}, Failed: ${failCount}`);
  } catch (error) {
    console.error('❌ Error in sendDailyNotification:', error);
    throw error;
  }
};

/**
 * Sends weekly digest of all approved tools from past 7 days
 * Called by cron job every Monday at 10 AM
 */
const sendWeeklyDigest = async () => {
  try {
    console.log('📅 Checking for weekly tool digest...');

    // Get date range (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);
    const now = new Date();

    // Check if we already sent this week's digest
    const alreadySent = await ToolNotification.findOne({
      type: 'weekly',
      sentAt: { $gte: weekAgo }
    });

    if (alreadySent) {
      console.log('✅ Weekly digest already sent this week');
      return;
    }

    // Find approved tools from past 7 days
    const weeklyTools = await Tool.find({
      status: 'approved',
      updatedAt: { $gte: weekAgo, $lte: now }
    }).sort({ updatedAt: -1 });

    console.log(`📊 Found ${weeklyTools.length} tools from past 7 days`);

    // Only send if there are tools to share
    if (weeklyTools.length === 0) {
      console.log('⏭️ No tools this week, skipping weekly digest');
      return;
    }

    // Get all recipients
    const recipients = await getAllRecipients();
    
    if (recipients.length === 0) {
      console.log('⚠️ No recipients found for weekly digest');
      return;
    }

    console.log(`📧 Sending weekly digest to ${recipients.length} recipients...`);

    // Create notification record
    const notification = await ToolNotification.create({
      type: 'weekly',
      toolCount: weeklyTools.length,
      toolIds: weeklyTools.map(t => t._id),
      recipientCount: recipients.length,
      status: 'sending'
    });

    // Send emails
    let successCount = 0;
    let failCount = 0;

    const emailPromises = recipients.map(async (recipient) => {
      try {
        const unsubscribeUrl = getUnsubscribeUrl(recipient);
        const mailOptions = emailTemplates.newToolDigest({
          recipientEmail: recipient.email,
          tools: weeklyTools,
          unsubscribeUrl
        });

        await sendEmail(mailOptions);
        successCount++;
        
        // Update lastSentAt for subscribers
        if (recipient.type === 'subscriber' && recipient._id) {
          await Subscriber.updateOne(
            { _id: recipient._id },
            { $set: { lastSentAt: new Date() } }
          );
        }
      } catch (error) {
        console.error(`❌ Failed to send to ${recipient.email}:`, error.message);
        failCount++;
      }
    });

    await Promise.all(emailPromises);

    // Update notification status
    await ToolNotification.updateOne(
      { _id: notification._id },
      {
        status: 'completed',
        recipientCount: successCount
      }
    );

    console.log(`✅ Weekly digest sent! Success: ${successCount}, Failed: ${failCount}`);
  } catch (error) {
    console.error('❌ Error in sendWeeklyDigest:', error);
    throw error;
  }
};

/**
 * Helper: Get all email recipients (subscribers + registered users)
 * Returns array with format: { email, type, _id, unsubscribeToken }
 */
const getAllRecipients = async () => {
  try {
    // Get active subscribers
    const subscribers = await Subscriber.find({ 
      isUnsubscribed: false 
    }).select('email unsubscribeToken _id');

    // Get registered users
    const users = await User.find({ 
      isVerified: { $ne: false } // Include users without isVerified field
    }).select('email');

    // Combine and deduplicate by email
    const recipientMap = new Map();

    // Add subscribers first (they have unsubscribe tokens)
    subscribers.forEach(sub => {
      recipientMap.set(sub.email.toLowerCase(), {
        email: sub.email,
        type: 'subscriber',
        _id: sub._id,
        unsubscribeToken: sub.unsubscribeToken
      });
    });

    // Add users (if not already in map as subscriber)
    users.forEach(user => {
      const emailKey = user.email.toLowerCase();
      if (!recipientMap.has(emailKey)) {
        recipientMap.set(emailKey, {
          email: user.email,
          type: 'user',
          _id: user._id
        });
      }
    });

    return Array.from(recipientMap.values());
  } catch (error) {
    console.error('❌ Error getting recipients:', error);
    return [];
  }
};

/**
 * Helper: Generate unsubscribe URL for recipient
 */
const getUnsubscribeUrl = (recipient) => {
  const backendBase = process.env.BACKEND_URL || process.env.FRONTEND_URL || '';
  
  if (recipient.type === 'subscriber' && recipient.unsubscribeToken) {
    return `${backendBase}/api/newsletter/unsubscribe/${recipient.unsubscribeToken}`;
  }
  
  // For registered users, link to account settings
  return `${process.env.FRONTEND_URL}/account/settings`;
};

module.exports = {
  sendDailyNotification,
  sendWeeklyDigest,
  getAllRecipients
};
