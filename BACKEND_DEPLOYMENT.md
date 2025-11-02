# Backend Deployment Guide

## Why Deploy the Backend?

Your dashboard currently shows **mock data** on GitHub Pages because the backend server (`fred-proxy-server.js`) isn't deployed anywhere.

```
Current State:
  Frontend (GitHub Pages) → tries localhost:3001 → fails → uses mock data

Desired State:
  Frontend (GitHub Pages) → backend server (Heroku/etc) → FRED API → real data
```

## Option 1: Deploy to Heroku (Recommended - Free)

### Prerequisites
- Heroku account (free): https://signup.heroku.com/
- Heroku CLI installed: https://devcenter.heroku.com/articles/heroku-cli

### Step 1: Create Heroku App

```bash
# Login to Heroku
heroku login

# Create app (choose a unique name)
heroku create your-dashboard-backend

# This creates: https://your-dashboard-backend.herokuapp.com
```

### Step 2: Set Environment Variables

```bash
# Set your FRED API key
heroku config:set FRED_API_KEY=f31a77511e44f9da37c9ec6632333504 --app your-dashboard-backend

# Verify it was set
heroku config --app your-dashboard-backend
```

### Step 3: Deploy

```bash
# Make sure you're on your branch
git checkout claude/replace-mock-with-real-data-011CUjG3PDeUEaFWtmLTiwNi

# Deploy to Heroku
git push heroku claude/replace-mock-with-real-data-011CUjG3PDeUEaFWtmLTiwNi:main

# Check if it's running
heroku logs --tail --app your-dashboard-backend
```

### Step 4: Test Your Backend

```bash
# Test health endpoint
curl https://your-dashboard-backend.herokuapp.com/health

# Should return: {"status":"ok",...}

# Test FRED data
curl https://your-dashboard-backend.herokuapp.com/api/fred/DGS10

# Should return: {"observations":[...]}
```

### Step 5: Update Frontend Configuration

**Edit `src/js/config.js`:**

```javascript
export const CONFIG = {
    // API Configuration
    FRED_API_KEY: 'f31a77511e44f9da37c9ec6632333504',
    BACKEND_URL: 'https://your-dashboard-backend.herokuapp.com',  // ← Change this!

    // ... rest of config
};
```

**Commit and push:**

```bash
git add src/js/config.js
git commit -m "Config: Update backend URL to Heroku deployment"
git push
```

### Step 6: Wait for GitHub Pages to Rebuild

GitHub Actions will automatically rebuild and redeploy your site (takes ~2 minutes).

Then visit: https://substrateindependent.github.io/dailo_dashboard/

**You should now see: 🟢 Connected to FRED API - Live Data (13/13)**

---

## Option 2: Deploy to Render (Free Alternative)

### Step 1: Create Render Account

Sign up at: https://render.com (free tier available)

### Step 2: Create New Web Service

1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Select the branch: `claude/replace-mock-with-real-data-011CUjG3PDeUEaFWtmLTiwNi`
4. Configure:
   - **Name:** dailo-dashboard-backend
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node fred-proxy-server.js`
   - **Plan:** Free

### Step 3: Set Environment Variable

In Render dashboard:
- Go to "Environment"
- Add: `FRED_API_KEY` = `f31a77511e44f9da37c9ec6632333504`
- Save

### Step 4: Deploy

Render auto-deploys. Wait for it to complete.

Your backend URL will be: `https://dailo-dashboard-backend.onrender.com`

### Step 5: Update Frontend Config

Same as Heroku Option 1 Step 5, but use your Render URL.

---

## Option 3: Deploy to Vercel (Serverless)

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Create vercel.json

Create `vercel.json` in project root:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "fred-proxy-server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "fred-proxy-server.js"
    }
  ],
  "env": {
    "FRED_API_KEY": "f31a77511e44f9da37c9ec6632333504"
  }
}
```

### Step 3: Deploy

```bash
vercel --prod
```

You'll get a URL like: `https://dailo-dashboard-backend.vercel.app`

### Step 4: Update Frontend Config

Same as Option 1 Step 5, but use your Vercel URL.

---

## Option 4: Run Backend Locally (Development)

**For testing on your own computer:**

```bash
# Terminal 1: Backend
npm run proxy

# Terminal 2: Frontend
npm run serve

# Browser
http://localhost:8000
```

**Limitation:** Only works on your computer, not on GitHub Pages deployment.

---

## CORS Configuration (Important!)

If you deploy the backend to a different domain, you need to update CORS settings.

**Edit `fred-proxy-server.js` (around line 17):**

```javascript
// Replace this:
app.use(cors());

// With this (allow your GitHub Pages domain):
app.use(cors({
    origin: [
        'https://substrateindependent.github.io',
        'http://localhost:8000'  // for local testing
    ]
}));
```

Commit and redeploy backend after making this change.

---

## Testing Checklist

After deployment, verify:

### 1. Backend Health
```bash
curl https://your-backend-url.com/health
# Should return: {"status":"ok"}
```

### 2. Backend FRED Data
```bash
curl https://your-backend-url.com/api/fred/DGS10
# Should return: {"observations":[...]}
```

### 3. Frontend Connection
Open browser console on your GitHub Pages site and look for:
```
Connected to FRED proxy server
✓ Live data: 10-Year Treasury Yield: 4.35%
```

### 4. Connection Status
Bottom of dashboard should show:
```
🟢 Connected to FRED API - Live Data (13/13)
```

---

## Cost Analysis

| Service | Free Tier | Pros | Cons |
|---------|-----------|------|------|
| **Heroku** | 550-1000 dyno hours/month | Easy, reliable | Sleeps after 30 min inactivity |
| **Render** | 750 hours/month | Always on, easy | Limited to 1 instance |
| **Vercel** | Unlimited | Serverless, fast | Cold starts |
| **Railway** | $5 credit/month | Modern, easy | Need to add payment method |
| **Fly.io** | 3 VMs free | Fast, global | More complex setup |

**Recommendation:** Start with **Heroku** or **Render** (both have generous free tiers).

---

## Troubleshooting

### Backend deployed but frontend still shows mock data

**Check:**
1. Did you update `BACKEND_URL` in `config.js`?
2. Did you commit and push the config change?
3. Did GitHub Actions rebuild the site? (check Actions tab)
4. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
5. Check browser console for errors

### CORS errors in browser console

**Fix:** Update CORS settings in `fred-proxy-server.js` (see CORS Configuration above)

### Backend returns 403 from FRED

**Check:**
1. Environment variable is set: `heroku config --app your-app`
2. API key is correct
3. Try regenerating the key on FRED website

### Backend crashes/restarts frequently

**Check Heroku logs:**
```bash
heroku logs --tail --app your-dashboard-backend
```

Look for errors and fix accordingly.

---

## Summary

**Current State:**
- ✅ Frontend deployed on GitHub Pages
- ❌ Backend NOT deployed (shows mock data)

**To Get Real Data:**
1. Deploy backend to Heroku/Render/Vercel
2. Update `BACKEND_URL` in `config.js`
3. Commit and push changes
4. Wait for GitHub Pages to rebuild

**Result:** Real-time FRED data with trend analysis on your public dashboard! 🚀
