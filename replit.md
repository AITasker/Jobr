# Jobr

## Overview

Jobr is an AI-powered job search platform that automates the entire application process for job seekers. The application transforms the traditional manual job search from a 2-4 hour per application process into a streamlined, intelligent workflow. Users upload their CV once, receive AI-matched job opportunities, and can apply with automatically tailored CVs and cover letters. The platform includes comprehensive application tracking with email open monitoring and interview preparation features.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **React with TypeScript**: Modern React application using functional components and hooks
- **Vite Build System**: Fast development server with hot module replacement
- **Wouter Routing**: Lightweight client-side routing solution
- **TanStack Query**: Server state management with caching and synchronization
- **Tailwind CSS + shadcn/ui**: Utility-first styling with pre-built component library
- **Theme System**: Light/dark mode support with CSS custom properties

### Backend Architecture
- **Node.js with Express**: RESTful API server with TypeScript
- **Drizzle ORM**: Type-safe database operations with PostgreSQL
- **Modular Service Layer**: Separated business logic into focused services (AuthService, ApplicationPreparationService, JobMatchingService)
- **JWT Authentication**: Token-based authentication with HTTP-only cookies
- **Rate Limiting**: Express-rate-limit for API protection
- **File Processing**: Multer for CV uploads with text extraction

### Data Storage Solutions
- **PostgreSQL Database**: Primary data store with Neon serverless deployment
- **Database Schema**: Comprehensive relational design including users, CVs, jobs, applications, subscriptions, and API usage tracking
- **Connection Pooling**: Neon serverless with WebSocket support for optimal performance
- **Migration Management**: Drizzle Kit for schema migrations and database versioning

### Authentication and Authorization
- **Dual Authentication**: Replit Auth integration alongside custom email/password auth
- **Session Management**: PostgreSQL-backed session store for Replit Auth
- **JWT Tokens**: Custom authentication using JWT with secure HTTP-only cookies
- **Password Security**: Bcrypt hashing with configurable salt rounds
- **Rate-Limited Auth**: Protection against brute force attacks

### API Design Patterns
- **RESTful Architecture**: Standard HTTP methods with consistent response formats
- **Middleware Pipeline**: Authentication, rate limiting, and request logging
- **Error Handling**: Centralized error responses with structured error codes
- **File Upload Handling**: Secure file processing with validation and size limits

## External Dependencies

### AI and ML Services
- **OpenAI GPT API**: CV parsing, job matching, cover letter generation, and CV tailoring
- **Token Management**: Usage tracking and rate limiting for API costs
- **Fallback Systems**: Template-based alternatives when AI services are unavailable

### Payment Processing
- **Stripe Integration**: Subscription management, payment processing, and webhook handling
- **Plan Management**: Free, Premium, and Pro tier implementations with feature gating
- **Usage Tracking**: Application limits and credit systems

### Email Services
- **SendGrid Integration**: Transactional email delivery for notifications and communications
- **Email Templates**: Structured email formatting for various user interactions

### File Processing
- **Mammoth.js**: Microsoft Word document text extraction
- **PDF Processing**: Text extraction from PDF documents
- **File Validation**: Type and size restrictions for security

### Development and Deployment
- **Replit Platform**: Integrated development and hosting environment
- **Environment Configuration**: Secure environment variable management
- **Build Pipeline**: Vite frontend build with Node.js backend compilation