# Career Co-Pilot 🚀

An AI-powered job search platform specifically designed for Indian job seekers. Career Co-Pilot provides intelligent job matching, automated applications with AI-tailored CVs and cover letters, smart application tracking, and AI-powered interview preparation.

## 🌟 Features

### Core Features
- **Smart Job Matching**: AI-powered job recommendations based on your profile and preferences
- **One-Click Applications**: Automated job applications with AI-generated cover letters and tailored CVs
- **Application Tracking**: Comprehensive tracking system to monitor your job applications
- **AI Interview Prep**: Get ready for interviews with AI-powered preparation tools
- **Resume Builder**: Create professional resumes with AI assistance

### Payment Integration
- **PhonePe Integration**: Seamless payments for Indian users supporting UPI, cards, and net banking
- **Flexible Pricing**: ₹499/month for Premium, ₹999/month for Pro plans
- **Free Tier**: 5 applications per month for free users

### Authentication
- **Replit Auth**: Secure authentication with Google OAuth integration
- **User Management**: Comprehensive user profile and subscription management

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Shadcn/ui** for UI components
- **TanStack Query** for data fetching
- **Wouter** for client-side routing

### Backend
- **Node.js** with Express
- **TypeScript** for type safety
- **Drizzle ORM** with PostgreSQL
- **OpenAI API** for AI features
- **PhonePe API** for payments
- **SendGrid** for email services

### Database
- **PostgreSQL** (Neon serverless)
- **Drizzle ORM** for database operations
- **Type-safe schema** definitions

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- Required API keys (see Environment Variables section)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd career-co-pilot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   # Database
   DATABASE_URL=your_postgresql_connection_string

   # OpenAI API
   OPENAI_API_KEY=your_openai_api_key

   # PhonePe (for production)
   PHONEPE_MERCHANT_ID=your_phonepe_merchant_id
   PHONEPE_SALT_KEY=your_phonepe_salt_key
   PHONEPE_SALT_INDEX=1

   # SendGrid (for emails)
   SENDGRID_API_KEY=your_sendgrid_api_key
   FROM_EMAIL=your_from_email

   # Google OAuth (optional)
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret

   # Session Secret
   SESSION_SECRET=your_session_secret
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

## 📁 Project Structure

```
career-co-pilot/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── lib/           # Utility functions and configurations
│   │   ├── pages/         # Application pages
│   │   └── hooks/         # Custom React hooks
├── server/                # Backend Express application
│   ├── routes.ts          # API route definitions
│   ├── storage.ts         # Database operations
│   ├── phonepe.ts         # PhonePe payment integration
│   ├── stripe.ts          # Legacy Stripe code (kept for reference)
│   └── subscriptionService.ts  # Subscription management
├── shared/                # Shared TypeScript definitions
│   └── schema.ts          # Database schema and types
└── package.json           # Dependencies and scripts
```

## 🔧 Configuration

### PhonePe Payment Integration
The application uses PhonePe for payments, which is ideal for Indian users:
- Supports UPI, cards, and net banking
- No transaction fees for basic usage
- Test credentials are included for development

### AI Features
Powered by OpenAI GPT models for:
- Resume analysis and optimization
- Cover letter generation
- Job matching algorithms
- Interview question preparation

## 🎯 Usage

### For Job Seekers
1. **Sign up** with your Google account
2. **Complete your profile** with skills and experience
3. **Upload your resume** for AI analysis
4. **Browse job recommendations** or search manually
5. **Apply with one click** - AI generates tailored cover letters
6. **Track applications** and get interview preparation

### Subscription Plans

#### Free Plan
- 5 applications per month
- Basic job matching
- Application tracking

#### Premium Plan (₹499/month)
- Unlimited applications
- AI-generated cover letters
- Advanced job matching
- Priority support

#### Pro Plan (₹999/month)
- All Premium features
- Advanced analytics
- Interview preparation tools
- Priority job matching

## 📱 API Documentation

### Authentication Endpoints
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout user

### Job Management
- `GET /api/jobs` - Get job listings
- `POST /api/jobs` - Create job listing
- `GET /api/jobs/:id` - Get specific job

### Applications
- `GET /api/applications` - Get user applications
- `POST /api/applications` - Create application
- `POST /api/applications/batch-prepare` - Batch prepare applications

### Subscriptions
- `GET /api/subscription` - Get subscription status
- `POST /api/subscription/create` - Create PhonePe payment
- `POST /api/subscription/cancel` - Cancel subscription

### AI Features
- `POST /api/ai/generate-cover-letter` - Generate cover letter
- `POST /api/ai/analyze-resume` - Analyze resume
- `POST /api/ai/prepare-interview` - Interview preparation

## 🔐 Security

- **Input validation** with Zod schemas
- **Rate limiting** on API endpoints
- **Secure session management**
- **SQL injection protection** with Drizzle ORM
- **XSS protection** with proper sanitization

## 🌐 Deployment

### Using Replit
1. Import this repository to Replit
2. Set up environment variables in Replit Secrets
3. The application will automatically deploy

### Using Vercel/Netlify
1. Connect your GitHub repository
2. Set up environment variables
3. Configure build settings:
   - Build command: `npm run build`
   - Output directory: `dist`

### Using Docker
```bash
# Build the image
docker build -t career-co-pilot .

# Run the container
docker run -p 5000:5000 --env-file .env career-co-pilot
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Replit](https://replit.com) development platform
- UI components from [Shadcn/ui](https://ui.shadcn.com)
- AI powered by [OpenAI](https://openai.com)
- Payments by [PhonePe](https://phonepe.com)
- Database by [Neon](https://neon.tech)

## 📞 Support

For support and questions:
- Create an issue in this repository
- Contact the development team

---

**Made with ❤️ for Indian job seekers**