const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const priceOracle = require('./price-oracle');

class LiquidationMonitorV2 {
    constructor() {
        this.isRunning = false;
        this.checkInterval = 1000; // Check every second
        this.wss = null;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        
        console.log('⚠️ Liquidation Monitor V2 started - checking every second');
        setInterval(() => this.checkAllAccounts(), this.checkInterval);
    }

    setWebSocketServer(wss) {
        this.wss = wss;
    }

    async checkAllAccounts() {
        const db = new sqlite3.Database(path.join(__dirname, '../../../database.sqlite'));
        
        try {
            // Get all users with open positions
            const users = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT DISTINCT user_id FROM trading_v2_positions WHERE status = 'OPEN'`,
                    [],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows || []);
                    }
                );
            });

            for (const user of users) {
                await this.checkUserLiquidation(db, user.user_id);
            }
        } catch (error) {
            console.error('Liquidation check error:', error);
        } finally {
            db.close();
        }
    }

    async checkUserLiquidation(db, userId) {
        try {
            // Get user's trading balance
            const tradingBalance = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT usdc_balance FROM trading_v2_balances WHERE user_id = ?',
                    [userId],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row ? row.usdc_balance : 0);
                    }
                );
            });

            // Get all open positions for this user
            const positions = await new Promise((resolve, reject) => {
                db.all(
                    'SELECT * FROM trading_v2_positions WHERE user_id = ? AND status = "OPEN"',
                    [userId],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows || []);
                    }
                );
            });

            if (positions.length === 0) return;

            // Calculate total P&L across ALL positions
            let totalPnl = 0;
            let totalMargin = 0;

            const contractSizes = {
                'BTC/USDT': 1,
                'ETH/USDT': 20,
                'ETC/USDT': 1000,
                'SOL/USDT': 100
            };

            positions.forEach(pos => {
                const currentPrice = priceOracle.getPrice(pos.asset, 'mid') || pos.entry_price;
                
                let priceDiff = currentPrice - pos.entry_price;
                if (pos.side === 'SELL') {
                    priceDiff = -priceDiff;
                }
                
                const contractSize = contractSizes[pos.asset] || 1;
                const pnl = priceDiff * pos.volume * contractSize;
                
                totalPnl += pnl;
                totalMargin += pos.margin;
            });

            // Calculate current equity
            const equity = tradingBalance + totalPnl;

            // LIQUIDATION CONDITION: When equity ≤ 0
            if (equity <= 0) {
                console.log(`💀 LIQUIDATING ALL POSITIONS for user ${userId} - Equity: $${equity.toFixed(2)}`);
                await this.liquidateAllPositions(db, userId, positions, totalPnl);
            }

        } catch (error) {
            console.error(`Error checking user ${userId}:`, error);
        }
    }

    async liquidateAllPositions(db, userId, positions, totalPnl) {
        // Start transaction
        await new Promise((resolve, reject) => {
            db.run('BEGIN TRANSACTION', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        try {
            // Mark ALL positions as LIQUIDATED
            for (const pos of positions) {
                // Calculate individual P&L for this position
                const currentPrice = priceOracle.getPrice(pos.asset, 'mid') || pos.entry_price;
                let priceDiff = currentPrice - pos.entry_price;
                if (pos.side === 'SELL') {
                    priceDiff = -priceDiff;
                }
                
                const contractSizes = {
                    'BTC/USDT': 1,
                    'ETH/USDT': 20,
                    'ETC/USDT': 1000,
                    'SOL/USDT': 100
                };
                const contractSize = contractSizes[pos.asset] || 1;
                const positionPnl = priceDiff * pos.volume * contractSize;

                await new Promise((resolve, reject) => {
                    db.run(
                        `UPDATE trading_v2_positions 
                         SET status = 'LIQUIDATED', 
                             pnl = ?,
                             closed_at = CURRENT_TIMESTAMP 
                         WHERE id = ?`,
                        [positionPnl, pos.id],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            }

            // Set trading balance to 0 (they lost everything)
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE trading_v2_balances SET usdc_balance = 0 WHERE user_id = ?',
                    [userId],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });

            await new Promise((resolve, reject) => {
                db.run('COMMIT', (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Notify user via WebSocket
            if (this.wss) {
                this.wss.clients.forEach(client => {
                    if (client.userId === userId && client.readyState === 1) {
                        client.send(JSON.stringify({
                            type: 'ACCOUNT_LIQUIDATION',
                            data: {
                                message: '⚠️ All positions liquidated - account reached $0',
                                totalLoss: Math.abs(totalPnl).toFixed(2)
                            }
                        }));
                    }
                });
            }

            console.log(`✅ User ${userId} fully liquidated, total loss: $${Math.abs(totalPnl).toFixed(2)}`);

        } catch (error) {
            await new Promise((resolve) => {
                db.run('ROLLBACK', () => resolve());
            });
            console.error('Liquidation error:', error);
        }
    }
}

module.exports = new LiquidationMonitorV2();
