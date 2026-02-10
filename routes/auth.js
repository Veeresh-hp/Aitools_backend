/* File: routes/auth.js 
  Description: Handles all authentication-related routes including signup, login, 
               password reset, and Google OAuth.
*/

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendEmail, emailTemplates } = require('../utils/emailService');
const { OAuth2Client } = require('google-auth-library');

// Initialize Google Auth Client with the ID from environment variables
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// --- STANDARD USER SIGNUP ---
router.post('/signup', async (req, res) => {
  const { email, username, password } = req.body;
  try {
    // Basic validation
    if (!email || !username || !password) {
      return res.status(400).json({ error: 'Please provide email, username, and password' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    // Check for existing user with the same email or username
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'Email or username already exists' });
    }

    // Create and save the new user
    const user = new User({ email, username, password });
    await user.save();

    // Create a session token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Send welcome email in background (non-blocking for faster response)
    sendEmail(emailTemplates.welcome(user.email, user.username))
      .then(() => console.log('✅ Welcome email sent to:', user.email))
      .catch(e => console.error('❌ Failed to send welcome email to', user.email, ':', e.message));

    // Return the token and user info immediately
    res.status(201).json({
      token,
      user: { email: user.email, username: user.username },
    });
  } catch (error) {
    console.error('Signup error:', error.message);
    res.status(500).json({ error: 'Server error during signup' });
  }
});

// --- STANDARD USER LOGIN ---
router.post('/login', async (req, res) => {
  const { identifier, password } = req.body; // 'identifier' can be email or username
  try {
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Please provide username/email and password' });
    }

    // Find the user by email or username
    const user = await User.findOne({ $or: [{ email: identifier }, { username: identifier }] });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    if (user.isBanned) {
        return res.status(403).json({ error: 'Your account has been banned. Please contact support.' });
    }
    
    // Prevent Google users from logging in with a password
    if (!user.password) {
        return res.status(400).json({ error: 'Invalid credentials. You may have signed up with Google.' });
    }

    // Compare the provided password with the stored hash
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Create a session token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({
      token,
      user: { email: user.email, username: user.username, role: user.role },
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// --- TOKEN REFRESH ---
router.post('/refresh', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify the token (even if expired, we can still decode userId)
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      // If token is expired, try to decode without verification to get userId
      if (err.name === 'TokenExpiredError') {
        decoded = jwt.decode(token);
      } else {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Verify user still exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Issue new token
    const newToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({
      token: newToken,
      user: { email: user.email, username: user.username, role: user.role },
    });
  } catch (error) {
    console.error('Token refresh error:', error.message);
    res.status(500).json({ error: 'Server error during token refresh' });
  }
});

// --- FORGOT PASSWORD ---
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });

    // For security, send a generic success message even if the user doesn't exist
    if (!user) {
      return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }
    
    // Prevent password reset for Google-only accounts
    if (!user.password) {
        return res.status(400).json({ error: 'Cannot reset password for an account created with Google. Please log in with Google.' });
    }

    // Generate a secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // Token expires in 10 minutes
    await user.save();

    // Send the password reset email
    try {
      const mailOptions = emailTemplates.passwordReset(user.email, resetToken);
      await sendEmail(mailOptions);
      console.log('✅ Password reset email sent to:', user.email);
    } catch (emailError) {
      console.error('❌ Failed to send password reset email:', emailError.message);
      // Clear the token if the email fails to send
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();
      return res.status(500).json({ error: 'An error occurred while attempting to send the reset email.' });
    }

    res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });

  } catch (error) {
    console.error('Forgot password error:', error.message);
    res.status(500).json({ error: 'An error occurred.' });
  }
});

// --- RESET PASSWORD ---
router.post('/reset-password', async (req, res) => {
    const { token, password } = req.body;
    try {
        if (!token || !password) {
            return res.status(400).json({ error: 'Token and new password are required.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
        }

        // Hash the incoming token to compare with the one stored in the database
        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        // Find the user with a valid, non-expired token
        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() } // Check if the token has not expired
        });

        if (!user) {
            return res.status(400).json({ error: 'Password reset token is invalid or has expired.' });
        }

        // Update the user's password and clear the reset token fields
        user.password = password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        // Send a confirmation email that the password was changed
        try {
            const resetSuccessMailOptions = emailTemplates.resetSuccess(user.email, user.username);
            await sendEmail(resetSuccessMailOptions);
            console.log('✅ Password reset success email sent to:', user.email);
        } catch (emailError) {
            console.error('❌ Failed to send reset success email:', emailError.message);
        }

        // Log the user in immediately by providing a new session token
        const jwtToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({ 
            message: 'Password has been successfully reset.',
            token: jwtToken,
            user: { email: user.email, username: user.username },
        });

    } catch (error) {
        console.error('Reset password error:', error.message);
        res.status(500).json({ error: 'An error occurred while resetting the password.' });
    }
});

// --- GOOGLE LOGIN (using token from Google Identity Services) ---
router.post('/google-login', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Google token missing' });

    // Verify the token with Google's servers
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, email_verified } = payload;

    // Ensure the email is verified by Google
    if (!email_verified) {
      return res.status(400).json({ error: 'Google email not verified' });
    }

    let user = await User.findOne({ email: email.toLowerCase() });
    let isNewUser = false; // Flag to track if a new user is created

    if (user) {
      // Existing account. If first time Google linking, attach googleId and send welcome/link email.
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
        // Send welcome email in background (non-blocking for speed)
        sendEmail(emailTemplates.welcome(user.email, user.username))
          .then(() => console.log('✅ Welcome email sent on first Google link:', user.email))
          .catch(e => console.error('❌ Failed sending Google link welcome email to', user.email, ':', e.message));
      }
      
      if (user.isBanned) {
        return res.status(403).json({ error: 'Your account has been banned.' });
      }
    } else {
      // If the user doesn't exist, create a new one
      isNewUser = true;
      // Generate a unique username from the Google name or email with timestamp for uniqueness
      const base = (name?.replace(/\W/g, '') || email.split('@')[0]).toLowerCase();
      const username = `${base}${Date.now().toString().slice(-6)}`;

      user = await User.create({
        email,
        username,
        googleId,
        // No password is set for Google-based users
      });

      // Send welcome email in background (non-blocking for speed)
      sendEmail(emailTemplates.welcome(user.email, user.username))
        .then(() => console.log('✅ Welcome email sent to new Google user:', user.email))
        .catch(e => console.error('❌ Failed sending welcome email to Google user', user.email, ':', e.message));
    }

    // Create a session token for the user
    const jwtToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token: jwtToken,
      user: { email: user.email, username: user.username, role: user.role },
      isNewUser: isNewUser // Optionally inform the frontend if it's a new user
    });
  } catch (err) {
    console.error('Google login error:', err);
    res.status(500).json({ error: 'Google login failed' });
  }
});

// --- SYNC FAVORITES (authenticated) ---
router.post('/favorites/sync', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing auth token' });
    const token = authHeader.replace('Bearer ', '');
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const { favorites } = req.body; // array of keys
    if (!Array.isArray(favorites)) {
      return res.status(400).json({ error: 'Favorites must be an array' });
    }
    const user = await User.findById(payload.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.favorites = favorites.slice(0, 500); // reasonable cap
    await user.save();
    res.json({ message: 'Favorites synced', favorites: user.favorites });
  } catch (err) {
    console.error('Favorites sync error:', err.message);
    res.status(500).json({ error: 'Server error syncing favorites' });
  }
});

// --- GET FAVORITES ---
router.get('/favorites', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing auth token' });
    const token = authHeader.replace('Bearer ', '');
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const user = await User.findById(payload.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ favorites: user.favorites || [] });
  } catch (err) {
    console.error('Get favorites error:', err.message);
    res.status(500).json({ error: 'Server error retrieving favorites' });
  }
});

// --- CHANGE PASSWORD ---
router.post('/change-password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Google-only users don't have a password
    if (!user.password) {
      return res.status(400).json({ error: 'You are logged in via Google. You cannot change password.' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }

    // Update password (pre-save hook will hash it)
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error.message);
    res.status(500).json({ error: 'Server error updating password' });
  }
});

// --- DELETE ACCOUNT ---
router.delete('/delete-account', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    await User.findByIdAndDelete(decoded.userId);
    
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error.message);
    res.status(500).json({ error: 'Server error deleting account' });
  }
});

module.exports = router;