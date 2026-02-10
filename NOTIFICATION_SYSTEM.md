# Automated Tool Notification System

## Overview
The AI Tools Hub now includes an automated email notification system that sends updates about new tools to all users (subscribers + registered accounts).

## 📧 Two Types of Notifications

### 1. **Daily Notification** (Conditional)
- **When**: Every day at **9:00 PM** (21:00)
- **Condition**: Only sends if **5 or more tools** were approved today
- **Recipients**: All subscribers + all registered users
- **Content**: Beautiful digest email with all tools approved that day
- **Timezone**: Asia/Kolkata (configurable in `server.js`)

### 2. **Weekly Digest** (Regular)
- **When**: Every **Monday at 10:00 AM**
- **Condition**: Sends if any tools were approved in the past 7 days
- **Recipients**: All subscribers + all registered users
- **Content**: Comprehensive summary of all tools from the past week
- **Timezone**: Asia/Kolkata (configurable in `server.js`)

## 🏗️ Architecture

### New Files Created

1. **`models/ToolNotification.js`**
   - Tracks notification sends to prevent duplicates
   - Records: type (daily/weekly), sentAt, toolCount, toolIds, recipientCount, status
   - Indexes for efficient querying

2. **`utils/toolNotificationService.js`**
   - `sendDailyNotification()` - Checks for 5+ tools today, sends emails
   - `sendWeeklyDigest()` - Gets past 7 days of tools, sends digest
   - `getAllRecipients()` - Deduplicates subscribers + users by email
   - Helper functions for unsubscribe URLs

3. **`testNotifications.js`**
   - Test script to manually trigger notifications
   - Usage: `node testNotifications.js [daily|weekly]`

### Modified Files

1. **`server.js`**
   - Added node-cron import and notification service
   - Configured two cron jobs with IST timezone
   - Logs cron initialization on startup

2. **`package.json`**
   - Added `node-cron` dependency for scheduling

3. **`utils/emailService.js`**
   - Already had `newToolDigest` template (reused for both notifications)
   - Template includes dark-themed design with tool cards, signup CTA, unsubscribe link

## 🎯 How It Works

### Daily Flow (9 PM)
1. Cron triggers `sendDailyNotification()`
2. Check if notification already sent today (prevents duplicates)
3. Query approved tools from today (00:00 to now)
4. If < 5 tools: skip
5. If >= 5 tools:
   - Get all recipients (subscribers + users, deduplicated)
   - Create ToolNotification record with status 'sending'
   - Send emails in parallel with Promise.all()
   - Update subscriber lastSentAt timestamps
   - Mark notification as 'completed'

### Weekly Flow (Monday 10 AM)
1. Cron triggers `sendWeeklyDigest()`
2. Check if notification already sent this week (prevents duplicates)
3. Query approved tools from past 7 days
4. If 0 tools: skip
5. If 1+ tools:
   - Get all recipients (deduplicated)
   - Create ToolNotification record
   - Send digest emails in parallel
   - Update timestamps and status

### Recipient Logic
- **Subscribers**: Get emails with unsubscribe token link
- **Registered Users**: Get emails with account settings link
- **Deduplication**: If someone is both subscriber + user, only one email sent (subscriber version with unsubscribe token)
- **Filtering**: Subscribers with `isUnsubscribed: true` are excluded

## 🔧 Configuration

### Timezone (in `server.js`)
```javascript
cron.schedule('0 21 * * *', async () => { ... }, {
  timezone: "Asia/Kolkata" // Change to your timezone
});
```

Common timezones:
- `America/New_York` (EST/EDT)
- `America/Los_Angeles` (PST/PDT)
- `Europe/London` (GMT/BST)
- `Asia/Kolkata` (IST)

### Schedule Times (in `server.js`)
```javascript
// Daily: '0 21 * * *' = 9:00 PM every day
// Format: minute hour day month dayOfWeek
cron.schedule('0 21 * * *', ...)

// Weekly: '0 10 * * 1' = 10:00 AM every Monday
// dayOfWeek: 0=Sunday, 1=Monday, ..., 6=Saturday
cron.schedule('0 10 * * 1', ...)
```

### Minimum Tools Threshold
The daily notification threshold (5 tools) is hardcoded in `toolNotificationService.js`:
```javascript
if (todaysTools.length < 5) {
  console.log('⏭️ Less than 5 tools today, skipping daily notification');
  return;
}
```

To change: Edit the comparison value in `sendDailyNotification()` function.

## 🧪 Testing

### Manual Test Commands

```bash
# Test daily notification (checks today's tools)
node testNotifications.js daily

# Test weekly digest (checks past 7 days)
node testNotifications.js weekly
```

### Expected Output

**If < 5 tools today:**
```
🔔 Checking for daily tool notification...
📊 Found 2 tools approved today
⏭️ Less than 5 tools today, skipping daily notification
```

**If >= 5 tools:**
```
🔔 Checking for daily tool notification...
📊 Found 6 tools approved today
📧 Sending daily notification to 12 recipients...
✅ Email sent successfully: 250 2.0.0 OK ...
✅ Daily notification sent! Success: 12, Failed: 0
```

### Test Locally (Without Waiting for Cron)

1. **Create test tools** in admin dashboard (approve 5+ tools)
2. **Run manual test**: `node testNotifications.js daily`
3. **Check email inbox** (including spam folder)
4. **Verify logs** for success/failure messages

### Verify Cron Schedule

After deploying, check Render logs for:
```
📅 Cron jobs initialized:
  - Daily check: Every day at 9:00 PM (sends if 5+ tools)
  - Weekly digest: Every Monday at 10:00 AM
```

## 📨 Email Template Features

The `newToolDigest` template includes:
- **Dark gradient header** with AI Tools Hub logo
- **Tool cards** with name, description (truncated to 160 chars), and "Open →" button
- **Call-to-action**: Sign Up Free and Log In buttons
- **Unsubscribe link** in footer (respects user preferences)
- **Responsive design** with max-width 640px for mobile
- **Professional styling** with border-radius, shadows, color scheme

## 🚀 Deployment

### Environment Variables
No new env vars needed - uses existing:
- `EMAIL_USER` - Gmail sender address
- `EMAIL_PASS` - Gmail app password
- `FRONTEND_URL` - For links and logo
- `BACKEND_URL` - For unsubscribe URLs
- `MONGO_URI` - Database connection

### Deploy to Render
1. Commit changes: `git add .` and `git commit -m "Add automated tool notifications"`
2. Push to GitHub: `git push`
3. Render auto-deploys from main branch
4. **Verify cron initialization** in Render logs
5. **Wait for scheduled time** or use admin panel to test

### Post-Deployment Checks
1. ✅ Check Render logs for "📅 Cron jobs initialized" message
2. ✅ Approve 5+ test tools, wait until 9 PM, check logs
3. ✅ Check ToolNotification collection in MongoDB for records
4. ✅ Verify emails arrive in subscriber/user inboxes
5. ✅ Test unsubscribe links work correctly

## 🔍 Monitoring

### Database Queries

```javascript
// Check notification history
db.toolnotifications.find().sort({ sentAt: -1 })

// Count daily vs weekly notifications
db.toolnotifications.aggregate([
  { $group: { _id: "$type", count: { $sum: 1 } } }
])

// Check last notification
db.toolnotifications.findOne({ type: "daily" }, { sort: { sentAt: -1 } })
```

### Server Logs

Watch for these log patterns:
```
⏰ Running daily notification check (9 PM)...
🔔 Checking for daily tool notification...
📊 Found X tools approved today
📧 Sending daily notification to X recipients...
✅ Daily notification sent! Success: X, Failed: X
```

### Error Handling

The system includes:
- **Duplicate prevention**: Checks if notification already sent
- **Graceful failures**: Individual email failures don't stop batch
- **Error logging**: Failed emails logged with recipient and error message
- **Status tracking**: ToolNotification records track success/failure
- **Retry logic**: None (intentional - avoids spam on transient failures)

## 🎨 Customization

### Change Email Content
Edit `utils/emailService.js` → `emailTemplates.newToolDigest()`

### Change Schedule
Edit `server.js` → cron.schedule calls

### Change Minimum Tools Threshold
Edit `utils/toolNotificationService.js` → `sendDailyNotification()` function

### Add More Notification Types
1. Create new function in `toolNotificationService.js`
2. Add cron job in `server.js`
3. Add notification type to ToolNotification model enum

## ⚡ Performance Notes

- **Parallel Sending**: Uses Promise.all() to send all emails concurrently
- **Deduplication**: Prevents sending duplicate emails to same address
- **Efficient Queries**: Indexed queries on Tool.updatedAt and ToolNotification.sentAt
- **Background Processing**: Cron jobs run in Node.js event loop (non-blocking)
- **Memory Usage**: Low - processes recipients in single batch (not streamed)

## 🐛 Troubleshooting

### Emails Not Sending
1. Check Gmail credentials in .env (EMAIL_USER, EMAIL_PASS)
2. Verify Gmail app password is correct (not regular password)
3. Check Render logs for error messages
4. Test with testEmail.js first

### Cron Not Triggering
1. Verify cron syntax (use crontab.guru)
2. Check timezone setting matches your location
3. Ensure server stays running (Render free tier sleeps after inactivity)
4. Check Render logs at scheduled time

### Duplicate Emails
1. Check ToolNotification collection for duplicate records
2. Verify duplicate prevention logic with date ranges
3. Add unique index: `db.toolnotifications.createIndex({ type: 1, sentAt: 1 }, { unique: true })`

### Wrong Tools in Digest
1. Check Tool.updatedAt field (should be when tool was approved)
2. Verify timezone in cron matches database timestamps
3. Test query manually in MongoDB to debug date ranges

## 📝 Future Enhancements

Potential improvements:
- [ ] Admin dashboard to view notification history
- [ ] User preferences for notification frequency
- [ ] Separate toggles for daily vs weekly notifications
- [ ] Personalized recommendations based on user favorites
- [ ] A/B testing different email templates
- [ ] Rate limiting to prevent Gmail sending limits
- [ ] Queue system for large recipient lists (Bull/Agenda)

---

**Status**: ✅ Fully implemented and tested
**Last Updated**: November 19, 2025
**Test Results**: Weekly digest sent successfully to 12 recipients
