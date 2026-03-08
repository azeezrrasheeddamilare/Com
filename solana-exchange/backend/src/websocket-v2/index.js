const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const priceOracle = require('../services/trading-v2/price-oracle');

function setupWebSocketV2(server) {
    const wss = new WebSocket.Server({ server, path: '/ws-v2' });
    
    priceOracle.onUpdate((prices) => {
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'PRICE_UPDATE',
                    data: prices
                }));
            }
        });
    });
    
    wss.on('connection', async (ws, req) => {
        const urlParams = new URLSearchParams(req.url.split('?')[1]);
        const token = urlParams.get('token');
        
        if (!token) {
            ws.close();
            return;
        }
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            ws.userId = decoded.id;
            
            // Send initial data
            const db = new sqlite3.Database(path.join(__dirname, '../../database.sqlite'));
            
            const tradingBalance = await new Promise((resolve) => {
                db.get(
                    'SELECT usdc_balance FROM trading_v2_balances WHERE user_id = ?',
                    [ws.userId],
                    (err, row) => resolve(row ? row.usdc_balance : 0)
                );
            });
            
            const positions = await new Promise((resolve) => {
                db.all(
                    'SELECT * FROM trading_v2_positions WHERE user_id = ? AND status = "OPEN"',
                    [ws.userId],
                    (err, rows) => resolve(rows || [])
                );
            });
            
            db.close();
            
            ws.send(JSON.stringify({
                type: 'INIT',
                data: {
                    tradingBalance,
                    positions: positions.map(p => ({
                        ...p,
                        current_price: priceOracle.getPrice(p.asset, 'mid') || p.entry_price
                    })),
                    prices: priceOracle.getAllPrices()
                }
            }));
            
        } catch (error) {
            console.error('WebSocket auth error:', error);
            ws.close();
        }
    });
    
    return wss;
}

module.exports = { setupWebSocketV2 };
