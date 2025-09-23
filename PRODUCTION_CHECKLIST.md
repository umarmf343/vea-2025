# 🚀 VEA 2025 Production Deployment Checklist

## ✅ Pre-Deployment Tasks

### 1. Environment Configuration
- [ ] Replace test Paystack keys with live keys in `.env.local`
- [ ] Confirm Paystack split configuration routes 1% to Umar Umar Muhammad (First Bank 3066490309)
- [ ] Update `NEXT_PUBLIC_APP_URL` to production domain
- [ ] Set `NODE_ENV=production`
- [ ] Configure production database connection
- [ ] Set up production email SMTP settings

### 2. Security Configuration
- [ ] Generate strong JWT_SECRET for production
- [ ] Generate strong ENCRYPTION_KEY for production
- [ ] Remove any hardcoded credentials
- [ ] Enable HTTPS on production domain

### 3. Code Cleanup (Run `scripts/prepare-production.sh`)
- [ ] Remove all `console.log` statements
- [ ] Replace `alert()` calls with toast notifications
- [ ] Remove mock data and test configurations
- [ ] Update localhost URLs to production URLs

### 4. Testing
- [ ] Test payment flow with Paystack sandbox first
- [ ] Verify all user roles can login and access features
- [ ] Test report card generation and approval workflow
- [ ] Verify file uploads work correctly
- [ ] Test email notifications

## 🔧 Deployment Steps

### 1. Build and Package
\`\`\`bash
npm run build
./scripts/prepare-production.sh
\`\`\`

### 2. Upload to cPanel
1. Login to cPanel File Manager
2. Navigate to `public_html/portal2.victoryeducationalacademy.com.ng/`
3. Upload `vea-2025-production.zip`
4. Extract the zip file
5. Delete the zip file after extraction

### 3. Server Configuration
\`\`\`bash
# SSH into your server
cd public_html/portal2.victoryeducationalacademy.com.ng
npm install --production
npm start
\`\`\`

### 4. SSL Certificate
- Ensure SSL certificate is installed for the subdomain
- Force HTTPS redirects in cPanel

## 🔑 Default Login Credentials

**Super Admin:**
- Email: admin@vea.edu.ng
- Password: admin123

**Teacher:**
- Email: teacher@vea.edu.ng  
- Password: teacher123

**Parent:**
- Email: parent@vea.edu.ng
- Password: parent123

**Student:**
- Email: student@vea.edu.ng
- Password: student123

## ⚠️ Post-Deployment Tasks

1. **Change Default Passwords** - Immediately change all default passwords
2. **Test Payment Integration** - Verify Paystack live keys work correctly
3. **Backup Database** - Set up regular database backups
4. **Monitor Logs** - Check server logs for any errors
5. **User Training** - Train school staff on using the system

## 🆘 Troubleshooting

### Common Issues:
- **Payment failures**: Check Paystack live keys and webhook URLs
- **Login issues**: Verify JWT_SECRET is set correctly
- **File upload errors**: Check file permissions and MAX_FILE_SIZE
- **Email not sending**: Verify SMTP configuration

### Support:
For technical support, contact the development team or check the system logs in cPanel.
