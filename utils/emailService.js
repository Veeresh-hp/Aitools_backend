/* File: utils/emailService.js
   Centralized email service using Resend HTTP API (no SMTP),
   with responsive light-themed branded templates + tracking.
   - Supports full Cloudinary URLs and cloudinaryId
   - Injects Cloudinary transforms when requested
   - Adds <img> fallback inside featured card & recent items for Outlook compatibility
   - Includes optional VML block for Outlook background support
*/

const { Resend } = require('resend');
const { htmlEscape } = require('./htmlEscape');

const MIN_NEW_TOOL_EMAIL_COUNT = parseInt(process.env.MIN_NEW_TOOL_EMAIL_COUNT || '5', 10);

// Defaults (your provided values)
const DEFAULT_FRONTEND = 'https://myalltools.vercel.app';
const DEFAULT_BACKEND = 'https://dashboard.render.com/web/srv-d101kj3ipnbc738dum80';

// ENV-based config (set these in Render / Vercel)
const resendApiKey = (process.env.RESEND_API_KEY || '').trim(); // <-- set your Resend API key here
const emailFrom = (process.env.EMAIL_FROM || '').trim(); // <-- e.g. "AI Tools Hub <noreply@myalltools.shop>"
const adminEmail = 'aitoolshub2@gmail.com'; // Hardcoded as per request to ensure it goes here instead of env var

// Logo logic: Priority 1: Env Var, Priority 2: Hardcoded Cloudinary, Priority 3: Local Uploads Fallback
// Logo logic: Priority 1: Env Var, Priority 2: Valid Cloudinary, Priority 3: Frontend Public URL
const CLOUDINARY_LOGO = 'https://res.cloudinary.com/drwvqhof7/image/upload/v1764583720/Logo_rngsqz.png'; // Replace with actual valid ID if known
const FRONTEND_LOGO = 'https://myalltools.vercel.app/logo.png'; // Assumes logo.png is in public/ of frontend
const brandLogoUrl = process.env.EMAIL_LOGO_URL || FRONTEND_LOGO;

// Cloudinary config (optional, used when using cloudinaryId or wanting to build URLs)
const CLOUDINARY_CLOUD_NAME = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();

if (!resendApiKey) {
  console.warn('⚠️ RESEND_API_KEY is not set. Emails will fail until configured.');
}
if (!emailFrom) {
  console.warn('⚠️ EMAIL_FROM is not set. It must match a verified domain in Resend.');
}

const resend = resendApiKey ? new Resend(resendApiKey) : null;

/* ---------------- Cloudinary helpers ---------------- */

/**
 * Build a Cloudinary URL from a public id and optional transforms.
 * Returns null if CLOUDINARY_CLOUD_NAME or publicId not provided.
 */
const buildCloudinaryUrl = (
  publicId,
  { w = 1200, h = 600, crop = 'fill', q = 'auto', f = 'auto', gravity = 'auto' } = {}
) => {
  if (!CLOUDINARY_CLOUD_NAME || !publicId) return null;
  const t = `w_${w},h_${h},c_${crop},g_${gravity},q_${q},f_${f}`;
  const cleanId = String(publicId).replace(/^\/+/, '');
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${t}/${cleanId}`;
};

/**
 * If a full Cloudinary URL is supplied, insert/replace transformations after /upload/
 * and return the modified URL. If not a cloudinary URL, returns rawUrl.
 */
const transformCloudinaryUrl = (
  rawUrl,
  { w = 1200, h = 600, crop = 'fill', gravity = 'auto', q = 'auto', f = 'auto' } = {}
) => {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname || '';
    if (!hostname.includes('res.cloudinary.com')) return rawUrl;

    const uploadSegment = '/upload/';
    const pathname = parsed.pathname || '';
    const idx = pathname.indexOf(uploadSegment);
    if (idx === -1) return rawUrl;

    const before = pathname.slice(0, idx + uploadSegment.length);
    const after = pathname.slice(idx + uploadSegment.length);
    const t = `w_${w},h_${h},c_${crop},g_${gravity},q_${q},f_${f}`;
    const newPath = `${before}${t}/${after}`.replace(/\/{2,}/g, '/');

    parsed.pathname = newPath;
    return parsed.toString();
  } catch (e) {
    return rawUrl;
  }
};

/**
 * Choose the best image URL to use for a tool. Priority:
 * 1) tool.snapshotUrl (backend) or tool.image (frontend/legacy).
 * 2) tool.cloudinaryId + CLOUDINARY_CLOUD_NAME (buildCloudinaryUrl)
 * 3) null
 */
const selectToolImage = (tool, { w, h, crop, gravity, q, f } = {}) => {
  if (!tool) return null;

  // Check snapshotUrl (backend) or image (frontend/legacy)
  const raw = tool.snapshotUrl || tool.image;

  if (raw && typeof raw === 'string' && raw.trim() !== '') {
    if ((w || h) && raw.includes('res.cloudinary.com')) {
      return transformCloudinaryUrl(raw, {
        w: w || 1200,
        h: h || 600,
        crop: crop || 'fill',
        gravity: gravity || 'auto',
        q: q || 'auto',
        f: f || 'auto',
      });
    }
    return raw;
  }

  // 2) cloudinaryId (public id)
  if (tool.cloudinaryId) {
    return buildCloudinaryUrl(tool.cloudinaryId, {
      w: w || 1200,
      h: h || 600,
      crop: crop || 'fill',
      gravity: gravity || 'auto',
      q: q || 'auto',
      f: f || 'auto',
    });
  }

  return null;
};

/* ---------------- Resend send helper ---------------- */

const sendEmail = async (mailOptions) => {
  try {
    if (!resend || !resendApiKey) {
      console.error('❌ RESEND_API_KEY missing or Resend not initialized.');
      throw new Error('Email service not configured.');
    }
    if (!emailFrom) {
      console.error('❌ EMAIL_FROM is not configured. Set it to a verified domain email.');
      throw new Error('Email FROM address not configured.');
    }

    // Add emoji to sender name if not present
    let fromAddress = mailOptions.from || emailFrom;
    if (!fromAddress.includes('🚀') && fromAddress.includes('<')) {
      fromAddress = fromAddress.replace('<', '🚀 <');
    }

    const payload = {
      ...mailOptions,
      from: fromAddress,
    };

    console.log('📧 Sending via Resend:', { to: payload.to, subject: payload.subject, from: payload.from });

    const { data, error } = await resend.emails.send(payload);

    if (error) {
      console.error('❌ Resend error:', error);
      throw new Error('Failed to send email.');
    }

    console.log('✅ Email sent successfully via Resend:', data?.id || data);
    return data;
  } catch (error) {
    console.error('❌ Error sending email:', error.message || error);
    throw new Error('Failed to send email.');
  }
};

/* ---------------- Styling + small helpers ---------------- */

const COLORS = {
  primary: '#6366f1',
  primaryLight: '#a5b4fc',
  primaryDark: '#4f46e5',
  accent: '#8b5cf6', // Violet accent
  accentLight: '#a78bfa',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  bgLight: '#f3f4f6', // Slightly darker grey for contrast
  bgCard: '#ffffff',
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  textPrimary: '#111827',
  textSecondary: '#4b5563',
  textMuted: '#9ca3af',
  gradientStart: '#e0e7ff', // Indigo 100
  gradientEnd: '#ede9fe', // Violet 100
  headerBg: '#1e1b4b', // Dark indigo for header
};

const addUtm = (rawUrl, { source = 'aitoolshub', medium = 'email', campaign = 'general' } = {}) => {
  try {
    const url = new URL(rawUrl);
    url.searchParams.set('utm_source', source);
    url.searchParams.set('utm_medium', medium);
    url.searchParams.set('utm_campaign', campaign);
    return url.toString();
  } catch {
    return rawUrl;
  }
};

const createButton = (url, text, style = 'primary') => {
  const styles = {
    primary: { bg: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`, color: '#ffffff', shadow: '0 4px 14px 0 rgba(99,102,241,0.4)' },
    accent: { bg: `linear-gradient(135deg, ${COLORS.accent} 0%, ${COLORS.success} 100%)`, color: '#ffffff', shadow: '0 4px 14px 0 rgba(16,185,129,0.4)' },
    secondary: { bg: COLORS.bgCard, color: COLORS.textPrimary, shadow: '0 2px 8px 0 rgba(0,0,0,0.1)', border: `1px solid ${COLORS.border}` },
  };
  const btnStyle = styles[style] || styles.primary;
  return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:${btnStyle.bg};color:${btnStyle.color};font-size:15px;font-weight:600;padding:14px 32px;border-radius:12px;text-decoration:none;box-shadow:${btnStyle.shadow};${btnStyle.border ? `border:${btnStyle.border};` : ''}transition:all 0.3s ease;font-family:inherit;letter-spacing:0.3px;">${text}</a>`;
};

/* ---------------- Email Shell ---------------- */

const buildShell = ({ title, preheader = '', heroEmoji = '✨', bodyHtml, showFooterCta = true, unsubscribeUrl = null }) => {
  const siteUrl = process.env.FRONTEND_URL || DEFAULT_FRONTEND;
  const trackedSiteUrl = addUtm(siteUrl, { campaign: 'footer', medium: 'email-footer' });
  // Robust unique ID using timestamp + random string to prevent Gmail threading/trimming
  const uniqueId = Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 8);

  return `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>${title}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
        body { font-family: 'Outfit', 'Helvetica Neue', Helvetica, Arial, sans-serif; margin:0; padding:0; background-color: ${COLORS.bgLight}; -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; color: ${COLORS.textPrimary}; }
        .email-wrapper { width: 100%; background-color: ${COLORS.bgLight}; padding: 40px 0; }
        .email-container { max-width: 600px; margin: 0 auto; background-color: ${COLORS.bgCard}; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px -10px rgba(0,0,0,0.1); }
        .header { background-color: ${COLORS.headerBg}; padding: 32px; text-align: center; background-image: linear-gradient(135deg, ${COLORS.primaryDark} 0%, ${COLORS.accent} 100%); }
        /* Simplified Logo Style for better compatibility */
        .logo { width: 64px; height: 64px; margin: 0 auto; display: block; }
        .logo img { width: 100%; height: 100%; object-fit: contain; border-radius: 12px; display: block; }
        .brand-name { color: #ffffff; font-size: 24px; font-weight: 700; margin-top: 16px; letter-spacing: -0.5px; }
        .content { padding: 40px 32px; }
        .footer { background-color: ${COLORS.bgLight}; padding: 32px; text-align: center; font-size: 12px; color: ${COLORS.textMuted}; border-top: 1px solid ${COLORS.border}; }
        .footer a { color: ${COLORS.textSecondary}; text-decoration: underline; }
        
        @media only screen and (max-width: 600px) {
          .email-wrapper { padding: 0; }
          .email-container { width: 100% !important; border-radius: 0; box-shadow: none; }
          .content { padding: 24px 20px; }
          .header { padding: 24px 20px; }
        }
      </style>
    </head>
    <body>
      <div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0;font-size:1px;line-height:1px;mso-hide:all;">${preheader}</div>
      <div class="email-wrapper">
        <div class="email-container">
          <!-- Header -->
          <div class="header">
            <div class="logo">
              <img src="${brandLogoUrl}" alt="AI Tools Hub" width="64" height="64" />
            </div>
            <div class="brand-name">AI Tools Hub</div>
            <div style="color: rgba(255,255,255,0.8); font-size: 14px; margin-top: 4px;">Your Gateway to the Best AI Tools</div>
          </div>

          <!-- Content -->
          <div class="content">
            ${bodyHtml}
          </div>

          <!-- Footer -->
          <div class="footer">
            <p style="margin: 0 0 12px;">Sent with 💜 by AI Tools Hub</p>
            <p style="margin: 0;">
              ${unsubscribeUrl ? `<a href="${addUtm(unsubscribeUrl, { campaign: 'unsubscribe', medium: 'email-footer' })}">Unsubscribe</a> • ` : ''}
              <a href="${trackedSiteUrl}">Visit Website</a>
            </p>
            <p style="margin: 12px 0 0; opacity: 0.6;">© ${new Date().getFullYear()} AI Tools Hub. All rights reserved.</p>
            <!-- Visible unique ID to prevent Gmail threading/trimming -->
            <p style="margin: 20px 0 0; font-size: 10px; opacity: 0.4;">Message ID: ${uniqueId}</p>
          </div>
        </div>
      </div>
    </body>
  </html>
  `;
};

/* ------------------------------------------------------------------
   Premium Email Templates (complete)
   - All templates include same content as before
   - newToolAnnouncement includes img fallbacks for featured + recent items
-------------------------------------------------------------------*/

const emailTemplates = {
  passwordReset: (recipientEmail, token) => {
    const rawResetURL = `${process.env.FRONTEND_URL || DEFAULT_FRONTEND}/reset-password?token=${token}`;
    const resetURL = addUtm(rawResetURL, { campaign: 'password-reset', medium: 'transactional' });

    const bodyHtml = `
      <div style="margin-bottom:28px;">
        <h1 class="mobile-heading" style="margin:0 0 14px;font-size:28px;font-weight:700;color:${COLORS.textPrimary};">Reset Your Password</h1>
        <p class="mobile-text" style="margin:0 0 16px;font-size:15px;color:${COLORS.textSecondary};">We received a request to reset the password for your AI Tools Hub account. Click the button below to create a new password.</p>
      </div>
      <div style="background:linear-gradient(135deg, ${COLORS.gradientStart} 0%, rgba(99, 102, 241, 0.08) 100%);padding:20px;border-radius:14px;border:1px solid ${COLORS.border};margin:0 0 24px;">
        <table width="100%"><tr>
          <td style="vertical-align:top;width:48px;padding-right:14px;">
            <div style="width:40px;height:40px;background:${COLORS.primary};border-radius:10px;display:flex;align-items:center;justify-content:center;"><span style="font-size:20px;">🔒</span></div>
          </td>
          <td style="vertical-align:top;">
            <div style="font-size:14px;font-weight:600;color:${COLORS.textPrimary};margin:0 0 4px;">Security Notice</div>
            <div style="font-size:12px;color:${COLORS.textMuted};margin:0 0 12px;">This link expires in 10 minutes</div>
            <p style="margin:0;font-size:13px;color:${COLORS.textSecondary};line-height:1.6;">If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>
          </td>
        </tr></table>
      </div>
      <div style="margin:28px 0 24px;text-align:center;">${createButton(resetURL, '🔐 Reset Password', 'primary')}</div>
      <div style="padding:16px;background:rgba(239, 68, 68, 0.08);border-radius:12px;border-left:3px solid ${COLORS.danger};">
        <p style="margin:0;font-size:13px;color:${COLORS.textSecondary};line-height:1.6;"><strong style="color:${COLORS.textPrimary};">Important:</strong> For your security, this password reset link will expire in 10 minutes. If you need more time, please request a new reset link.</p>
      </div>
    `;

    return { from: emailFrom, to: recipientEmail, subject: '🔐 Reset Your AI Tools Hub Password', html: buildShell({ title: 'Password Reset Request', preheader: 'Use this secure link to reset your AI Tools Hub password within the next 10 minutes.', heroEmoji: '🔐', bodyHtml, showFooterCta: false }) };
  },

  welcome: (recipientEmail, username) => {
    const safeName = htmlEscape((username && username.trim()) || 'there');
    const loginURL = addUtm(`${process.env.FRONTEND_URL || DEFAULT_FRONTEND}/login`, { campaign: 'welcome', medium: 'onboarding', source: 'signup' });

    const bodyHtml = `
      <div style="margin-bottom:28px;">
        <h1 class="mobile-heading" style="margin:0 0 12px;font-size:30px;font-weight:700;color:${COLORS.textPrimary};">Welcome to AI Tools Hub, ${safeName}! 👋</h1>
        <p class="mobile-text" style="margin:0;font-size:16px;color:${COLORS.textSecondary};">You've just joined thousands of professionals discovering, comparing, and leveraging the best AI tools on the web.</p>
      </div>
      <div style="background:linear-gradient(135deg, ${COLORS.gradientStart} 0%, ${COLORS.gradientEnd} 100%);padding:24px;border-radius:14px;border:1px solid ${COLORS.border};margin:0 0 24px;">
        <h2 style="margin:0 0 18px;font-size:18px;font-weight:600;color:${COLORS.textPrimary};">🚀 What You Can Do Now</h2>
        <table width="100%"><tr><td style="padding-bottom:14px;">
          <table role="presentation"><tr>
            <td style="vertical-align:top;width:40px;padding-right:12px;"><div style="width:32px;height:32px;background:${COLORS.accent};border-radius:8px;display:flex;align-items:center;justify-content:center;"><span style="font-size:16px;">🔍</span></div></td>
            <td style="vertical-align:top;"><div style="font-size:15px;font-weight:600;color:${COLORS.textPrimary};margin:0 0 4px;">Explore Curated Collections</div><div style="font-size:13px;color:${COLORS.textSecondary};line-height:1.5;">Browse tools by category - chatbots, coding, video creation, design, and more.</div></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding-bottom:14px;">
          <table role="presentation"><tr>
            <td style="vertical-align:top;width:40px;padding-right:12px;"><div style="width:32px;height:32px;background:${COLORS.primary};border-radius:8px;display:flex;align-items:center;justify-content:center;"><span style="font-size:16px;">⭐</span></div></td>
            <td style="vertical-align:top;"><div style="font-size:15px;font-weight:600;color:${COLORS.textPrimary};margin:0 0 4px;">Bookmark Your Favorites</div><div style="font-size:13px;color:${COLORS.textSecondary};line-height:1.5;">Save tools you love and access them instantly from your personalized dashboard.</div></td>
          </tr></table>
        </td></tr>
        <tr><td><table role="presentation"><tr>
          <td style="vertical-align:top;width:40px;padding-right:12px;"><div style="width:32px;height:32px;background:${COLORS.warning};border-radius:8px;display:flex;align-items:center;justify-content:center;"><span style="font-size:16px;">🔔</span></div></td>
          <td style="vertical-align:top;"><div style="font-size:15px;font-weight:600;color:${COLORS.textPrimary};margin:0 0 4px;">Stay Updated</div><div style="font-size:13px;color:${COLORS.textSecondary};line-height:1.5;">Get notified when we add new tools that match your interests and workflow.</div></td>
        </tr></table></td></tr></table>
      </div>
      <div style="margin:28px 0 24px;text-align:center;">${createButton(loginURL, '🎯 Go to Your Dashboard', 'accent')}</div>
      <div style="padding:20px;background:${COLORS.bgLight};border-radius:12px;border:1px solid ${COLORS.border};text-align:center;"><p style="margin:0 0 8px;font-size:14px;color:${COLORS.textSecondary};"><strong style="color:${COLORS.textPrimary};">Have questions or feedback?</strong></p><p style="margin:0;font-size:13px;color:${COLORS.textMuted};line-height:1.5;">Just reply to this email - we read every message and would love to hear from you!</p></div>
    `;

    return { from: emailFrom, to: recipientEmail, subject: '🎉 Welcome to AI Tools Hub - Your Journey Starts Here!', html: buildShell({ title: 'Welcome to AI Tools Hub', preheader: 'Browse curated AI tools, save your favorites, and stay ahead of the curve.', heroEmoji: '🚀', bodyHtml }) };
  },

  resetSuccess: (recipientEmail, username) => {
    const loginURL = addUtm(`${process.env.FRONTEND_URL || DEFAULT_FRONTEND}/login`, { campaign: 'password-reset-success', medium: 'transactional' });
    const bodyHtml = `
      <div style="text-align:center;margin-bottom:28px;">
        <div style="display:inline-block;width:72px;height:72px;background:linear-gradient(135deg, ${COLORS.success} 0%, ${COLORS.accent} 100%);border-radius:50%;margin:0 0 18px;box-shadow:0 4px 16px rgba(34,197,94,0.25);"><table width="100%" height="100%"><tr><td align="center" valign="middle" style="font-size:32px;">✅</td></tr></table></div>
        <h1 class="mobile-heading" style="margin:0 0 12px;font-size:26px;font-weight:700;color:${COLORS.textPrimary};">Password Updated Successfully</h1>
        <p class="mobile-text" style="margin:0;font-size:15px;color:${COLORS.textSecondary};">Hi ${htmlEscape(username || 'there')}, your account is now secure with your new password.</p>
      </div>
      <div style="background:linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(16,185,129,0.08) 100%);padding:20px;border-radius:14px;border:1px solid rgba(34,197,94,0.2);margin:0 0 24px;">
        <table width="100%"><tr>
          <td style="vertical-align:top;width:44px;padding-right:12px;"><div style="width:36px;height:36px;background:${COLORS.success};border-radius:8px;display:flex;align-items:center;justify-content:center;"><span style="font-size:18px;">🎉</span></div></td>
          <td style="vertical-align:top;"><div style="font-size:16px;font-weight:600;color:${COLORS.textPrimary};margin:0 0 8px;">All Set!</div><p style="margin:0;font-size:14px;color:${COLORS.textSecondary};line-height:1.6;">Your password has been changed and your account is now secure. You can log in anytime using your new credentials.</p></td>
        </tr></table>
      </div>
      <div style="margin:28px 0 24px;text-align:center;">${createButton(loginURL, '🔓 Log In to Your Account', 'primary')}</div>
      <div style="padding:18px;background:rgba(239,68,68,0.08);border-radius:12px;border-left:3px solid ${COLORS.danger};"><table width="100%"><tr><td style="vertical-align:top;width:32px;padding-right:10px;font-size:22px;">⚠️</td><td style="vertical-align:top;"><div style="font-size:14px;font-weight:600;color:${COLORS.textPrimary};margin:0 0 6px;">Didn't make this change?</div><p style="margin:0;font-size:13px;color:${COLORS.textSecondary};line-height:1.6;">If you didn't reset your password, please <strong>contact us immediately</strong> and reset your password again to secure your account.</p></td></tr></table></div>
    `;
    return { from: emailFrom, to: recipientEmail, subject: '✅ Your AI Tools Hub Password Was Changed', html: buildShell({ title: 'Password Changed Successfully', preheader: 'This is a confirmation that your AI Tools Hub password was successfully updated.', heroEmoji: '✅', bodyHtml, showFooterCta: false }) };
  },

  contactForm: (name, email, message, interest) => {
    const safeName = htmlEscape(name || 'Unknown');
    const safeEmail = htmlEscape(email || '');
    const safeMsg = htmlEscape(message || '');
    const safeInterest = htmlEscape(interest || 'General Inquiry');

    const bodyHtml = `
      <div style="margin-bottom:24px;">
        <h1 class="mobile-heading" style="margin:0 0 12px;font-size:24px;font-weight:700;color:${COLORS.textPrimary};">💬 New Contact Message</h1>
        <p class="mobile-text" style="margin:0;font-size:15px;color:${COLORS.textSecondary};">You've received a new message via the AI Tools Hub contact form.</p>
      </div>
      <div style="background:${COLORS.bgLight};padding:24px;border-radius:14px;border:1px solid ${COLORS.border};margin:0 0 24px;">
        <div style="margin-bottom:18px;padding-bottom:18px;border-bottom:1px solid ${COLORS.border};">
          <div style="font-size:12px;color:${COLORS.textMuted};margin:0 0 6px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">From</div>
          <div style="font-size:16px;font-weight:600;color:${COLORS.textPrimary};margin:0 0 4px;">${safeName}</div>
          <a href="mailto:${safeEmail}" style="font-size:14px;color:${COLORS.primary};text-decoration:none;">${safeEmail}</a>
        </div>
        <div style="margin-bottom:18px;padding-bottom:18px;border-bottom:1px solid ${COLORS.border};">
           <div style="font-size:12px;color:${COLORS.textMuted};margin:0 0 6px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Interest</div>
           <div style="font-size:15px;color:${COLORS.textPrimary};font-weight:500;">${safeInterest}</div>
        </div>
        <div><div style="font-size:12px;color:${COLORS.textMuted};margin:0 0 10px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Message</div>
          <div style="padding:16px;background:${COLORS.bgCard};border-radius:10px;border-left:3px solid ${COLORS.primary};"><p style="margin:0;font-size:14px;color:${COLORS.textSecondary};line-height:1.7;white-space:pre-wrap;">${safeMsg}</p></div>
        </div>
      </div>
      <div style="padding:16px;background:linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.08) 100%);border-radius:12px;border:1px solid ${COLORS.border};text-align:center;"><p style="margin:0;font-size:13px;color:${COLORS.textMuted};">💡 <strong style="color:${COLORS.textPrimary};">Pro tip:</strong> Reply directly to this email to continue the conversation with ${safeName}.</p></div>
    `;
    return { from: emailFrom, to: adminEmail, replyTo: email, subject: `📩 New Contact: ${safeName} - AI Tools Hub`, html: buildShell({ title: 'New Contact Form Message', preheader: `${safeName} (${safeEmail}) sent you a message via AI Tools Hub.`, heroEmoji: '💬', bodyHtml, showFooterCta: false }) };
  },

  /**
   * newToolAnnouncement (featured card uses background image + <img> fallback + optional VML for Outlook)
   */
  newToolAnnouncement: ({ recipientEmail, tool, recentTools, unsubscribeUrl }) => {
    const loginURL = addUtm(`${process.env.FRONTEND_URL || DEFAULT_FRONTEND}/login`, { campaign: 'tool-announcement', medium: 'notification' });
    const signupURL = addUtm(`${process.env.FRONTEND_URL || DEFAULT_FRONTEND}/signup`, { campaign: 'tool-announcement', medium: 'notification' });

    const safeToolName = htmlEscape(tool.name || 'New Tool');
    const safeToolDesc = htmlEscape(tool.description || '');
    const featuredBg = selectToolImage(tool, { w: 1200, h: 600 });

    // Featured card style (background). We'll still render an <img> fallback inside the card.
    const featuredCardStyle = featuredBg
      ? `background:linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.72) 100%), url('${featuredBg}') center/cover no-repeat;border-radius:16px;border:2px solid ${COLORS.primary};box-shadow:0 4px 12px rgba(99,102,241,0.15);padding:24px;`
      : `background:linear-gradient(135deg, ${COLORS.gradientStart} 0%, rgba(99,102,241,0.1) 100%);border:2px solid ${COLORS.primary};box-shadow:0 4px 12px rgba(99,102,241,0.15);padding:24px;border-radius:16px;`;

    const toolLink = addUtm(htmlEscape(tool.url || process.env.FRONTEND_URL || DEFAULT_FRONTEND), { campaign: 'tool-click', medium: 'notification' });

    const listHtml = (recentTools || []).map((t) => {
      const itemName = htmlEscape(t.name || 'Tool');
      const itemDesc = htmlEscape(t.description || '');
      const itemUrl = addUtm(htmlEscape(t.url || process.env.FRONTEND_URL || DEFAULT_FRONTEND), { campaign: 'recent-tools', medium: 'notification' });
      const itemImg = selectToolImage(t, { w: 800, h: 400 }) || '';

      const itemBgStyle = itemImg
        ? `background:linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.85) 100%), url('${itemImg}') center/cover no-repeat;border-radius:12px;border:1px solid ${COLORS.border};padding:18px;`
        : `background:${COLORS.bgLight};padding:18px;border-radius:12px;border:1px solid ${COLORS.border};`;

      // Provide an <img> fallback for clients that don't render background images
      const itemImgTag = itemImg
        ? `<div style="margin:0 0 12px;"><img src="${itemImg}" alt="${itemName}" style="width:100%;height:auto;display:block;border-radius:10px;object-fit:cover;max-height:180px;"/></div>`
        : '';

      return `
        <div style="margin:0 0 12px;${itemBgStyle}">
          ${itemImgTag}
          <div style="margin-bottom:8px;">
            <div style="font-size:15px;font-weight:600;color:${COLORS.textPrimary};margin:0 0 6px;line-height:1.3;">${itemName}</div>
            <div style="font-size:13px;color:${COLORS.textSecondary};line-height:1.6;margin:0 0 12px;">${itemDesc.substring(0, 120)}${itemDesc.length > 120 ? '...' : ''}</div>
          </div>
          <a href="${itemUrl}" class="mobile-button" style="display:inline-block;font-size:13px;text-decoration:none;background:${COLORS.primary};color:#ffffff;padding:10px 20px;border-radius:10px;font-weight:600;box-shadow:0 2px 6px rgba(99,102,241,0.25);" target="_blank" rel="noopener noreferrer">Explore ${itemName} →</a>
        </div>`;
    }).join('');

    // For featured card we provide a VML block for Outlook and an <img> fallback for other clients.
    const featuredImgTag = featuredBg
      ? `
      <!-- Outlook VML background (only for Outlook) -->
      <!--[if mso]>
      <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;height:360px;">
        <v:fill type="frame" src="${featuredBg}" color="#ffffff" />
        <v:textbox inset="0,0,0,0">
      <![endif]-->

      <div style="margin:0 0 14px;">
        <img src="${featuredBg}" alt="${safeToolName}" style="width:100%;height:auto;display:block;border-radius:12px;object-fit:cover;max-height:360px;"/>
      </div>

      <!--[if mso]>
        </v:textbox>
      </v:rect>
      <![endif]-->`
      : '';

    const bodyHtml = `
      <div style="margin-bottom:24px;">
        <div style="display:inline-block;padding:6px 14px;background:linear-gradient(135deg, ${COLORS.accent} 0%, ${COLORS.success} 100%);border-radius:20px;margin:0 0 14px;box-shadow:0 2px 6px rgba(16,185,129,0.25);">
          <span style="font-size:11px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.8px;">🆕 Fresh Addition</span>
        </div>
        <h1 class="mobile-heading" style="margin:0 0 10px;font-size:28px;font-weight:700;color:${COLORS.textPrimary};letter-spacing:-0.5px;line-height:1.2;">Discover: ${safeToolName}</h1>
        <p class="mobile-text" style="margin:0;font-size:16px;color:${COLORS.textSecondary};line-height:1.7;">We just added a powerful new AI tool that could transform your workflow.</p>
      </div>

      <!-- Featured Tool Card (background + VML for Outlook + img fallback) -->
      <div style="margin:0 0 28px;${featuredCardStyle}">
        ${featuredImgTag}
        <table width="100%" role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-bottom:14px;vertical-align:top;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:top;width:56px;padding-right:12px;">
                    <div style="width:48px;height:48px;background:${COLORS.primary};border-radius:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(99,102,241,0.3);">
                      <span style="font-size:24px;">🚀</span>
                    </div>
                  </td>
                  <td style="vertical-align:top;">
                    <div style="font-size:19px;font-weight:700;color:${COLORS.textPrimary};margin:0 0 4px;letter-spacing:-0.3px;">${safeToolName}</div>
                    <div style="font-size:11px;color:${COLORS.textMuted};text-transform:uppercase;letter-spacing:0.6px;font-weight:600;">Featured AI Tool</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <p style="margin:0 0 18px;font-size:14px;color:${COLORS.textSecondary};line-height:1.7;">${safeToolDesc}</p>

        <div style="text-align:center;">
          ${createButton(toolLink, `🎯 Try ${safeToolName} Now`, 'accent')}
        </div>
      </div>

      ${recentTools && recentTools.length ? `
        <div style="margin:0 0 24px;">
          <div style="margin:0 0 18px;padding-bottom:10px;border-bottom:2px solid ${COLORS.borderLight};">
            <h2 style="margin:0 0 6px;font-size:19px;font-weight:700;color:${COLORS.textPrimary};">✨ More Recent Additions</h2>
            <p style="margin:0;font-size:13px;color:${COLORS.textMuted};">Check out these other tools we've added recently</p>
          </div>
          ${listHtml}
        </div>` : ''}

      <div style="padding:24px;background:linear-gradient(135deg, ${COLORS.gradientStart} 0%, ${COLORS.gradientEnd} 100%);border-radius:14px;border:1px solid ${COLORS.border};text-align:center;">
        <div style="font-size:17px;font-weight:600;color:${COLORS.textPrimary};margin:0 0 8px;">🎁 Get Personalized Recommendations</div>
        <p style="margin:0 0 18px;font-size:14px;color:${COLORS.textSecondary};line-height:1.6;">Create a free account to bookmark favorites, get tailored suggestions, and never miss the tools that matter to you.</p>
        <div style="display:flex;gap:10px;justify-content:center">${createButton(signupURL, '🚀 Sign Up Free', 'primary')}${createButton(loginURL, 'Log In', 'secondary')}</div>
      </div>
    `;

    return {
      from: emailFrom,
      to: recipientEmail,
      subject: `🚀 New AI Tool: ${safeToolName} - Explore Now!`,
      html: buildShell({
        title: `New AI Tool: ${safeToolName}`,
        preheader: `${safeToolName} just landed on AI Tools Hub. Discover what it can do for you.`,
        heroEmoji: '🧰',
        bodyHtml,
        unsubscribeUrl,
      }),
    };
  },

  newToolDigest: ({ recipientEmail, tools, unsubscribeUrl }) => {
    const loginURL = addUtm(`${process.env.FRONTEND_URL || DEFAULT_FRONTEND}/login`, { campaign: 'weekly-digest', medium: 'notification' });
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const items = (tools || []).map((t, index) => {
      const itemName = htmlEscape(t.name || 'Tool');
      const itemDesc = htmlEscape(t.description || '');
      const itemUrl = addUtm(htmlEscape(t.url || process.env.FRONTEND_URL || DEFAULT_FRONTEND), { campaign: 'digest-click', medium: 'notification' });
      const itemImg = selectToolImage(t, { w: 600, h: 300 });

      return `
        <div style="margin-bottom: 24px; border: 1px solid ${COLORS.border}; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
          ${itemImg ? `<a href="${itemUrl}" style="display: block;"><img src="${itemImg}" alt="${itemName}" style="width: 100%; height: 200px; object-fit: cover; display: block;" /></a>` : ''}
          <div style="padding: 20px;">
            <h3 style="margin: 0 0 8px; font-size: 18px; font-weight: 700; color: ${COLORS.textPrimary};">
              <a href="${itemUrl}" style="text-decoration: none; color: ${COLORS.textPrimary};">${itemName}</a>
            </h3>
            <p style="margin: 0 0 16px; font-size: 14px; color: ${COLORS.textSecondary}; line-height: 1.6;">${itemDesc.substring(0, 120)}${itemDesc.length > 120 ? '...' : ''}</p>
            <a href="${itemUrl}" style="display: inline-block; padding: 10px 20px; background-color: ${COLORS.primary}; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 8px;">Explore Tool</a>
          </div>
        </div>
      `;
    }).join('');

    const bodyHtml = `
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: ${COLORS.textMuted}; margin-bottom: 8px;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        <h1 style="margin: 0 0 12px; font-size: 28px; font-weight: 700; color: ${COLORS.textPrimary};">Fresh AI Tools for You</h1>
        <p style="margin: 0; font-size: 16px; color: ${COLORS.textSecondary};">We've curated ${tools.length} new AI tools this week to supercharge your workflow.</p>
      </div>

      <div style="margin-bottom: 32px;">
        ${items}
        <div style="text-align: center; padding-top: 16px;">
           <div style="display: inline-block; width: 6px; height: 6px; background: ${COLORS.primaryLight}; border-radius: 50%; margin: 0 4px;"></div>
           <div style="display: inline-block; width: 6px; height: 6px; background: ${COLORS.primary}; border-radius: 50%; margin: 0 4px;"></div>
           <div style="display: inline-block; width: 6px; height: 6px; background: ${COLORS.primaryLight}; border-radius: 50%; margin: 0 4px;"></div>
           <div style="margin-top: 8px; font-size: 13px; color: ${COLORS.textSecondary}; font-weight: 500;">And many more...</div>
        </div>
      </div>

      <div style="text-align: center; padding: 32px; background: ${COLORS.gradientStart}; border-radius: 16px; border: 1px solid ${COLORS.primaryLight};">
        <h3 style="margin: 0 0 8px; font-size: 20px; font-weight: 700; color: ${COLORS.textPrimary};">Want more?</h3>
        <p style="margin: 0 0 20px; font-size: 15px; color: ${COLORS.textSecondary};">Discover hundreds of other AI tools on our platform.</p>
        ${createButton(loginURL, 'Browse All Tools', 'primary')}
      </div>
    `;

    return {
      from: emailFrom,
      to: recipientEmail,
      subject: `✨ ${tools.length} New AI Tools - ${dateStr}`,
      html: buildShell({
        title: 'Your AI Tools Digest',
        preheader: `Check out ${tools.length} new AI tools added this week: ${tools.map(t => t.name).slice(0, 3).join(', ')}...`,
        bodyHtml,
        unsubscribeUrl,
      }),
    };
  },
};

/* ------------------------------------------------------------------
   Send new tool emails to subscribers
-------------------------------------------------------------------*/

const sendNewToolEmail = async (tool, subscribers, recentTools = []) => {
  if (!tool || !subscribers || subscribers.length === 0) return;

  const totalCount = 1 + recentTools.length;
  if (totalCount < MIN_NEW_TOOL_EMAIL_COUNT) {
    console.log(`ℹ️ Skipping new tool email (only ${totalCount} < ${MIN_NEW_TOOL_EMAIL_COUNT})`);
    return;
  }

  const Subscriber = require('../models/Subscriber');
  const backendBase = process.env.BACKEND_URL || DEFAULT_BACKEND;
  const uniqueByEmail = new Map();

  for (const s of subscribers) {
    if (s && s.email && !uniqueByEmail.has(s.email)) uniqueByEmail.set(s.email, s);
  }

  // Send sequentially to respect rate limits (2 req/sec)
  const DELAY_MS = 800;
  const emails = [...uniqueByEmail.keys()];

  for (const email of emails) {
    const sDoc = uniqueByEmail.get(email);
    if (!sDoc || sDoc.isUnsubscribed) continue;

    const unsubscribeUrl = `${backendBase}/api/newsletter/unsubscribe/${sDoc.unsubscribeToken}`;
    const mail = emailTemplates.newToolAnnouncement({
      recipientEmail: email,
      tool,
      recentTools: recentTools.slice(0, 5),
      unsubscribeUrl,
    });

    try {
      await sendEmail(mail);
      await Subscriber.updateOne({ _id: sDoc._id }, { $set: { lastSentAt: new Date() } });
    } catch (err) {
      console.error(`Failed to send new tool email to ${email}:`, err.message);
    }

    // Wait before next request
    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
  }
};

module.exports = { sendEmail, emailTemplates, sendNewToolEmail };
