# Deployment Guide for Career Co-Pilot

## Quick Setup for GitHub Import

### 1. Create New Repository
```bash
git init
git add .
git commit -m "Initial commit: Career Co-Pilot - AI-powered job search platform for Indian users"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 2. Environment Variables Setup
Create a `.env` file with these variables:

```env
# Database (Required)
DATABASE_URL=postgresql://username:password@host:port/database

# OpenAI API (Required for AI features)
OPENAI_API_KEY=sk-...

# PhonePe Payment (Production)
PHONEPE_MERCHANT_ID=your_merchant_id
PHONEPE_SALT_KEY=your_salt_key
PHONEPE_SALT_INDEX=1

# SendGrid Email (Optional)
SENDGRID_API_KEY=SG...
FROM_EMAIL=noreply@yourapp.com

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# Session Secret (Required)
SESSION_SECRET=your_random_session_secret
```

### 3. Database Setup
```bash
npm install
npm run db:push
```

### 4. Start Development
```bash
npm run dev
```

## File Structure for GitHub
```
career-co-pilot/
├── README.md                  ✓ Created
├── LICENSE                   ✓ Created  
├── .gitignore               ✓ Exists
├── package.json             ✓ Exists
├── tsconfig.json            ✓ Exists
├── tailwind.config.ts       ✓ Exists
├── drizzle.config.ts        ✓ Exists
├── vite.config.ts           ✓ Exists
├── client/                  ✓ Frontend React app
├── server/                  ✓ Backend Express app
├── shared/                  ✓ Shared TypeScript types
└── DEPLOYMENT.md            ✓ This file
```

## Key Features Implemented
- ✅ PhonePe payment integration for Indian market
- ✅ Rupee pricing (₹499 Premium, ₹999 Pro)
- ✅ OpenAI integration for AI features
- ✅ PostgreSQL database with Drizzle ORM
- ✅ Replit authentication
- ✅ Modern React + TypeScript frontend
- ✅ Express.js backend with comprehensive API

## Production Deployment Options

### Vercel (Recommended)
1. Connect GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on git push

### Railway
1. Connect GitHub repository
2. Set environment variables
3. Railway will auto-deploy

### Heroku
1. Create new Heroku app
2. Connect GitHub repository
3. Add environment variables
4. Enable automatic deployments

## Support
- Check README.md for detailed documentation
- All code is production-ready
- PhonePe test credentials included for development