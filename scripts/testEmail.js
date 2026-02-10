// scripts/testEmail.js
// Generate a preview HTML for the new-tool email template (safe, does NOT send emails).

const fs = require('fs');
const path = require('path');

// Ensure this path matches where your project keeps utils/emailService.js
const { emailTemplates } = require('../utils/emailService');

const outDir = path.join(__dirname, 'tmp');
const outFile = path.join(outDir, 'test-email.html');

const tool = {
  name: 'Superhuman AI',
  description: 'A faster email experience with AI-powered summaries.',
  url: 'https://myalltools.vercel.app/tools/superhuman-ai',
  // Example Cloudinary URL you shared
  image: 'https://res.cloudinary.com/drwvqhof7/image/upload/v1763989471/superhuman_ygupup.jpg',
};

(async () => {
  try {
    // make output directory if missing
    fs.mkdirSync(outDir, { recursive: true });

    const mail = emailTemplates.newToolAnnouncement({
      recipientEmail: 'tester@example.com',
      tool,
      recentTools: [
        // optional recent tools to preview thumbnails
        {
          name: 'AI Sketcher',
          description: 'Generate quick UI mockups with prompts.',
          url: 'https://myalltools.vercel.app/tools/ai-sketcher',
          image: 'https://res.cloudinary.com/drwvqhof7/image/upload/v1763989471/ai_sketcher.jpg',
        },
      ],
      unsubscribeUrl: 'https://myalltools.vercel.app/unsubscribe/test-token',
    });

    // write file
    fs.writeFileSync(outFile, mail.html, 'utf8');
    console.log('✅ Preview written to:', outFile);
    console.log('Open this file in your browser to inspect the email HTML.');
  } catch (err) {
    console.error('❌ Failed to create preview:', err);
    process.exit(1);
  }
})();
