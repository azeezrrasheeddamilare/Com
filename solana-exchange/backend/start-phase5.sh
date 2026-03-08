#!/bin/bash

# Start script with Phase 5 services
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting Solana Exchange with Phase 5 CFD Trading...${NC}"
echo -e "${GREEN}📱 Main Exchange: http://localhost:3000${NC}"
echo -e "${GREEN}📈 CFD Trading: http://localhost:3000/trading.html${NC}"
echo -e "${GREEN}👑 Admin Panel: http://localhost:3000/admin-ultimate.html${NC}\n"

# Check if database exists
if [ ! -f "database.sqlite" ]; then
    echo "📦 Creating database..."
    sqlite3 database.sqlite < init.sql
    sqlite3 database.sqlite < database-migrations/001-trading-tables.sql
fi

# Start server
yarn dev
