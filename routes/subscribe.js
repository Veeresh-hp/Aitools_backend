const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { welcome } = require('../utils/emailService');

router.post('/subscribe', async (req, res) => {
  const { email } = req.body;

  // Create transporter
  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  // Define mail options using the template
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Welcome to AI Tools Hub 🚀',
    html: welcome(email)
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Welcome email sent successfully!' });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ message: 'Failed to send welcome email.' });
  }
});
