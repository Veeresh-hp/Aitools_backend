/* File: testSingleEmail.js
   Description: Send test notification email to a single email address
   Usage: node testSingleEmail.js your-email@gmail.com
*/

require('dotenv').config();
const mongoose = require('mongoose');
const Tool = require('./models/Tool');
const { sendEmail, emailTemplates } = require('./utils/emailService');

// Get email from command line argument
const testEmail = process.argv[2];

if (!testEmail) {
  console.error('❌ Please provide an email address');
  console.log('Usage: node testSingleEmail.js your-email@gmail.com');
  process.exit(1);
}

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    sendTestEmail();
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err);
    process.exit(1);
  });

async function sendTestEmail() {
  try {
    console.log(`\n📧 Sending test email to: ${testEmail}\n`);

    // Get recent approved tools
    const recentTools = await Tool.find({ status: 'approved' })
      .sort({ updatedAt: -1 })
      .limit(5);

    if (recentTools.length === 0) {
      console.log('⚠️ No approved tools found in database');
      process.exit(1);
    }

    console.log(`Found ${recentTools.length} approved tools`);
    console.log('Tools:', recentTools.map(t => t.name).join(', '));

    // Create unsubscribe URL (dummy for testing)
    const unsubscribeUrl = `${process.env.BACKEND_URL}/api/newsletter/unsubscribe/test-token`;

    // Send the digest email
    const mailOptions = emailTemplates.newToolDigest({
      recipientEmail: testEmail,
      tools: recentTools,
      unsubscribeUrl
    });

    await sendEmail(mailOptions);

    console.log('\n✅ Test email sent successfully!');
    console.log(`Check inbox: ${testEmail}`);
    console.log('\n📋 Email details:');
    console.log(`  - Subject: ${mailOptions.subject}`);
    console.log(`  - Tools included: ${recentTools.length}`);
    console.log(`  - Signup link: ${process.env.FRONTEND_URL}/signup`);
    console.log(`  - Login link: ${process.env.FRONTEND_URL}/login`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Failed to send test email:', error.message);
    process.exit(1);
  }
}
