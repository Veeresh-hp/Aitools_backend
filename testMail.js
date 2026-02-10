const nodemailer = require('nodemailer');
require('dotenv').config(); // Load .env variables

async function testMail() {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: `"AI Tools Hub" <${process.env.EMAIL_USER}>`, // Correct sender display
      to: 'your.email@gmail.com', // You can change this to any recipient
      subject: 'AI Tools Hub Password Reset 😜',
      text: 'This is a test email from aitoolshub2@gmail.com using Nodemailer!',
    });

    console.log('✅ Email sent:', info.response);
  } catch (error) {
    console.error('❌ Failed to send test email:', error.message);
  }
}

testMail();
