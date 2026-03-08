DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS deposits;

CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    wallet_index INTEGER UNIQUE NOT NULL,
    deposit_address TEXT UNIQUE NOT NULL,
    sol_balance REAL DEFAULT 0,
    usdc_balance REAL DEFAULT 0,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE deposits (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    asset TEXT NOT NULL,
    amount REAL NOT NULL,
    tx_signature TEXT UNIQUE NOT NULL,
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_deposit_address ON users(deposit_address);
