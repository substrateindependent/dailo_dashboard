# Deployment Guide

## GitHub Pages Deployment

This dashboard is configured to automatically deploy to GitHub Pages.

### Automatic Deployment

The GitHub Actions workflow (`.github/workflows/deploy.yml`) automatically deploys the site when you push to:
- `main` branch
- `master` branch
- `claude/evaluate-codebase-011CUhU7dpUbS8YegJDeHXoU` branch

### First-Time Setup

To enable GitHub Pages for this repository:

1. Go to your GitHub repository: `https://github.com/substrateindependent/dailo_dashboard`

2. Click **Settings** (top right)

3. Click **Pages** (left sidebar under "Code and automation")

4. Under **Source**, select:
   - Source: **GitHub Actions**

5. Save the settings

6. The next push will trigger deployment automatically

### Accessing Your Deployed Site

Once deployed, your dashboard will be available at:

```
https://substrateindependent.github.io/dailo_dashboard/
```

### Manual Deployment

You can also trigger a manual deployment:

1. Go to **Actions** tab in your GitHub repository
2. Click on **Deploy to GitHub Pages** workflow
3. Click **Run workflow**
4. Select the branch and click **Run workflow**

### Deployment Status

Check deployment status:
- Go to **Actions** tab in GitHub
- View the latest workflow run
- Deployment typically takes 1-2 minutes

### Custom Domain (Optional)

To use a custom domain:

1. Add a `CNAME` file to the repository root with your domain:
   ```
   echo "yourdomain.com" > CNAME
   ```

2. Configure DNS records at your domain provider:
   - Add a CNAME record pointing to: `substrateindependent.github.io`

3. In GitHub Settings → Pages, add your custom domain

### Troubleshooting

**Issue: Modules not loading (CORS errors)**
- Solution: The `.nojekyll` file is included to prevent Jekyll processing
- Ensure this file exists in the repository root

**Issue: 404 errors**
- Check that `index.html` is in the repository root
- Verify the deployment completed successfully in Actions tab

**Issue: Deployment failed**
- Check Actions tab for error logs
- Ensure GitHub Pages is enabled in repository settings
- Verify the workflow has proper permissions

**Issue: Old version showing**
- Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)
- Wait 2-3 minutes for GitHub's CDN to update

### Local Testing Before Deployment

Test the site locally before deploying:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx http-server -p 8000

# Then visit http://localhost:8000
```

### Environment-Specific Configuration

If you need different configurations for local vs deployed:

```javascript
// In config.js
const isDevelopment = window.location.hostname === 'localhost';
const BACKEND_URL = isDevelopment
  ? 'http://localhost:3001'
  : 'https://your-backend-url.com';
```

### Notes

- **Static Site Only**: GitHub Pages serves static files only
- **HTTPS**: Automatically enabled (free SSL certificate)
- **Updates**: Deployment happens on every push to configured branches
- **Build Time**: Typically 1-2 minutes per deployment
- **No Backend**: The proxy server must be hosted separately if using live data

### Backend Deployment (Optional)

If you want live FRED data, you'll need to deploy the proxy server separately:

**Options:**
- Heroku (free tier available)
- Railway (free tier available)
- Render (free tier available)
- AWS Lambda (serverless)
- Vercel Serverless Functions

Update `BACKEND_URL` in `src/js/config.js` to point to your deployed backend.
