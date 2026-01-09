# StyleSync PWA

Progressive Web App for StyleSync - Automatic salon booking synchronization.

## Features

- 🔐 Google OAuth login
- 📱 Progressive Web App (works on mobile & desktop)
- 📧 View synced bookings
- 🔄 Manual sync trigger
- ⚙️ Settings & preferences
- 💳 Stripe payment integration

## Tech Stack

- **Framework:** Next.js 14 (React)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Auth:** Google OAuth
- **Payment:** Stripe
- **Hosting:** Vercel

## Architecture

```
PWA (This App) → StyleSync Agent → Salon MCP Server
```

This PWA is **UI only** - no business logic. It calls the StyleSync Agent API for all operations.

## Pages

### 1. Landing Page (`/`)
- Google Sign-In button
- Features overview
- Pricing ($10/month)

### 2. Dashboard (`/dashboard`)
- List of bookings
- Sync status indicators
- Manual "Sync Now" button

### 3. Settings (`/settings`)
- Account info
- Subscription management
- Preferences
- Disconnect account

## Local Development

### Prerequisites
1. Node.js 18+
2. npm or yarn
3. Google OAuth credentials
4. Stripe account (test mode)
5. Running StyleSync Agent

### Setup

1. **Install dependencies**
```bash
npm install
```

2. **Create .env file**
```bash
cp .env.example .env
```

3. **Edit .env with your credentials**
```bash
NEXT_PUBLIC_AGENT_URL=http://localhost:54321/functions/v1/stylesync-agent
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. **Run development server**
```bash
npm run dev
```

5. **Open browser**
```
http://localhost:3000
```

## Deployment to Vercel

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/stylesync-pwa.git
git push -u origin main
```

### Step 2: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Import Project"
3. Select your GitHub repo
4. Add environment variables:
   - `NEXT_PUBLIC_AGENT_URL`
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
   - `NEXT_PUBLIC_STRIPE_PUBLIC_KEY`
   - `STRIPE_SECRET_KEY`
   - `NEXT_PUBLIC_APP_URL`
5. Click "Deploy"

### Step 3: Custom Domain (Optional)
1. In Vercel dashboard → Settings → Domains
2. Add your domain (e.g., stylesync.app)
3. Follow DNS configuration instructions

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_AGENT_URL` | StyleSync Agent API URL | Yes |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth Client ID | Yes |
| `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` | Stripe Publishable Key | Yes |
| `STRIPE_SECRET_KEY` | Stripe Secret Key | Yes |
| `NEXT_PUBLIC_APP_URL` | Your app URL | Yes |

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project (or select existing)
3. Enable Google+ API
4. Go to Credentials → Create OAuth 2.0 Client ID
5. Application type: Web application
6. Authorized JavaScript origins:
   - `http://localhost:3000` (development)
   - `https://yourdomain.com` (production)
7. Copy Client ID to `.env`

## Stripe Setup

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Enable Test Mode
3. Go to Developers → API Keys
4. Copy Publishable Key and Secret Key
5. Create a Product:
   - Name: "StyleSync Pro"
   - Price: $10/month
6. Note the Price ID for payment integration

## Building for Production

```bash
npm run build
npm start
```

## PWA Features

The app is installable as a Progressive Web App:

- **On iOS:** Safari → Share → Add to Home Screen
- **On Android:** Chrome → Menu → Install App
- **On Desktop:** Chrome → Address bar → Install icon

## Project Structure

```
pwa/
├── app/
│   ├── page.tsx              # Landing page (login)
│   ├── dashboard/
│   │   └── page.tsx          # Dashboard
│   ├── settings/
│   │   └── page.tsx          # Settings
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Global styles
├── public/
│   ├── manifest.json         # PWA manifest
│   ├── icon-192.png          # App icon (small)
│   └── icon-512.png          # App icon (large)
├── .env.example              # Environment template
├── package.json
└── README.md
```

## API Endpoints Used

All endpoints are on the StyleSync Agent:

- `POST /auth/register` - User registration
- `GET /bookings` - Get bookings
- `POST /sync/manual` - Trigger manual sync
- `POST /payment/subscribe` - Create Stripe checkout

## Todo

- [ ] Add payment/subscribe endpoint to agent
- [ ] Create app icons (192x192 and 512x512)
- [ ] Add push notifications
- [ ] Add service worker for offline support
- [ ] Add loading states
- [ ] Add error boundaries
- [ ] Add analytics

## Testing

### Test with Mock Data

1. Start agent with test mode
2. Create test booking in Supabase
3. Verify it shows in dashboard
4. Test manual sync button

### Test Payment Flow

1. Use Stripe test card: `4242 4242 4242 4242`
2. Any future expiry date
3. Any CVC
4. Any ZIP code

## Troubleshooting

**Issue:** Google Sign-In not loading
- Check `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set
- Verify domain is in authorized origins
- Check browser console for errors

**Issue:** Payment failing
- Verify Stripe keys are correct
- Check Stripe dashboard for errors
- Ensure test mode is enabled

**Issue:** Can't fetch bookings
- Check `NEXT_PUBLIC_AGENT_URL` is correct
- Verify agent is running
- Check browser console network tab

## Next Steps

1. ✅ PWA built (this app)
2. → Connect to running agent
3. → Test end-to-end
4. → Deploy to production

---

**Built with:** Next.js + TypeScript + Tailwind CSS
**Status:** Ready to deploy
**Last updated:** 2026-01-09
