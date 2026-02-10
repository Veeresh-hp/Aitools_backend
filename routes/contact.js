// routes/contact.js
const express = require('express');
const router = express.Router();
const { sendEmail, emailTemplates } = require('../utils/emailService');

router.post('/', async (req, res) => {
  const { name, email, message, interest } = req.body;
  console.log(`📩 Received contact form submission from: ${name} (${email})`);

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  try {
    const mailOptions = emailTemplates.contactForm(name, email, message, interest);
    // Fire and forget - don't await
    console.log(`🚀 Attempting to send contact email to admin...`);
    sendEmail(mailOptions)
      .then(() => console.log(`✅ Contact email successfully sent for ${email}`))
      .catch(err => console.error('❌ Background email failed:', err));
    
    // Return success immediately
    res.status(200).json({ message: 'Message sent successfully! We will get back to you shortly.' });
  } catch (error) {
    // This catch block might not be reached for email errors anymore, 
    // but useful if template generation fails synchronously
    res.status(500).json({ error: 'Failed to process message.' });
  }
});

module.exports = router;