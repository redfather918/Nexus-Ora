/**
 * Nexus Ora - 共享 LLM 客户端
 * 供多智能体议会 (agent_council) 与人生沙盘 (life_sandbox) 复用。
 * 特性：JSON 模式、超时中断、一次自动重试、失败返回 null（由上层回退）。
 */

const DEFAULTS = {
    url:     'https://api.deepseek.com/v1/chat/completions',
    model:   'deepseek-chat',
    timeout: 90_000
};

let cfg = { ...DEFAULTS, apiKey: '' };

function configure(options = {}) {
    cfg = { ...cfg, ...options };
}

function available() {
    return !!cfg.apiKey && cfg.apiKey !== 'sk-placeholder';
}

/**
 * 调用 LLM 并解析 JSON。
 * @param {string} system  系统提示词（智能体人格）
 * @param {string} user    用户消息
 * @param {object} opts    { temperature, maxTokens, retries }
 * @returns {object|null}  解析后的 JSON，失败返回 null
 */
async function callJSON(system, user, opts = {}) {
    if (!available()) return null;
    const { temperature = 0.6, maxTokens = 4096, retries = 1 } = opts;

    for (let attempt = 0; attempt <= retries; attempt++) {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), cfg.timeout);
        try {
            const res = await fetch(cfg.url, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: cfg.model,
                    messages: [
                        { role: 'system', content: system },
                        { role: 'user', content: user }
                    ],
                    temperature,
                    max_tokens: maxTokens,
                    response_format: { type: 'json_object' }
                }),
                signal: ctrl.signal
            });
            clearTimeout(tid);
            if (!res.ok) { console.error('[LLM] HTTP', res.status); continue; }

            const data = await res.json();
            const raw = data.choices?.[0]?.message?.content;
            if (!raw) continue;

            try { return JSON.parse(raw); }
            catch {
                const m = raw.match(/\{[\s\S]*\}/);
                if (m) { try { return JSON.parse(m[0]); } catch {} }
            }
        } catch (e) {
            clearTimeout(tid);
            console.error(`[LLM] attempt ${attempt + 1} error:`, e.message);
        }
    }
    return null;
}

module.exports = { configure, available, callJSON };
