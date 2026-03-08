# 🔐 Master Wallet Manager

## Access
- URL: http://localhost:3000/master-wallet.html
- Requires Admin privileges (alice@example.com)

## Features
- View master wallet balance
- See all user deposit wallets
- Check which wallets have funds
- Sweep individual user wallets
- Sweep ALL wallets at once
- Backup private key (DEVELOPMENT ONLY)

## ⚠️ WARNING
- Private key access is DISABLED in production
- Sweeping moves REAL funds on blockchain
- Test on Devnet first!
- Never share private keys!

## Security
- Only accessible by admins
- Private key hidden in production
- All actions logged in database
