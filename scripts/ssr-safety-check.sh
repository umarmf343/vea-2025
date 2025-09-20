#!/bin/bash

echo "🔍 VEA 2025 Portal - SSR Safety Check"
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# Check for direct localStorage usage
echo -e "\n📦 Checking for unsafe localStorage usage..."
if grep -r "localStorage\." --include="*.ts" --include="*.tsx" . | grep -v "safe-storage" | grep -v node_modules | grep -v ".next"; then
  echo -e "${RED}❌ Found direct localStorage usage! Use safeStorage instead.${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ No unsafe localStorage usage found${NC}"
fi

# Check for direct sessionStorage usage
echo -e "\n📦 Checking for unsafe sessionStorage usage..."
if grep -r "sessionStorage\." --include="*.ts" --include="*.tsx" . | grep -v "safe-storage" | grep -v node_modules | grep -v ".next"; then
  echo -e "${RED}❌ Found direct sessionStorage usage! Use safeSessionStorage instead.${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ No unsafe sessionStorage usage found${NC}"
fi

# Check for window usage without SSR checks
echo -e "\n🪟 Checking for unsafe window usage..."
if grep -r "window\." --include="*.ts" --include="*.tsx" app/api/ lib/ | grep -v "typeof window" | grep -v node_modules; then
  echo -e "${RED}❌ Found unsafe window usage in server files!${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ No unsafe window usage in server files${NC}"
fi

# Check for malformed Tailwind classes
echo -e "\n🎨 Checking for malformed Tailwind classes..."
if grep -r "bg-\[#[0-9a-fA-F]*\][a-zA-Z]" --include="*.ts" --include="*.tsx" . | grep -v node_modules; then
  echo -e "${RED}❌ Found malformed Tailwind classes! Missing spaces between utilities.${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ No malformed Tailwind classes found${NC}"
fi

# Check for production-ready environment
echo -e "\n🔧 Checking production readiness..."
if grep -r "console\." --include="*.ts" --include="*.tsx" . | grep -v "console.log(\"\[v0\]" | grep -v node_modules | grep -v ".next" | head -5; then
  echo -e "${YELLOW}⚠️  Found console statements - consider removing for production${NC}"
fi

if grep -r "alert(" --include="*.ts" --include="*.tsx" . | grep -v node_modules | head -5; then
  echo -e "${YELLOW}⚠️  Found alert() calls - consider using toast notifications${NC}"
fi

# Summary
echo -e "\n📊 SSR Safety Check Summary"
echo "=========================="
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ All SSR safety checks passed!${NC}"
  echo -e "${GREEN}🚀 Portal is ready for production deployment${NC}"
  exit 0
else
  echo -e "${RED}❌ Found $ERRORS SSR safety issues${NC}"
  echo -e "${RED}🛠️  Please fix the issues above before deployment${NC}"
  exit 1
fi
