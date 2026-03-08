#!/bin/bash
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting Solana Exchange...${NC}"
echo -e "${GREEN}📱 http://localhost:3000${NC}\n"

if [ ! -f "database.sqlite" ]; then
    echo "📦 Creating database..."
    sqlite3 database.sqlite < init.sql
fi

# Use the dev script which respects nodemon config
yarn dev
