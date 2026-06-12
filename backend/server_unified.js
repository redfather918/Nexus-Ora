/**
 * Nexus Ora MVP - Unified Server v2
 * Single-process server: Frontend + API + Paipan + AI + Payment + SQLite
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const initSqlJs = require('sql.js');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

// ==================== Configuration ====================

const CONFIG = {
    deepseek: {
        apiKey: process.env.DEEPSEEK_API_KEY || '',
        endpoint: 'https://api.deepseek.com/v1/chat/completions',
        model: 'deepseek-chat'
    },
    paipan: {
        pythonPath: path.join(__dirname, 'venv', 'Scripts', 'python.exe'),
        enginePath: path.join(__dirname, 'paipan_engine.py')
    },
    prices: {
        fullReport: 999,
        monthlySub: 999
    },
    dbPath: path.join(__dirname, 'nexus_ora.db')
};

// ==================== Middleware ====================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ==================== Database ====================

let db = null;

async function initDatabase() {
    const SQL = await initSqlJs();
    db = new SQL.Database();
    
    // Try to load existing DB
    if (fs.existsSync(CONFIG.dbPath)) {
        try {
            const buf = fs.readFileSync(CONFIG.dbPath);
            db = new SQL.Database(buf);
            console.log('[DB] Loaded existing database');
            return;
        } catch (e) {
            console.log('[DB] Could not load existing DB, creating new one');
            db = new SQL.Database();
        }
    }
    
    // Create tables
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            gender TEXT,
            birth_date TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        )
    `);
    
    db.run(`
        CREATE TABLE IF NOT EXISTS fortune_reports (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            report_data TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);
    
    db.run(`
        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            report_id TEXT,
            plan TEXT,
            status TEXT DEFAULT 'pending',
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (report_id) REFERENCES fortune_reports(id)
        )
    `);
    
    saveDatabase();
    console.log('[DB] Database initialized');
}

function saveDatabase() {
    if (!db) return;
    const data = db.export();
    fs.writeFileSync(CONFIG.dbPath, Buffer.from(data));
}

// ==================== Paipan Engine ====================

function callPaipan(params) {
    return new Promise((resolve, reject) => {
        const input = JSON.stringify(params);
        const python = spawn(CONFIG.paipan.pythonPath, [CONFIG.paipan.enginePath]);
        
        let stdout = '';
        let stderr = '';
        
        python.stdout.on('data', (data) => { stdout += data.toString(); });
        python.stderr.on('data', (data) => { stderr += data.toString(); });
        
        python.on('close', (code) => {
            if (code !== 0) {
                console.error('[Paipan] Exit code:', code, stderr);
                reject(new Error(stderr || 'Paipan process failed'));
                return;
            }
            try {
                const result = JSON.parse(stdout.trim());
                resolve(result);
            } catch (e) {
                reject(new Error('Failed to parse paipan output: ' + stdout.substring(0, 200)));
            }
        });
        
        python.on('error', (err) => {
            reject(new Error('Failed to start Python: ' + err.message));
        });
        
        // Send input via stdin
        python.stdin.write(input);
        python.stdin.end();
    });
}

// ==================== Fortune Data Generation ====================

function generateFortuneData(paipanResult) {
    const strengthScore = paipanResult.bazi?.strength_score || 50;
    const dayWuxing = paipanResult.bazi?.day_wuxing || '金';
    const dayGan = paipanResult.bazi?.day_gan || '';
    
    const wuxingMap = { '金': 0, '水': 1, '木': 2, '火': 3, '土': 4 };
    const dayIndex = wuxingMap[dayWuxing] || 0;
    
    const phases = [
        { start: 0, end: 18, name: '成长期', base: 48 },
        { start: 19, end: 30, name: '上升期', base: 58 },
        { start: 31, end: 45, name: '黄金期', base: 68 },
        { start: 46, end: 60, name: '稳固期', base: 56 },
        { start: 61, end: 75, name: '智慧期', base: 62 },
        { start: 76, end: 100, name: '颐养期', base: 50 }
    ];
    
    const fortuneData = [];
    
    for (let age = 0; age <= 100; age++) {
        const phase = phases.find(p => age >= p.start && age <= p.end) || phases[0];
        
        // Wuxing cycle effect (10-year cycle aligned with Bazi)
        const cyclePosition = (age + dayIndex * 2) % 10;
        let wuxingBonus = 0;
        if (dayWuxing === '金') {
            if (cyclePosition <= 1) wuxingBonus = 12;
            else if (cyclePosition <= 3) wuxingBonus = 3;
            else if (cyclePosition <= 5) wuxingBonus = -8;
            else if (cyclePosition <= 7) wuxingBonus = 6;
            else wuxingBonus = 10;
        } else if (dayWuxing === '木') {
            if (cyclePosition <= 1) wuxingBonus = -5;
            else if (cyclePosition <= 3) wuxingBonus = 10;
            else if (cyclePosition <= 5) wuxingBonus = 5;
            else if (cyclePosition <= 7) wuxingBonus = -3;
            else wuxingBonus = 8;
        } else if (dayWuxing === '水') {
            if (cyclePosition <= 1) wuxingBonus = 8;
            else if (cyclePosition <= 3) wuxingBonus = -3;
            else if (cyclePosition <= 5) wuxingBonus = 10;
            else if (cyclePosition <= 7) wuxingBonus = -5;
            else wuxingBonus = 6;
        } else if (dayWuxing === '火') {
            if (cyclePosition <= 1) wuxingBonus = 10;
            else if (cyclePosition <= 3) wuxingBonus = 5;
            else if (cyclePosition <= 5) wuxingBonus = -3;
            else if (cyclePosition <= 7) wuxingBonus = 8;
            else wuxingBonus = -8;
        } else if (dayWuxing === '土') {
            if (cyclePosition <= 1) wuxingBonus = 5;
            else if (cyclePosition <= 3) wuxingBonus = -5;
            else if (cyclePosition <= 5) wuxingBonus = 8;
            else if (cyclePosition <= 7) wuxingBonus = -3;
            else wuxingBonus = 10;
        }
        
        // Sinusoidal fluctuation
        const random = Math.sin(age * 0.7) * 10 + Math.cos(age * 0.3) * 5;
        
        let score = Math.round(phase.base + wuxingBonus + random + (strengthScore - 50) * 0.15);
        score = Math.max(10, Math.min(98, score));
        
        // Milestones
        const milestones = [];
        if (age === 18) milestones.push('高考/成年');
        if (age === 22) milestones.push('大学毕业');
        if (age === 25) milestones.push('职场起步');
        if (age === 30) milestones.push('而立之年');
        if (age === 40) milestones.push('不惑之年');
        if (age === 50) milestones.push('知天命');
        if (age === 60) milestones.push('退休节点');
        
        let level;
        if (score >= 75) level = '大吉';
        else if (score >= 60) level = '小吉';
        else if (score >= 45) level = '平稳';
        else if (score >= 30) level = '小凶';
        else level = '大凶';
        
        fortuneData.push({ age, score, level, milestones, phase: phase.name });
    }
    
    return fortuneData;
}

// ==================== AI Integration ====================

async function callDeepSeekAI(prompt) {
    if (!CONFIG.deepseek.apiKey) return null;
    
    try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(CONFIG.deepseek.endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.deepseek.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: CONFIG.deepseek.model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 4000
            })
        });
        
        if (!response.ok) {
            console.error('[AI] API error:', response.status);
            return null;
        }
        
        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
    } catch (error) {
        console.error('[AI] Error:', error.message);
        return null;
    }
}

// ==================== API Routes ====================

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'nexus-ora',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        ai_available: !!CONFIG.deepseek.apiKey,
        db: db ? 'connected' : 'not initialized'
    });
});

// Fortune generation - main endpoint
app.post('/api/fortune', async (req, res) => {
    try {
        const { year, month, day, hour, minute, gender } = req.body;
        
        if (!year || !month || !day) {
            return res.status(400).json({ success: false, error: 'Missing required parameters: year, month, day' });
        }
        
        // Validate inputs
        if (year < 1900 || year > 2100) return res.status(400).json({ success: false, error: 'Year must be 1900-2100' });
        if (month < 1 || month > 12) return res.status(400).json({ success: false, error: 'Month must be 1-12' });
        if (day < 1 || day > 31) return res.status(400).json({ success: false, error: 'Day must be 1-31' });
        if (hour !== undefined && (hour < 0 || hour > 23)) return res.status(400).json({ success: false, error: 'Hour must be 0-23' });
        
        // Step 1: Paipan via Python
        let paipanResult;
        try {
            paipanResult = await callPaipan({
                year, month, day,
                hour: hour || 12,
                minute: minute || 0,
                gender: gender || '男'
            });
        } catch (err) {
            console.error('[Fortune] Paipan failed:', err.message);
            return res.status(500).json({ success: false, error: 'Paipan engine error: ' + err.message });
        }
        
        if (!paipanResult.success) {
            return res.status(500).json(paipanResult);
        }
        
        // Step 2: Generate fortune data
        const fortuneData = generateFortuneData(paipanResult);
        
        // Step 3: AI enhancement (if available)
        let aiAnalysis = null;
        if (CONFIG.deepseek.apiKey) {
            const aiPrompt = buildAIPrompt(paipanResult);
            const aiResult = await callDeepSeekAI(aiPrompt);
            
            if (aiResult) {
                try {
                    const jsonMatch = aiResult.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        aiAnalysis = Array.isArray(parsed.phases) ? parsed.phases 
                            : Array.isArray(parsed) ? parsed 
                            : [{ name: 'AI Analysis', advice: aiResult.substring(0, 500) }];
                    } else {
                        aiAnalysis = [{ name: 'AI Analysis', advice: aiResult.substring(0, 500) }];
                    }
                } catch (e) {
                    aiAnalysis = [{ name: 'AI Analysis', advice: aiResult.substring(0, 500) }];
                }
            }
        }
        
        // Step 4: Build report
        const report = {
            bazi: paipanResult,
            fortune: fortuneData,
            ai_analysis: aiAnalysis,
            ai_enhanced: aiAnalysis !== null,
            summary: {
                body_strength: paipanResult.bazi?.body_strength || '--',
                day_master: paipanResult.bazi?.day_gan || '--',
                day_wuxing: paipanResult.bazi?.day_wuxing || '--',
                animal: paipanResult.info?.animal || '--',
                best_ages: fortuneData.filter(f => f.score >= 75).map(f => f.age).slice(0, 5),
                challenging_ages: fortuneData.filter(f => f.score < 35).map(f => f.age).slice(0, 3),
                average_score: Math.round(fortuneData.reduce((s, f) => s + f.score, 0) / fortuneData.length)
            }
        };
        
        // Step 5: Save to DB
        const reportId = 'RPT' + Date.now().toString(36).toUpperCase();
        const userId = 'USR' + Date.now().toString(36).toUpperCase();
        
        if (db) {
            try {
                db.run('INSERT OR REPLACE INTO users (id, gender, birth_date) VALUES (?, ?, ?)',
                    [userId, gender, `${year}-${month}-${day}`]);
                db.run('INSERT INTO fortune_reports (id, user_id, report_data) VALUES (?, ?, ?)',
                    [reportId, userId, JSON.stringify(report)]);
                saveDatabase();
            } catch (e) {
                console.error('[DB] Save error:', e.message);
            }
        }
        
        res.json({
            success: true,
            report_id: reportId,
            data: report
        });
        
    } catch (error) {
        console.error('[Fortune] Unexpected error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

function buildAIPrompt(paipanResult) {
    return `你是一位资深东方命理师。基于以下八字信息，为每个十年阶段提供一句趋势建议（25字以内）。

八字: ${JSON.stringify(paipanResult.bazi)}
五行分布: ${JSON.stringify(paipanResult.wuxing_balance)}
身强身弱: ${paipanResult.bazi?.body_strength || '中平'}

请输出JSON格式: {"phases": [{"name": "阶段名", "advice": "建议内容"}]}
涵盖这六个阶段：成长期(0-18岁)、上升期(19-30岁)、黄金期(31-45岁)、稳固期(46-60岁)、智慧期(61-75岁)、颐养期(76-100岁)。`;
}

// Get report by ID
app.get('/api/report/:id', (req, res) => {
    if (!db) return res.status(500).json({ success: false, error: 'Database not initialized' });
    
    try {
        const result = db.exec('SELECT report_data FROM fortune_reports WHERE id = ?', [req.params.id]);
        if (!result.length || !result[0].values.length) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }
        const data = JSON.parse(result[0].values[0][0]);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to retrieve report' });
    }
});

// Payment - create checkout (demo mode with real Stripe support)
app.post('/api/payment/create-checkout', async (req, res) => {
    try {
        const { reportId, plan } = req.body;
        
        // Demo mode: immediate unlock
        if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
            if (db) {
                try {
                    const orderId = 'ORD' + Date.now().toString(36).toUpperCase();
                    db.run('INSERT INTO orders (id, report_id, plan, status) VALUES (?, ?, ?, ?)',
                        [orderId, reportId || 'demo', plan || 'report', 'completed']);
                    saveDatabase();
                } catch (e) { /* ignore */ }
            }
            return res.json({
                success: true,
                demo: true,
                message: 'Demo mode - auto unlocked',
                report_id: reportId
            });
        }
        
        // Real Stripe integration
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        
        const priceConfig = plan === 'monthly'
            ? { amount: CONFIG.prices.monthlySub, name: 'Nexus Ora - Monthly Premium', desc: 'Full access, renewed monthly' }
            : { amount: CONFIG.prices.fullReport, name: 'Nexus Ora - Complete Report', desc: 'Unlock your full life journey' };
        
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: { name: priceConfig.name, description: priceConfig.desc },
                    unit_amount: priceConfig.amount
                },
                quantity: 1
            }],
            mode: plan === 'monthly' ? 'subscription' : 'payment',
            success_url: `http://localhost:${PORT}/?paid=true&report=${reportId || ''}`,
            cancel_url: `http://localhost:${PORT}/`
        });
        
        // Save order
        if (db) {
            const orderId = 'ORD' + Date.now().toString(36).toUpperCase();
            db.run('INSERT INTO orders (id, report_id, plan, status) VALUES (?, ?, ?, ?)',
                [orderId, reportId, plan, 'pending']);
            saveDatabase();
        }
        
        res.json({
            success: true,
            session_url: session.url,
            session_id: session.id
        });
        
    } catch (error) {
        console.error('[Payment] Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Payment verification
app.post('/api/payment/verify', (req, res) => {
    const { reportId, shared } = req.body;
    res.json({
        success: true,
        unlocked: true,
        method: shared ? 'shared' : 'demo'
    });
});

// ==================== Start ====================

async function start() {
    try {
        await initDatabase();
        
        // Prevent port binding issues
        const server = app.listen(PORT, HOST, () => {
            console.log('');
            console.log('========================================');
            console.log('  Nexus Ora MVP Server v2');
            console.log('========================================');
            console.log(`  URL:  http://${HOST}:${PORT}`);
            console.log(`  API:  http://${HOST}:${PORT}/api`);
            console.log(`  AI:   ${CONFIG.deepseek.apiKey ? 'DeepSeek ready' : 'Demo mode (algorithm)'}`);
            console.log(`  DB:   SQLite (${db ? 'connected' : 'error'})`);
            console.log('========================================');
            console.log('');
            console.log('Press Ctrl+C to stop the server');
            console.log('');
        });
        
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`[ERROR] Port ${PORT} is already in use.`);
                console.error(`Try: netstat -ano | findstr :${PORT}`);
                console.error(`Or set PORT env variable to another port.`);
            } else {
                console.error('[ERROR] Server error:', err.message);
            }
            process.exit(1);
        });
        
    } catch (error) {
        console.error('[FATAL] Failed to start server:', error.message);
        process.exit(1);
    }
}

start();
