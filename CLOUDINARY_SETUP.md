# Cloudinary Setup Guide for Image Storage

## Problem
Images uploaded to `/uploads` folder are lost on Render deployments because:
- The folder is ephemeral (wiped on each deploy)
- It's likely in `.gitignore` (not pushed to git)

## Solution: Cloudinary (Free Cloud Storage)

### Step 1: Create Cloudinary Account
1. Go to https://cloudinary.com/users/register_free
2. Sign up for a free account (25GB storage, 25GB bandwidth/month)
3. After signup, go to Dashboard

### Step 2: Get Your Credentials
From your Cloudinary Dashboard, copy:
- **Cloud Name** (e.g., `dxyz123abc`)
- **API Key** (e.g., `123456789012345`)
- **API Secret** (e.g., `abcdefgh1234567890`)

### Step 3: Add Environment Variables to Render

1. Go to your Render dashboard: https://dashboard.render.com
2. Click on your backend service (`ai-tools-hub-backend`)
3. Go to **Environment** tab
4. Add these three variables:

```
CLOUDINARY_CLOUD_NAME=your_cloud_name_here
CLOUDINARY_API_KEY=your_api_key_here
CLOUDINARY_API_SECRET=your_api_secret_here
```

5. Click **Save Changes**
6. Render will automatically redeploy with new env vars

### Step 4: Test Upload
After deployment completes:
1. Go to https://myalltools.vercel.app/add-tool
2. Upload a new tool with an image
3. Submit for approval
4. Approve it in admin dashboard
5. Check if image shows on homepage

### Step 5: Re-upload Existing Tools (Optional)
For tools already approved with local images:
1. Download the images from your local `/uploads` folder
2. Go to admin dashboard
3. Edit each tool and re-upload the image
4. Save - new image will be stored on Cloudinary

## How It Works

**With Cloudinary configured:**
- Images upload to `https://res.cloudinary.com/your_cloud_name/...`
- Stored permanently in the cloud
- Fast CDN delivery worldwide
- Automatic image optimization

**Without Cloudinary (fallback):**
- Images save to local `/uploads` folder
- Works for local development only
- Lost on Render deployments

## Verification

Check your backend logs after deployment:
- ✅ `Using Cloudinary for image storage` = Success!
- ⚠️ `Using local storage for images (not suitable for production)` = Env vars missing

## Free Tier Limits
- 25 GB storage
- 25 GB bandwidth/month
- 25 credits/month (transformations)

This is plenty for your AI Tools Hub project!
