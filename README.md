# Jobr - AI-Powered Job Search Platform

Jobr is an intelligent job search platform that automates the entire application process for job seekers. The application transforms the traditional manual job search from a 2-4 hour per application process into a streamlined, intelligent workflow.

## 🚀 Features

- **AI-Powered CV Analysis**: Automated CV parsing and skill extraction
- **Smart Job Matching**: AI-driven job recommendations based on CV analysis
- **ATS Score Calculator**: Real-time ATS compatibility scoring with improvement suggestions
- **Automated Application Process**: One-click job applications with tailored CVs and cover letters
- **Comprehensive Tracking**: Application status monitoring with email open tracking
- **Tiered Subscription System**: Free trial and premium plans with integrated payment processing
- **Multi-Provider Authentication**: Support for both custom authentication and Replit Auth

## 🛠 Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** + **shadcn/ui** for styling
- **TanStack Query** for state management
- **Wouter** for routing
- **Framer Motion** for animations

### Backend
- **Node.js** with **Express**
- **TypeScript** for type safety
- **Drizzle ORM** with PostgreSQL
- **JWT** authentication
- **Express Rate Limiting**

### Integrations
- **OpenAI API** for CV analysis and job matching
- **Stripe** & **PayPal** for payment processing
- **SendGrid** for email services
- **Replit Auth** for authentication

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL database
- OpenAI API key
- Stripe account (for payments)
- SendGrid account (for emails)

## ⚡ Quick Start

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd jobr
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

4. **Set up the database**
   ```bash
   npm run db:push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5000`

## 🔧 Environment Configuration

### Required Variables
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: OpenAI API key for AI features
- `JWT_SECRET`: Secret for JWT token signing
- `SESSION_SECRET`: Secret for session management

### Optional Variables
- `SENDGRID_API_KEY`: For email notifications
- `STRIPE_SECRET_KEY`: For payment processing
- `PAYPAL_CLIENT_ID` & `PAYPAL_CLIENT_SECRET`: For PayPal payments
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: For Google OAuth

## 📁 Project Structure

```
jobr/
├── client/src/           # React frontend
│   ├── components/       # Reusable components
│   ├── pages/           # Page components
│   ├── lib/             # Utilities and helpers
│   └── hooks/           # Custom React hooks
├── server/              # Express backend
│   ├── routes.ts        # API routes
│   ├── storage.ts       # Database layer
│   └── services/        # Business logic services
├── shared/              # Shared types and schemas
│   └── schema.ts        # Database schema
└── tests/               # Test files
```

## 🚀 Deployment

### Replit Deployment
1. Import this repository to Replit
2. Set up environment variables in Replit Secrets
3. The app will automatically deploy

### Manual Deployment
1. Build the application: `npm run build`
2. Set up production environment variables
3. Start the production server: `npm start`

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/auth.test.js
```

## 📝 API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user

### CV Management
- `POST /api/cv/upload` - Upload CV file
- `GET /api/cv` - Get user's CV data
- `GET /api/cv/analyze` - Analyze CV skills

### ATS Scoring
- `POST /api/ats/score` - Calculate ATS score for job description

### Job Management
- `GET /api/jobs` - Get job listings
- `POST /api/bookmarks` - Bookmark a job
- `DELETE /api/bookmarks/:id` - Remove bookmark

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes
4. Add tests for your changes
5. Commit your changes: `git commit -m 'Add new feature'`
6. Push to the branch: `git push origin feature/new-feature`
7. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in this repository
- Contact the development team

## 🔄 Recent Updates

- Enhanced ATS scoring algorithm with fallback system
- Improved CV keyword extraction
- Added comprehensive debugging and logging
- Fixed database schema and migration issues
- Updated UI theme consistency