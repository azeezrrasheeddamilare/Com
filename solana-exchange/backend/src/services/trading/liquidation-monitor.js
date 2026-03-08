const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const priceOracle = require('./price-oracle');

class LiquidationMonitor {
    constructor() {
        this.isRunning = false;
        this.checkInterval = 2000; // Check every 2 seconds
        this.wss = null;
        
        // Contract sizes
        this.contractSizes = {
            'BTC/USDT': 1,
            'ETH/USDT': 20,
            'ETC/USDT': 1000,
            'SOL/USDT': 100
        };
    }
    
    setWebSocketServer(wss) {
        this.wss = wss;
    }
    
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        
        console.log('⚠️ Liquidation monitor started');
        
        // Listen to price updates
        priceOracle.onUpdate((prices) => {
            this.updateAllPositions(prices);
        });
        
        // Also run periodic check
        setInterval(() => this.checkLiquidations(), this.checkInterval);
    }
    
    async updateAllPositions(prices) {
        const db = new sqlite3.Database(path.join(__dirname, '../../../database.sqlite'));
        
        try {
            // Get all open positions
            const positions = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT * FROM trading_positions WHERE status = 'OPEN'`,
                    [],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows || []);
                    }
                );
            });
            
            const updates = [];
            
            for (const position of positions) {
                const currentPrice = prices[position.asset];
                if (!currentPrice) continue;
                
                // Calculate P&L
                const contractSize = this.contractSizes[position.asset];
                let priceDiff = currentPrice - position.entry_price;
                
                if (position.side === 'SELL') {
                    priceDiff = -priceDiff;
                }
                
                const pnl = priceDiff * position.volume * contractSize;
                
                // Update position in database
                updates.push(
                    new Promise((resolve) => {
                        db.run(
                            'UPDATE trading_positions SET current_price = ?, pnl = ? WHERE id = ?',
                            [currentPrice, pnl, position.id],
                            (err) => resolve()
                        );
                    })
                );
                
                // Check liquidation (get fresh trading balance)
                const tradingBalance = await this.getTradingBalance(db, position.user_id);
                const equity = tradingBalance + pnl;
                
                if (equity <= 0 && position.status === 'OPEN') {
                    await this.liquidatePosition(db, position, pnl);
                }
            }
            
            await Promise.all(updates);
            
            // Broadcast updates to all connected clients
            if (this.wss) {
                this.broadcastUpdates(positions);
            }
            
        } catch (error) {
            console.error('Position update error:', error);
        } finally {
            db.close();
        }
    }
    
    async checkLiquidations() {
        const db = new sqlite3.Database(path.join(__dirname, '../../../database.sqlite'));
        
        try {
            const positions = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT p.*, t.usdc_balance as trading_balance
                     FROM trading_positions p
                     JOIN trading_balances t ON p.user_id = t.user_id
                     WHERE p.status = 'OPEN'`,
                    [],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows || []);
                    }
                );
            });
            
            for (const position of positions) {
                const currentPrice = priceOracle.getPrice(position.asset);
                if (!currentPrice) continue;
                
                const contractSize = this.contractSizes[position.asset];
                let priceDiff = currentPrice - position.entry_price;
                
                if (position.side === 'SELL') {
                    priceDiff = -priceDiff;
                }
                
                const pnl = priceDiff * position.volume * contractSize;
                const equity = position.trading_balance + pnl;
                
                if (equity <= 0) {
                    await this.liquidatePosition(db, position, pnl);
                }
            }
            
        } catch (error) {
            console.error('Liquidation check error:', error);
        } finally {
            db.close();
        }
    }
    
    async getTradingBalance(db, userId) {
        return new Promise((resolve) => {
            db.get(
                'SELECT usdc_balance FROM trading_balances WHERE user_id = ?',
                [userId],
                (err, row) => resolve(row ? row.usdc_balance : 0)
            );
        });
    }
    
    async liquidatePosition(db, position, pnl) {
        console.log(`💀 Liquidating position ${position.id} for user ${position.user_id}`);
        
        // Update position status
        await new Promise((resolve) => {
            db.run(
                `UPDATE trading_positions 
                 SET status = 'LIQUIDATED', 
                     current_price = ?,
                     pnl = ?,
                     closed_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [position.current_price || priceOracle.getPrice(position.asset), pnl, position.id],
                (err) => resolve()
            );
        });
        
        // Notify user via WebSocket
        if (this.wss) {
            this.wss.clients.forEach(client => {
                if (client.userId === position.user_id && client.readyState === 1) {
                    client.send(JSON.stringify({
                        type: 'LIQUIDATION',
                        data: {
                            positionId: position.id,
                            asset: position.asset,
                            volume: position.volume,
                            loss: Math.abs(pnl).toFixed(2)
                        }
                    }));
                }
            });
        }
    }
    
    async broadcastUpdates(positions) {
        if (!this.wss) return;
        
        // Group positions by user
        const userPositions = {};
        positions.forEach(pos => {
            if (!userPositions[pos.user_id]) {
                userPositions[pos.user_id] = [];
            }
            userPositions[pos.user_id].push(pos);
        });
        
        // Send updates to each user
        this.wss.clients.forEach(client => {
            if (client.userId && userPositions[client.userId]) {
                client.send(JSON.stringify({
                    type: 'POSITION_UPDATE',
                    data: userPositions[client.userId]
                }));
            }
        });
    }
}

module.exports = new LiquidationMonitor();
