#!/bin/bash

echo "🚀 Preparing VEA 2025 Portal for Production Deployment"

echo "📝 Removing development artifacts..."

# Remove console.log, console.error, console.warn statements
find . -name "*.tsx" -o -name "*.ts" -o -name "*.js" | grep -v node_modules | grep -v .next | xargs sed -i '/console\.$$log\|error\|warn\|debug\|info$$/d'

# Remove debugger statements
find . -name "*.tsx" -o -name "*.ts" -o -name "*.js" | grep -v node_modules | grep -v .next | xargs sed -i '/debugger;/d'

# Replace alert() calls with toast notifications
echo "🔔 Replacing alert() calls with toast notifications..."
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | xargs sed -i 's/alert(/toast.error(/g'

# Replace localhost URLs with production URLs
echo "🌐 Updating URLs for production..."
find . -name "*.tsx" -o -name "*.ts" -o -name "*.js" | grep -v node_modules | xargs sed -i 's/localhost:3000/portal.victoryeducationalacademy.com.ng/g'
find . -name "*.tsx" -o -name "*.ts" -o -name "*.js" | grep -v node_modules | xargs sed -i 's/http:\/\/portal/https:\/\/portal/g'

# Remove mock data comments and TODO items
echo "🧹 Cleaning up development comments..."
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | xargs sed -i '/\/\/ Mock data/d'
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | xargs sed -i '/\/\/ TODO:/d'
find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules | xargs sed -i '/\/\/ FIXME:/d'

# Update environment configuration
echo "⚙️ Setting production environment..."
cp .env.production .env.local

# Build the application
echo "🔨 Building application for production..."
npm run build

# Create deployment package
echo "📦 Creating deployment package..."
zip -r vea-2025-production.zip .next public package.json server.js lib components app scripts -x "*.git*" "node_modules/*" "*.log" "__tests__/*" "*.test.*" "*.spec.*"

echo "✅ Production preparation complete!"
echo "📋 Next steps:"
echo "1. Upload vea-2025-production.zip to your cPanel File Manager"
echo "2. Extract to public_html/portal.victoryeducationalacademy.com.ng/"
echo "3. Update .env.local with your live Paystack keys"
echo "4. Run 'npm install --production' and 'npm start' via SSH"
echo ""
echo "🔑 Default Login Credentials:"
echo "Super Admin: admin@vea.edu.ng / admin123"
echo "Teacher: teacher@vea.edu.ng / teacher123"
echo "Parent: parent@vea.edu.ng / parent123"
echo "Student: student@vea.edu.ng / student123"
echo ""
echo "⚠️  IMPORTANT: Change all default passwords after deployment!"
