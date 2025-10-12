# VEA 2025 Portal - cPanel Node.js Deployment Guide

This guide walks you through running the full Next.js application (including all API routes and dynamic features) on a cPanel host that supports Node.js applications.

## 🚀 Prepare the production build locally

1. **Install dependencies and build the standalone bundle**
   ```bash
   npm install
   npm run deploy:server
   ```

   The `deploy:server` script runs `next build` and produces a standalone Node.js server inside `.next/standalone` together with the required static assets in `.next/static`.

2. **Package the deployment artifacts**
   Create an archive containing the following paths from your project root:
   - `.next/standalone/` (entire folder)
   - `.next/static/` (entire folder)
   - `public/` (entire folder)
   - `package.json` and `package-lock.json`
   - `server.js`
   - `.env.production` (or copy of `.env.example` configured for production)

   > Tip: run `./deploy.sh` to automatically build the project and generate `vea-portal-node-deployment.zip` with these contents.

## 📁 Upload files to cPanel

1. Open the cPanel **File Manager** (or use SFTP).
2. Navigate to `public_html/portal2.victoryeducationalacademy.com.ng/` (or the directory configured for your Node.js app).
3. Upload the archive created in the previous step and extract it.
4. Verify the extracted structure looks like:
   ```
   public_html/portal2.victoryeducationalacademy.com.ng/
   ├── .next/
   │   ├── standalone/
   │   └── static/
   ├── public/
   ├── package.json
   ├── package-lock.json
   ├── server.js
   └── .env.production
   ```

## ⚙️ Configure the cPanel Node.js application

1. **Create / edit the Node.js app** in cPanel:
   - Select Node.js 18 or higher.
   - Set the application root to `public_html/portal2.victoryeducationalacademy.com.ng`.
   - Set the startup file to `server.js`.
   - Set the application mode to **Production**.

2. **Install production dependencies** from the app terminal:
   ```bash
   cd ~/public_html/portal2.victoryeducationalacademy.com.ng
   npm install --omit=dev
   ```

3. **Define environment variables** in the cPanel interface (see list below).

4. **Restart** the Node.js application to apply the new build.

## 🛠 Ongoing maintenance

- Re-run `npm run deploy:server` before every release and upload the fresh `.next` and `public` folders.
- After each deployment, restart the Node.js application from the cPanel dashboard.
- Use the cPanel “Run JS Script” console to tail logs or clear the `.next/cache` directory if you ever need to invalidate cached pages.

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

```env
# Database (Optional - uses localStorage by default)
DATABASE_URL=mysql://baladre1_umar:N@UW&-&0frVbM;Ce@localhost/baladre1_vea
# If required by your tooling, URL-encode the @ symbol in the password as %40

# JWT Secret (Required for Node.js)
JWT_SECRET=your-super-secret-jwt-key-here

# Paystack Integration
PAYSTACK_SECRET_KEY=sk_test_7dd51e291a986b6462d0f4198668ce07c296eb5d
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=
PAYSTACK_PARTNER_SUBACCOUNT_CODE=
PAYSTACK_PARTNER_SPLIT_CODE=

# App URL
NEXT_PUBLIC_APP_URL=https://portal2.victoryeducationalacademy.com.ng

# Disable telemetry
NEXT_TELEMETRY_DISABLED=1
```

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
