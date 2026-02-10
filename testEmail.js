/* Quick test script to verify email sending works */
require('dotenv').config();
const { sendEmail, emailTemplates } = require('./utils/emailService');

async function testEmailService() {
  console.log('📧 Testing email service...');
  console.log('EMAIL_USER:', process.env.EMAIL_USER);
  console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '****' + process.env.EMAIL_PASS.slice(-4) : 'NOT SET');
  console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
  
  try {
    // Test welcome email
    const testEmail = process.env.EMAIL_USER; // Send to yourself
    const welcomeMailOptions = emailTemplates.welcome(testEmail, 'TestUser');
    
    console.log('\n📤 Attempting to send test welcome email to:', testEmail);
    await sendEmail(welcomeMailOptions);
    console.log('✅ SUCCESS! Email sent successfully.');
    process.exit(0);
  } catch (error) {
    console.error('❌ FAILED to send email:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testEmailService();
