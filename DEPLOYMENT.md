# VEA 2025 Portal - cPanel Deployment Guide

## 🚀 Two Deployment Options

### Option A: Static Export (Recommended for cPanel)
Best for shared hosting with file manager access.

#### Steps:
1. **Build locally:**
   \`\`\`bash
   npm install
   npm run build
   \`\`\`

2. **Upload to cPanel:**
   - Compress the `out/` folder contents
   - Upload to: `public_html/portal2.victoryeducationalacademy.com.ng/`
   - Extract all files in the subdomain root

3. **Access:** `https://portal2.victoryeducationalacademy.com.ng`

### Option B: Node.js Server (For Advanced Users)
For cPanel with Node.js support.

#### Steps:
1. **Build locally:**
   \`\`\`bash
   npm install
   npm run deploy:server
   \`\`\`

2. **Upload files:**
   - `.next/standalone/` (entire folder)
   - `.next/static/` (entire folder)
   - `public/` (entire folder)
   - `package.json`
   - `server.js`

3. **Setup on cPanel:**
   - Create Node.js app
   - Point to project folder
   - Set startup file: `server.js`
   - Set environment variables (see below)
   - Start app

## 🔐 Default Login Credentials

### Super Admin
- **Email:** admin@vea.edu.ng
- **Password:** admin123
- **Role:** super-admin

### Admin
- **Email:** admin2@vea.edu.ng
- **Password:** admin123
- **Role:** admin

### Teacher
- **Email:** teacher@vea.edu.ng
- **Password:** teacher123
- **Role:** teacher

### Parent
- **Email:** parent@vea.edu.ng
- **Password:** parent123
- **Role:** parent

### Student
- **Email:** student@vea.edu.ng
- **Password:** student123
- **Role:** student

### Librarian
- **Email:** librarian@vea.edu.ng
- **Password:** librarian123
- **Role:** librarian

### Accountant
- **Email:** accountant@vea.edu.ng
- **Password:** accountant123
- **Role:** accountant

## 🌐 Environment Variables (Node.js Option Only)

Set these in your cPanel Node.js app environment:

\`\`\`env
# Database (Optional - uses localStorage by default)
DATABASE_URL=mysql://username:password@localhost:3306/vea_portal

# JWT Secret (Required for Node.js)
JWT_SECRET=your-super-secret-jwt-key-here

# Paystack Integration
PAYSTACK_SECRET_KEY=sk_test_your_paystack_secret_key
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_your_paystack_public_key

# App URL
NEXT_PUBLIC_APP_URL=https://portal2.victoryeducationalacademy.com.ng

# Disable telemetry
NEXT_TELEMETRY_DISABLED=1
\`\`\`

## ✅ Features Ready for Use

### 🎓 Academic Management
- **Teacher Dashboard** - Enter marks, behavioral assessments, attendance
- **Report Card System** - Complete approval workflow with beautiful formatting
- **Academic Analytics** - Performance tracking and reporting
- **Automatic Promotion** - End-of-year student promotion system

### 👨‍💼 Administrative Tools
- **Super Admin Dashboard** - Complete system management
- **Admin Dashboard** - User management, report approval, system settings
- **User Management** - Create/edit users across all roles
- **Class & Subject Management** - Organize academic structure

### 👨‍🎓 Student & Parent Features
- **Student Dashboard** - View grades, assignments, library books
- **Parent Dashboard** - Access approved report cards, make payments
- **Payment Integration** - Paystack integration for school fees
- **Report Card Access Control** - Payment-based or admin-granted access

### 💬 Communication & Collaboration
- **Messaging System** - Real-time communication between all users
- **Noticeboard** - School-wide announcements and notices
- **File Sharing** - Upload and share documents

### 📚 Additional Services
- **Library Management** - Book borrowing and returns
- **Financial Management** - Fee collection and expense tracking
- **Timetable Management** - Class scheduling system
- **Exam Management** - Test and examination coordination

## 💾 Data Persistence

### Current System (localStorage)
- All data stored in browser localStorage
- Each user's data persists across sessions
- Teachers can enter real student data immediately
- Report cards generate with actual entered information
- Works offline after initial load

### Future Database Integration
- MySQL database support ready
- User authentication with JWT tokens
- Centralized data storage
- Multi-device synchronization

## 🔧 Technical Specifications

### SSR-Safe Architecture
- No localStorage access during server render
- Client-side hydration for browser APIs
- Standalone server build for Node.js deployment
- Local fonts (no external dependencies)

### Performance Optimizations
- Compressed assets with gzip
- Cached static resources
- Optimized images
- Minimal JavaScript bundles

### Security Features
- XSS protection headers
- Content type validation
- Frame options security
- Input sanitization

## 🆘 Troubleshooting

### Build Issues
- **Font errors:** Fonts are now local, no internet required
- **localStorage errors:** Fixed with SSR-safe storage utility
- **Memory issues:** Standalone build reduces memory usage

### Runtime Issues
- **Report cards not showing:** Ensure teachers have entered marks
- **Payment not working:** Check Paystack environment variables
- **Access denied:** Verify admin has approved report cards

## 📞 Support

For technical support:
1. Check the troubleshooting section above
2. Verify environment variables are set correctly
3. Ensure all files were uploaded properly
4. Contact the development team with specific error messages

## 🔄 Updates

To update the portal:
1. Download the latest build
2. Backup your current installation
3. Replace files (keeping any custom configurations)
4. Test all functionality

---

**Victory Educational Academy - Excellence in Education Since 2020**
