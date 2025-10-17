#!/bin/bash

# VEA 2025 Portal - cPanel Node.js Deployment Script
set -e

ZIP_NAME="vea-portal-node-deployment.zip"
APP_ROOT="$(pwd)"

function require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "❌ Required command '$1' is not installed. Please install it and rerun the script."
        exit 1
    fi
}

echo "🚀 Starting VEA 2025 Portal Node.js deployment build..."

require_command node
require_command npm
require_command zip

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building standalone production bundle..."
npm run deploy:server

STANDALONE_DIR="${APP_ROOT}/.next/standalone"
STATIC_DIR="${APP_ROOT}/.next/static"
SERVER_ENTRY="${APP_ROOT}/server.js"
PACKAGE_JSON="${APP_ROOT}/package.json"
LOCKFILE="${APP_ROOT}/package-lock.json"
PUBLIC_DIR="${APP_ROOT}/public"

if [ ! -d "${STANDALONE_DIR}" ]; then
    echo "❌ Standalone build not found at ${STANDALONE_DIR}."
    exit 1
fi

if [ ! -d "${STATIC_DIR}" ]; then
    echo "❌ Static assets not found at ${STATIC_DIR}."
    exit 1
fi

if [ ! -f "${SERVER_ENTRY}" ]; then
    echo "❌ server.js not found in project root."
    exit 1
fi

if [ ! -f "${PACKAGE_JSON}" ]; then
    echo "❌ package.json not found in project root."
    exit 1
fi

if [ ! -d "${PUBLIC_DIR}" ]; then
    echo "❌ public directory not found in project root."
    exit 1
fi

if [ -f "${ZIP_NAME}" ]; then
    echo "🧹 Removing previous archive ${ZIP_NAME}..."
    rm -f "${ZIP_NAME}"
fi

echo "📦 Creating deployment archive ${ZIP_NAME}..."
ZIP_CONTENTS=(
    .next/standalone
    .next/static
    public
    server.js
    ecosystem.config.cjs
    package.json
    package-lock.json
)

if [ -f "${APP_ROOT}/.env.production" ]; then
    ZIP_CONTENTS+=(.env.production)
fi

zip -r "${ZIP_NAME}" "${ZIP_CONTENTS[@]}"
echo "✅ Deployment bundle created: ${ZIP_NAME}"
echo ""
echo "📋 Next Steps:"
echo "1. Upload '${ZIP_NAME}' to your cPanel application directory."
echo "2. Extract the archive inside 'public_html/portal.victoryeducationalacademy.com.ng/'."
echo "3. In the cPanel Node.js Application UI, set the startup file to 'server.js'."
echo "4. Configure environment variables (JWT secrets, Paystack keys, etc.)."
echo "5. Run 'npm install --omit=dev' from the cPanel terminal, then restart the app."
echo "6. (Optional) Start the app with PM2: 'pm2 start ecosystem.config.cjs && pm2 save'."
echo ""
echo "🔑 Default Login Credentials:"
echo "   Super Admin: admin@vea.edu.ng / admin123"
echo "   Teacher: teacher@vea.edu.ng / teacher123"
echo "   Parent: parent@vea.edu.ng / parent123"
echo "   Student: student@vea.edu.ng / student123"
echo ""
echo "🎉 Node.js deployment package ready!"
