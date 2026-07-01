# Nexus Ora 生产服务器部署指引

## 当前状态（2026-07-02）
生产服务器 `https://life.p1web.site` 返回 **502 Bad Gateway**  
原因：Cloudflare 无法连接到源站 Node.js 服务（源站后端进程已停止）

---

## 快速重启（SSH 登录服务器后执行）

```bash
# 1. 进入项目目录
cd ~/Nexus-Ora/nexus-ora-mvp/backend

# 2. 拉取最新代码
git pull origin main

# 3. 安装依赖（如有新增）
npm install --production

# 4. 检查 .env 文件（生产环境必须设置）
cat .env
# 确保以下字段正确：
#   HOST=0.0.0.0        ← 生产环境必须 0.0.0.0，不能是 127.0.0.1
#   PORT=3000
#   NODE_ENV=production

# 5. 用 PM2 重启（推荐）
pm2 list
pm2 restart nexus-ora     # 如果已有 PM2 进程
# 或者首次启动：
pm2 start server_unified.js --name nexus-ora --env production
pm2 save
pm2 startup  # 设置开机自启

# 6. 验证是否正常
curl http://localhost:3000/api/health
# 或
curl -X POST http://localhost:3000/api/fortune \
  -H "Content-Type: application/json" \
  -d '{"birth_date":"1990-01-01","birth_time":"12:00","gender":"male"}'
```

---

## 如果没有 PM2（用 nohup）

```bash
cd ~/Nexus-Ora/nexus-ora-mvp/backend
nohup node server_unified.js > server.log 2>&1 &
echo $! > server.pid
echo "Server started, PID: $(cat server.pid)"
```

---

## .env 生产环境配置模板

```env
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# DeepSeek AI（可选，无 key 时自动降级为算法模式）
DEEPSEEK_API_KEY=你的key

# PayPal
PAYPAL_CLIENT_ID=你的client_id
PAYPAL_CLIENT_SECRET=你的client_secret
PAYPAL_MODE=sandbox   # 上线时改为 live

# App URL
APP_URL=https://life.p1web.site
SHARE_URL=https://life.p1web.site
```

---

## 重要：HOST 配置

| 环境 | HOST 设置 | 原因 |
|------|----------|------|
| 本地开发（Windows） | `HOST=127.0.0.1` | 避免防火墙弹窗 |
| 生产服务器 | `HOST=0.0.0.0` | 允许 Nginx/外网访问 |

---

## Nginx 反向代理配置（如适用）

```nginx
server {
    listen 80;
    server_name life.p1web.site;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 排查 Cloudflare 502 步骤

1. SSH 登录服务器
2. `netstat -tlnp | grep 3000` —— 检查 3000 端口是否监听
3. `pm2 list` 或 `ps aux | grep node` —— 检查 Node 进程
4. `tail -50 ~/Nexus-Ora/nexus-ora-mvp/backend/server.log` —— 查看错误日志
5. 手动测试：`curl http://localhost:3000/` 
6. 如正常，检查 Nginx：`nginx -t && systemctl status nginx`
