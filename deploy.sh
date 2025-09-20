#!/bin/bash

# VEA 2025 Portal - cPanel Deployment Script
echo "🚀 Starting VEA 2025 Portal deployment for cPanel..."

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Build the application for static export
echo "🔨 Building application for cPanel deployment..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

# Check if out directory was created
if [ ! -d "out" ]; then
    echo "❌ Build output directory 'out' not found"
    exit 1
fi

# Create deployment package
echo "📦 Creating deployment package..."
cd out
zip -r ../vea-portal-deployment.zip .
cd ..

echo "✅ VEA 2025 Portal build completed successfully!"
echo ""
echo "📋 Next Steps:"
echo "1. Upload 'vea-portal-deployment.zip' to your cPanel File Manager"
echo "2. Navigate to: public_html/portal2.victoryeducationalacademy.com.ng/"
echo "3. Extract the zip file contents in that directory"
echo "4. Access your portal at: https://portal2.victoryeducationalacademy.com.ng"
echo ""
echo "🔑 Default Login Credentials:"
echo "   Super Admin: admin / admin123"
echo "   Teacher: teacher / teacher123"
echo "   Parent: parent / parent123"
echo "   Student: student / student123"
echo ""
echo "🎉 Deployment package ready!"
