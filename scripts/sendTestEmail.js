// scripts/sendTestEmail.js
// Sends a real test "new tool" email (requires RESEND_API_KEY and EMAIL_FROM set).
// This script auto-loads .env from project root (using dotenv) so you can run:
//   node scripts/sendTestEmail.js

const path = require('path');

// load .env from project root (only for local/dev). If you set env vars in your shell or CI, dotenv will not override them.
try {
  // install dotenv if you haven't: npm install dotenv
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
} catch (e) {
  // ignore if dotenv isn't installed; we'll still attempt to use process.env
}

// require the email service module
const emailService = require('../utils/emailService');

(async () => {
  try {
    if (!emailService || !emailService.emailTemplates || !emailService.sendEmail) {
      throw new Error('emailService did not export emailTemplates or sendEmail. Check utils/emailService.js');
    }

    // Make sure to replace this with an address you control for testing:
    const toAddress = process.env.TEST_RECEIVER_EMAIL || 'veereshhp2004@gmail.com';

    const tool = {
      name: 'Superhuman AI',
      description: 'A faster email experience with AI-powered summaries.',
      url: 'https://myalltools.vercel.app/tools/superhuman-ai',
      // Cloudinary-hosted image URL (example)
      image: 'https://res.cloudinary.com/drwvqhof7/image/upload/v1763989471/superhuman_ygupup.jpg',
    };

    const mail = emailService.emailTemplates.newToolAnnouncement({
      recipientEmail: toAddress,    
      tool,
      recentTools: [
        {
          name: 'AI Sketcher',
          description: 'Generate quick UI mockups with prompts.',
          url: 'https://myalltools.vercel.app/tools/ai-sketcher',
          image: 'https://res.cloudinary.com/drwvqhof7/image/upload/v1763989471/ai_sketcher.jpg',
        },
      ],
      unsubscribeUrl: `${process.env.FRONTEND_URL || 'https://myalltools.vercel.app'}/unsubscribe/test-token`,
    });

    console.log('Sending test email to:', toAddress);
    const result = await emailService.sendEmail(mail);
    console.log('Send result:', result);
    console.log('✅ Test email send attempted. Check the recipient inbox (and spam).');
  } catch (err) {
    console.error('❌ Failed to send test email:', err);
    process.exit(1);
  }
})();
