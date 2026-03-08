-- ============================================
-- NEW TABLES FOR PHASE 5 (ADD ONLY)
-- Does NOT modify existing tables
-- ============================================

-- 1. Trading balances (USDC only)
CREATE TABLE IF NOT EXISTS trading_balances (
    user_id TEXT PRIMARY KEY,
    usdc_balance REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 2. Trading positions
CREATE TABLE IF NOT EXISTS trading_positions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    asset TEXT NOT NULL,
    volume REAL NOT NULL,
    side TEXT NOT NULL CHECK(side IN ('BUY', 'SELL')),
    entry_price REAL NOT NULL,
    current_price REAL,
    margin REAL NOT NULL,
    fee REAL NOT NULL,
    pnl REAL DEFAULT 0,
    status TEXT DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'CLOSED', 'LIQUIDATED')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 3. Transfer history between main and trading
CREATE TABLE IF NOT EXISTS trading_transfers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    direction TEXT NOT NULL CHECK(direction IN ('main_to_trading', 'trading_to_main')),
    amount REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 4. Price history for charts
CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset TEXT NOT NULL,
    price REAL NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_trading_positions_user ON trading_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_positions_status ON trading_positions(status);
CREATE INDEX IF NOT EXISTS idx_trading_transfers_user ON trading_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_price_history_asset_time ON price_history(asset, timestamp);

-- Initialize trading balances for existing users (set to 0)
INSERT OR IGNORE INTO trading_balances (user_id, usdc_balance)
SELECT id, 0 FROM users;

SELECT '✅ Phase 5 tables created successfully!' as message;
