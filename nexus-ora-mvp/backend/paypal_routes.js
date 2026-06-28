/**
 * PayPal v2 路由
 * 使用直接 REST API（通过 paypal.js 模块）
 */

module.exports = function(app, db, saveDB, HOST, PORT) {
    const paypal = require('./paypal.js');
    const { PCFG } = paypal;

    // PayPal 订单创建（v2）
    app.post('/api/payment/paypal-v2/create-order', async (req, res) => {
        const { plan = 'report' } = req.body;

        // Demo 模式
        if (PCFG.demoMode) {
            const oid = 'PAYPAL_DEMO_' + Date.now().toString(36).toUpperCase();
            if (db) {
                try {
                    db.run('INSERT INTO orders(id,report_id,plan,amount,status) VALUES(?,?,?,?,?)',
                           [oid, req.body.reportId||'demo', plan, 0, 'demo_completed']);
                    saveDB();
                } catch {}
            }
            return res.json({ success:true, demo:true, orderID: oid });
        }

        try {
            const result = await paypal.createOrder(plan, req.body.reportId || '', HOST, PORT);
            
            // 存库
            if (db) {
                try {
                    const amount = plan === 'monthly' ? 2999 : 999;
                    db.run('INSERT INTO orders(id,report_id,plan,amount,status) VALUES(?,?,?,?,?)',
                           [result.orderID, req.body.reportId||'', plan, amount, 'pending']);
                    saveDB();
                } catch(e) { console.error('[PayPal DB]', e.message); }
            }

            res.json({ success:true, orderID: result.orderID, approvalUrl: result.approvalUrl });
        } catch(e) {
            console.error('[PayPal Create v2]', e.message);
            res.status(500).json({ success:false, error: e.message });
        }
    });

    // PayPal 订单捕获（v2）
    app.post('/api/payment/paypal-v2/capture', async (req, res) => {
        const { orderID } = req.body;
        if (!orderID) return res.status(400).json({ success:false, error: 'Missing orderID' });

        // Demo 模式
        if (PCFG.demoMode || orderID.startsWith('PAYPAL_DEMO_')) {
            if (db) {
                try { db.run('UPDATE orders SET status=? WHERE id=?', ['completed', orderID]); saveDB(); } catch {}
            }
            return res.json({ success:true, demo:true });
        }

        try {
            const result = await paypal.captureOrder(orderID);

            // 更新订单状态
            if (db) {
                try {
                    db.run('UPDATE orders SET status=? WHERE id=?', ['completed', orderID]);
                    saveDB();
                } catch(e) { console.error('[PayPal Capture DB]', e.message); }
            }

            res.json({ success:true, captureID: result.captureID, status: result.status });
        } catch(e) {
            console.error('[PayPal Capture v2]', e.message);
            res.status(500).json({ success:false, error: e.message });
        }
    });

    console.log('[PayPal v2] Routes loaded');
};
