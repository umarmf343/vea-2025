# VEA 2025 Portal - Complete Installation Guide for cPanel

## Prerequisites
- cPanel hosting account with Node.js support
- SSH access (which you have)
- Domain: portal2.victoryeducationalacademy.com.ng

## Step 1: Create Database

### 1.1 Login to cPanel
1. Go to your cPanel dashboard
2. Find "MySQL Databases" section

### 1.2 Create Database
1. Click "MySQL Databases"
2. Under "Create New Database":
   - Database Name: `baladre1_vea`
   - Click "Create Database"
3. Note down the full database name (currently: `baladre1_vea`)

### 1.3 Create Database User
1. Under "MySQL Users" section:
   - Username: `baladre1_umar`
   - Password: Use `N@UW&-&0frVbM;Ce` (keep this secure!)
   - Click "Create User"

### 1.4 Add User to Database
1. Under "Add User to Database":
   - Select your user: `baladre1_umar`
   - Select your database: `baladre1_vea`
   - Click "Add"
2. Grant ALL PRIVILEGES
3. Click "Make Changes"

## Step 2: Prepare Environment Variables

### 2.1 Create .env.local file
Create a file named `.env.local` with the following content:

\`\`\`env
# Database Configuration
DATABASE_URL="mysql://baladre1_umar:N@UW&-&0frVbM;Ce@localhost/baladre1_vea"

# JWT Secret (generate a random 32-character string)
JWT_SECRET="your-super-secret-jwt-key-32-chars"

# Paystack Configuration (get from Paystack dashboard)
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=""
PAYSTACK_SECRET_KEY="sk_test_7dd51e291a986b6462d0f4198668ce07c296eb5d"
PAYSTACK_PARTNER_SUBACCOUNT_CODE=""
PAYSTACK_PARTNER_SPLIT_CODE=""

# App Configuration
NEXT_PUBLIC_APP_URL="https://portal2.victoryeducationalacademy.com.ng"
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL="https://portal2.victoryeducationalacademy.com.ng"

# Email Configuration (optional - for notifications)
SMTP_HOST="your-smtp-host"
SMTP_PORT="587"
SMTP_USER="your-email@domain.com"
SMTP_PASS="your-email-password"
\`\`\`

**Important**: Update the values if your hosting provider requires different credentials:
- Keep the database name as `baladre1_vea`
- Keep the database user as `baladre1_umar`
- Ensure the password `N@UW&-&0frVbM;Ce` is entered exactly (including the `@` and `;` characters)
- If any tool rejects the `@` symbol, use the URL-encoded password `N%40UW&-&0frVbM;Ce`
- Get Paystack keys from your Paystack dashboard (leave the public key empty until you are ready to use it)
- If you already created the 1% revenue share on Paystack, populate `PAYSTACK_PARTNER_SUBACCOUNT_CODE` and `PAYSTACK_PARTNER_SPLIT_CODE`

## Step 3: Upload Files to Server

### 3.1 Using File Manager (Easier for beginners)
1. In cPanel, open "File Manager"
2. Navigate to `public_html/portal2.victoryeducationalacademy.com.ng`
3. Upload all project files (you can zip them first, then extract)
4. Make sure `.env.local` is in the root directory

### 3.2 Using SSH (Alternative method)
\`\`\`bash
# Connect to your server
ssh yourusername@your-server-ip

# Navigate to the directory
cd public_html/portal2.victoryeducationalacademy.com.ng

# Upload files using scp or git clone
# If using git:
git clone https://github.com/your-repo/vea-2025-portal.git .
\`\`\`

## Step 4: Install Dependencies

### 4.1 Check Node.js Version
\`\`\`bash
# SSH into your server
ssh yourusername@your-server-ip

# Check Node.js version (should be 18+ for Next.js 14)
node --version
npm --version
\`\`\`

### 4.2 Install Node.js (if needed)
If Node.js is not installed or version is too old:
1. In cPanel, look for "Node.js" or "Node.js Selector"
2. Select Node.js version 18 or higher
3. Set the startup file to `server.js`

### 4.3 Install Project Dependencies
\`\`\`bash
# Navigate to your project directory
cd public_html/portal2.victoryeducationalacademy.com.ng

# Install dependencies
npm install

# If you get permission errors, try:
npm install --unsafe-perm=true --allow-root

> **Note:** The project automatically removes any legacy `node_modules/.pnpm` directories before installing packages. This prevents stale pnpm-managed dependencies (which ship in some archives) from conflicting with the npm lockfile and breaking the production build.
>
> **Why all dependencies install even with `NODE_ENV=production`:** Some hosting dashboards set `NODE_ENV=production` globally, which makes npm skip `devDependencies` by default. The build needs tools such as `autoprefixer`, `postcss` and `tailwindcss`, so the repository ships an `.npmrc` file with `production=false` to keep those packages available. Keep this file in place when deploying so production builds do not fail with missing module errors.
\`\`\`

## Step 5: Database Setup

### 5.1 Create Database Tables
\`\`\`bash
# Run database migrations (if you have them)
npm run db:migrate

# Or manually create tables using phpMyAdmin
\`\`\`

### 5.2 Using phpMyAdmin (Manual Setup)
1. In cPanel, open "phpMyAdmin"
2. Select your database: `baladre1_vea`
3. Run this SQL to create basic tables:

\`\`\`sql
-- Users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role ENUM('super_admin', 'admin', 'teacher', 'student', 'parent', 'librarian', 'accountant') NOT NULL,
    class VARCHAR(100),
    admission_number VARCHAR(50),
    phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Student marks table
CREATE TABLE student_marks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    subject VARCHAR(100) NOT NULL,
    term VARCHAR(20) NOT NULL,
    session VARCHAR(20) NOT NULL,
    ca1 DECIMAL(5,2) DEFAULT 0,
    ca2 DECIMAL(5,2) DEFAULT 0,
    assignment DECIMAL(5,2) DEFAULT 0,
    exam DECIMAL(5,2) DEFAULT 0,
    total DECIMAL(5,2) DEFAULT 0,
    grade VARCHAR(2),
    teacher_remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id)
);

-- Insert default Super Admin user
INSERT INTO users (email, password, name, role) VALUES 
('admin@victoryeducationalacademy.com.ng', '$2b$10$hashedpassword', 'Super Administrator', 'super_admin');
\`\`\`

## Step 6: Build and Deploy

### 6.1 Build the Application
\`\`\`bash
# Build the Next.js application
npm run build

# If build fails due to memory issues:
NODE_OPTIONS="--max-old-space-size=4096" npm run build
\`\`\`

### 6.2 Start the Application
\`\`\`bash
# Start in production mode
npm start

# Or use PM2 for process management (recommended)
npm install -g pm2
pm2 start npm --name "vea-portal" -- start
pm2 save
pm2 startup
\`\`\`

## Step 7: Configure Domain and SSL

### 7.1 Domain Configuration
1. In cPanel, go to "Subdomains"
2. Create subdomain: `portal2`
3. Point it to: `public_html/portal2.victoryeducationalacademy.com.ng`

### 7.2 SSL Certificate
1. In cPanel, go to "SSL/TLS"
2. Enable "Let's Encrypt" for your subdomain
3. Force HTTPS redirect

## Step 8: Test the Installation

### 8.1 Access the Portal
1. Visit: `https://portal2.victoryeducationalacademy.com.ng`
2. You should see the login page

### 8.2 Default Login Credentials
- **Super Admin**: 
  - Email: `admin@victoryeducationalacademy.com.ng`
  - Password: `admin123` (change this immediately!)

### 8.3 Test Basic Functionality
1. Login as Super Admin
2. Create test users for each role
3. Test payment integration
4. Test report card generation

## Step 9: Security and Maintenance

### 9.1 Change Default Passwords
1. Login as Super Admin
2. Go to User Management
3. Change the default admin password

### 9.2 Regular Backups
1. Set up automatic database backups in cPanel
2. Backup uploaded files (student photos, documents)

### 9.3 Monitor Logs
\`\`\`bash
# Check application logs
pm2 logs vea-portal

# Check error logs
tail -f /path/to/error.log
\`\`\`

## Troubleshooting

### Common Issues:

1. **"Cannot connect to database"**
   - Check DATABASE_URL in .env.local
   - Verify database credentials
   - Ensure database exists

2. **"Module not found" errors**
   - Run `npm install` again
   - Check Node.js version compatibility

3. **"Permission denied" errors**
   - Check file permissions: `chmod 755 -R .`
   - Check ownership: `chown -R username:username .`

4. **Application not starting**
   - Check if port 3000 is available
   - Use PM2 for better process management

5. **Paystack integration not working**
   - Verify API keys in .env.local
   - Check if domain is whitelisted in Paystack

### Getting Help:
- Check application logs: `pm2 logs vea-portal`
- Contact your hosting provider for server-specific issues
- Ensure all environment variables are correctly set

## Next Steps After Installation:
1. Configure school branding (logo, signature)
2. Set up user accounts for teachers, students, parents
3. Configure classes and subjects
4. Set up payment plans
5. Test report card generation
6. Train staff on system usage

---

**Important Security Notes:**
- Always use HTTPS in production
- Regularly update dependencies: `npm update`
- Monitor for security vulnerabilities
- Keep database credentials secure
- Regular backups are essential
