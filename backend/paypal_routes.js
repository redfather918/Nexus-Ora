/**
 * PayPal v2 路由
 * 使用直接 REST API（通过 paypal.js 模块）
 * v5.0: 增加会员订阅路由
 */

module.exports = function(app, db, saveDB, HOST, PORT) {
    const paypal = require('./paypal.js');
    const { PCFG } = paypal;

    // 会员价格映射（分）
    const PLAN_PRICES = {
        report:          999,
        premium_monthly: 999,
        premium_annual:  5999,
        monthly:         999,  // 向后兼容
    };

    // PayPal 订单创建（v2）— 单次报告
    app.post('/api/payment/paypal-v2/create-order', async (req, res) => {
        const { plan = 'report' } = req.body;

        // Demo 模式
        if (PCFG.demoMode) {
            const oid = 'PAYPAL_DEMO_' + Date.now().toString(36).toUpperCase();
            if (db) {
                try {
                    db.run('INSERT INTO orders(id,report_id,plan,amount,status,user_id) VALUES(?,?,?,?,?,?)',
                           [oid, req.body.reportId||'demo', plan, 0, 'demo_completed', req.body.userId||null]);
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
                    const amount = PLAN_PRICES[plan] || 999;
                    db.run('INSERT INTO orders(id,report_id,plan,amount,status,user_id,paypal_order_id) VALUES(?,?,?,?,?,?,?)',
                           [result.orderID, req.body.reportId||'', plan, amount, 'pending', req.body.userId||null, result.orderID]);
                    saveDB();
                } catch(e) { console.error('[PayPal DB]', e.message); }
            }

            res.json({ success:true, orderID: result.orderID, approvalUrl: result.approvalUrl });
        } catch(e) {
            console.error('[PayPal Create v2]', e.message);
            res.status(500).json({ success:false, error: e.message });
        }
    });

    // PayPal 会员订阅订单创建（v2）— 月度/年度会员
    app.post('/api/payment/paypal-v2/create-membership', async (req, res) => {
        const { plan, userId } = req.body;
        if (!plan || !['premium_monthly', 'premium_annual'].includes(plan)) {
            return res.status(400).json({ success:false, error: 'Invalid plan. Use premium_monthly or premium_annual' });
        }

        // Demo 模式
        if (PCFG.demoMode) {
            const oid = 'PAYPAL_DEMO_' + Date.now().toString(36).toUpperCase();
            if (db) {
                try {
                    db.run('INSERT INTO orders(id,report_id,plan,amount,status,user_id,paypal_order_id) VALUES(?,?,?,?,?,?,?)',
                           [oid, 'membership', plan, 0, 'demo_completed', userId||null, oid]);
                    saveDB();
                } catch {}
            }
            return res.json({ success:true, demo:true, orderID: oid, plan });
        }

        try {
            const result = await paypal.createOrder(plan, '', HOST, PORT);

            // 存库
            if (db) {
                try {
                    const amount = PLAN_PRICES[plan] || 999;
                    db.run('INSERT INTO orders(id,report_id,plan,amount,status,user_id,paypal_order_id) VALUES(?,?,?,?,?,?,?)',
                           [result.orderID, 'membership', plan, amount, 'pending', userId||null, result.orderID]);
                    saveDB();
                } catch(e) { console.error('[PayPal Membership DB]', e.message); }
            }

            res.json({ success:true, orderID: result.orderID, approvalUrl: result.approvalUrl, plan });
        } catch(e) {
            console.error('[PayPal Membership Create]', e.message);
            res.status(500).json({ success:false, error: e.message });
        }
    });

    // PayPal 订单捕获（v2）— 通用，支持报告和会员
    app.post('/api/payment/paypal-v2/capture', async (req, res) => {
        const { orderID, userId, plan } = req.body;
        if (!orderID) return res.status(400).json({ success:false, error: 'Missing orderID' });

        // Demo 模式
        if (PCFG.demoMode || orderID.startsWith('PAYPAL_DEMO_')) {
            if (db) {
                try {
                    db.run('UPDATE orders SET status=? WHERE id=?', ['completed', orderID]);
                    saveDB();
                } catch {}
            }
            // Demo 模式下自动激活会员
            let membershipActivated = false;
            if (userId && plan && db) {
                membershipActivated = activateMembershipInternal(userId, plan);
            }
            return res.json({ success:true, demo:true, membershipActivated });
        }

        try {
            const result = await paypal.captureOrder(orderID);

            // 更新订单状态
            let orderPlan = plan;
            if (db) {
                try {
                    db.run('UPDATE orders SET status=? WHERE id=?', ['completed', orderID]);
                    // 查询订单的 plan 和 user_id
                    const orderRows = db.exec('SELECT plan, user_id FROM orders WHERE id=?', [orderID]);
                    if (orderRows[0] && orderRows[0].values.length) {
                        orderPlan = orderRows[0].values[0][0] || orderPlan;
                        const orderUserId = orderRows[0].values[0][1] || userId;
                        saveDB();
                        // 如果是会员计划，激活会员
                        if (orderUserId && ['premium_monthly', 'premium_annual', 'monthly'].includes(orderPlan)) {
                            activateMembershipInternal(orderUserId, orderPlan);
                        }
                    }
                } catch(e) { console.error('[PayPal Capture DB]', e.message); }
            }

            res.json({ success:true, captureID: result.captureID, status: result.status, plan: orderPlan });
        } catch(e) {
            console.error('[PayPal Capture v2]', e.message);
            res.status(500).json({ success:false, error: e.message });
        }
    });

    // 内部函数：激活会员（避免循环依赖 server_unified.js）
    function activateMembershipInternal(userId, plan) {
        if (!db || !userId) return false;
        const now = new Date();
        let expires;
        let tierName;
        if (plan === 'premium_monthly' || plan === 'monthly') {
            expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            tierName = 'premium_monthly';
        } else if (plan === 'premium_annual') {
            expires = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
            tierName = 'premium_annual';
        } else if (plan === 'report') {
            tierName = 'report_only';
            expires = null;
        } else {
            return false;
        }
        const expiresStr = expires ? expires.toISOString().replace('T', ' ').slice(0, 19) : null;
        const startedStr = now.toISOString().replace('T', ' ').slice(0, 19);
        try {
            db.run('UPDATE auth_users SET membership_tier=?, membership_expires=?, membership_started=? WHERE id=?',
                   [tierName, expiresStr, startedStr, userId]);
            const subId = 'SUB_' + Date.now().toString(36).toUpperCase();
            const amount = PLAN_PRICES[plan] || 0;
            db.run('INSERT INTO subscriptions(id,user_id,plan,amount,status,started_at,expires_at) VALUES(?,?,?,?,?,?,?)',
                   [subId, userId, tierName, amount, 'active', startedStr, expiresStr]);
            saveDB();
            console.log(`[Membership] activated: user=${userId}, plan=${tierName}, expires=${expiresStr || 'never'}`);
            return true;
        } catch(e) {
            console.error('[Membership] activate error:', e.message);
            return false;
        }
    }

    console.log('[PayPal v2] Routes loaded (v5.0 with membership)');
};
