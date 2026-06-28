/**
 * PayPal REST API 封装
 * 使用直接 REST API 调用（不依赖 SDK）
 */

require('dotenv').config();
const axios = require('axios');

// 配置
const PCFG = {
    clientId:     process.env.PAYPAL_CLIENT_ID || '',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
    mode:        process.env.PAYPAL_MODE || 'sandbox', // sandbox | live
    currency:    'USD',
    demoMode:    !process.env.PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID === 'YOUR_PAYPAL_CLIENT_ID'
};

// 访问令牌缓存
let accessToken = null;
let tokenExpiry = 0;

// 获取 PayPal 基础 URL
function getBaseURL() {
    return PCFG.mode === 'live' 
        ? 'https://api.paypal.com' 
        : 'https://api.sandbox.paypal.com';
}

// 获取访问令牌（带缓存）
async function getAccessToken() {
    // 检查缓存
    if (accessToken && Date.now() < tokenExpiry) {
        return accessToken;
    }
    
    try {
        const response = await axios.post(
            `${getBaseURL()}/v1/oauth2/token`,
            'grant_type=client_credentials',
            {
                auth: {
                    username: PCFG.clientId,
                    password: PCFG.clientSecret
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        
        accessToken = response.data.access_token;
        tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // 提前 1 分钟过期
        
        return accessToken;
    } catch (e) {
        console.error('[PayPal Auth]', e.response?.data || e.message);
        throw new Error('PayPal 认证失败：' + (e.response?.data?.error_description || e.message));
    }
}

// 创建订单
async function createOrder(plan = 'report', reportId = '', host = '127.0.0.1', port = '3000') {
    const priceMap = {
        monthly: { amount: (29.99).toFixed(2), name: 'Nexus Ora Premium Monthly' },
        report:  { amount: (9.99).toFixed(2), name: 'Nexus Ora Full Report' }
    };
    const pc = priceMap[plan] || priceMap.report;
    
    const token = await getAccessToken();
    
    const baseURL = process.env.APP_URL || `http://${host}:${port}`;
    
    const response = await axios.post(
        `${getBaseURL()}/v2/checkout/orders`,
        {
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: PCFG.currency,
                    value: pc.amount
                },
                description: pc.name
            }],
            application_context: {
                return_url: `${baseURL}/?paypal=success`,
                cancel_url: `${baseURL}/?paypal=cancel`
            }
        },
        {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        }
    );
    
    return {
        orderID: response.data.id,
        approvalUrl: response.data.links.find(l => l.rel === 'approve')?.href,
        status: response.data.status
    };
}

// 捕获订单
async function captureOrder(orderID) {
    const token = await getAccessToken();
    
    const response = await axios.post(
        `${getBaseURL()}/v2/checkout/orders/${orderID}/capture`,
        {},
        {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        }
    );
    
    return {
        captureID: response.data.id,
        status: response.data.status,
        details: response.data
    };
}

// 获取订单详情
async function getOrder(orderID) {
    const token = await getAccessToken();
    
    const response = await axios.get(
        `${getBaseURL()}/v2/checkout/orders/${orderID}`,
        {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }
    );
    
    return response.data;
}

module.exports = {
    createOrder,
    captureOrder,
    getOrder,
    PCFG
};
