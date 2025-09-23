# VEA 2025 School Management Portal

## Victory Educational Academy - Comprehensive School Management System

### Overview
The VEA 2025 Portal is a comprehensive school management system built with Next.js 15, React 19, and TypeScript. It provides role-based access for seven different user types with complete functionality for academic management, payment processing, and administrative oversight.

### Features

#### 🎓 **Multi-Role System**
- **Super Admin**: Complete system control, branding management, analytics
- **Admin**: User management, class/subject assignment, payment oversight
- **Teacher**: Marks entry, assignment management, student progress tracking
- **Student**: Assignment submission, study materials access, profile viewing
- **Parent**: Report card access, payment processing, progress monitoring
- **Librarian**: Book management, student library records
- **Accountant**: Fee management, receipt generation, financial reporting

#### 💳 **Payment Integration**
- Paystack integration for school fee payments
- Automatic 1% revenue split to First Bank of Nigeria account 3066490309 (Umar Umar Muhammad)
- Automated access control based on payment status
- Admin override for offline payments
- Receipt generation and download

#### 📊 **Academic Management**
- Comprehensive report card system with Victory Educational Academy branding
- Cumulative reporting across terms and sessions
- Real-time grade calculations (1st C.A. + 2nd C.A. + Assignment + Exam)
- Affective and Psychomotor domain assessments
- Teacher remarks and administrative comments

#### 🔐 **Security & Access Control**
- JWT-based authentication
- Role-based permissions
- Input validation with Zod schemas
- Error boundaries and comprehensive error handling

### Technology Stack
- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS v4, shadcn/ui components
- **Authentication**: JWT with bcrypt password hashing
- **Payment**: Paystack integration
- **Validation**: Zod schemas
- **Testing**: Jest with React Testing Library

### Installation

#### Prerequisites
- Node.js 18.x or higher
- npm 8.x or higher

#### Local Development
\`\`\`bash
# Clone the repository
git clone <repository-url>
cd vea-2025-portal

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development server
npm run dev
\`\`\`

#### Production Deployment
\`\`\`bash
# Build for production
npm run build

# Start production server
npm start

# Or use Docker
docker-compose up -d
\`\`\`

### Environment Variables
\`\`\`env
# Paystack Configuration
PAYSTACK_SECRET_KEY=sk_test_7dd51e291a986b6462d0f4198668ce07c296eb5d
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=
PAYSTACK_PARTNER_SUBACCOUNT_CODE=
PAYSTACK_PARTNER_SPLIT_CODE=
NEXT_PUBLIC_APP_URL=https://portal2.victoryeducationalacademy.com.ng

# Authentication
JWT_SECRET=your_jwt_secret_key

# Application
NODE_ENV=production
\`\`\`

### User Roles & Sample Credentials

#### Super Admin
- **Email**: superadmin@vea.edu.ng
- **Password**: SuperAdmin2025!
- **Capabilities**: Complete system control, user management, branding, analytics

#### Admin
- **Email**: admin@vea.edu.ng
- **Password**: Admin2025!
- **Capabilities**: User oversight, class management, payment administration

#### Teacher
- **Email**: teacher@vea.edu.ng
- **Password**: Teacher2025!
- **Capabilities**: Marks entry, assignment creation, student progress

#### Student
- **Email**: student@vea.edu.ng
- **Password**: Student2025!
- **Capabilities**: Assignment submission, study materials, profile view

#### Parent
- **Email**: parent@vea.edu.ng
- **Password**: Parent2025!
- **Capabilities**: Report card access, payment processing, progress monitoring

### API Endpoints

#### Authentication
- `POST /api/auth/login` - User authentication
- `POST /api/auth/logout` - User logout

#### Academic Management
- `GET/POST /api/marks` - Student marks management
- `GET/POST /api/assignments` - Assignment handling
- `GET/POST /api/classes` - Class management
- `GET/POST /api/users` - User management

#### Payments
- `POST /api/payments/initialize` - Initialize Paystack payment
- `POST /api/payments/verify` - Verify payment status

### Development Guidelines

#### Code Structure
\`\`\`
├── app/                    # Next.js app directory
├── components/            # React components
│   ├── admin/            # Admin-specific components
│   ├── ui/               # Reusable UI components
│   └── ...               # Role-specific components
├── lib/                  # Utility functions
├── __tests__/            # Test files
└── public/               # Static assets
\`\`\`

#### Component Guidelines
- Use TypeScript for all components
- Follow shadcn/ui patterns for consistency
- Implement proper error boundaries
- Use React.memo for performance optimization

#### Testing
\`\`\`bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
\`\`\`

### Deployment

#### Docker Deployment
\`\`\`bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f
\`\`\`

#### Manual Deployment
1. Build the application: `npm run build`
2. Configure environment variables
3. Set up reverse proxy (Nginx configuration included)
4. Start the application: `npm start`

### Monitoring & Maintenance

#### System Health
- Built-in system health monitoring
- Performance metrics dashboard
- Error tracking and logging

#### Regular Maintenance
- Weekly: Check application logs, monitor payments
- Monthly: Update dependencies, review security
- Quarterly: Performance optimization, security audit

### Support & Documentation

#### Troubleshooting
- Check environment variables configuration
- Verify Paystack integration setup
- Review error logs for specific issues
- Ensure proper database connections

#### Contact Information
- **School**: Victory Educational Academy
- **Portal URL**: https://portal2.victoryeducationalacademy.com.ng
- **Technical Support**: Contact system administrator

### License
© 2024 Victory Educational Academy. All rights reserved.

---

**Built with ❤️ for Victory Educational Academy**
