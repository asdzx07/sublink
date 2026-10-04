<div align="center">
  <img src="public/favicon.png" alt="Sublink Worker" width="120" height="120"/>

  <h1><b>Sublink Worker</b></h1>
  <h5><i>One Worker, All Subscriptions</i></h5>

  <p><b>轻量级代理协议订阅转换与管理工具，可部署于 Cloudflare Workers、Vercel、Node.js 或 Docker。</b></p>

  <p><i>Fork 自 <a href="https://github.com/7Sageer/sublink-worker">7Sageer/sublink-worker</a>，加入了大量针对国内网络环境的优化与新功能。</i></p>

  <br>

<p style="display: flex; align-items: center; gap: 10px;">
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/asdzx07/sublink">
    <img src="https://deploy.workers.cloudflare.com/button" alt="部署到 Cloudflare Workers" style="height: 32px;"/>
  </a>
  <a href="https://vercel.com/new/clone?repository-url=https://github.com/asdzx07/sublink&env=KV_REST_API_URL,KV_REST_API_TOKEN&envDescription=Vercel%20KV%20credentials%20for%20data%20storage&envLink=https://vercel.com/docs/storage/vercel-kv">
    <img src="https://vercel.com/button" alt="部署到 Vercel" style="height: 32px;"/>
  </a>
</p>

  <h3>📚 文档</h3>
  <p>
    <a href="https://sublink.works"><b>中文文档</b></a> ·
    <a href="https://sublink.works/en/"><b>English Docs</b></a>
  </p>
  <p>
    <a href="https://sublink.works/guide/quick-start/">快速上手</a> ·
    <a href="https://sublink.works/api/">API 参考</a> ·
    <a href="https://sublink.works/guide/faq/">常见问题</a>
  </p>
</div>

## 🚀 快速开始

### 一键部署
- 点击上方任一部署按钮
- 完成！详见[文档](https://sublink.works/guide/quick-start/)

### 其他运行方式
- **Node.js**：`npm run build:node && node dist/node-server.cjs`
- **Vercel**：`vercel deploy`（在项目设置中配置 KV）
- **Docker**：`docker compose up -d`（含 Redis）

## ✨ 功能特性

### 支持的协议
ShadowSocks • VMess • VLESS • Hysteria2 • Trojan • TUIC • AnyTLS

### 支持的客户端
Sing-Box • Clash/Mihomo • Xray/V2Ray • Surge

### 输入支持
- Base64 订阅
- HTTP/HTTPS 订阅链接
- 完整配置（Sing-Box JSON、Clash YAML、Surge INI）

### 核心能力
- 多源订阅聚合导入
- 短链接生成（固定/随机，KV 存储，可设有效期）
- 浅色/深色主题切换
- 灵活的 API，便于脚本自动化
- 多语言（中文、英文、波斯语、俄语）
- Web 界面，内置规则集与可自定义策略组

## 🔧 相对于原版的定制

### 🌐 Clash/Mihomo 配置加固
- **ECH/SVCB 防护**：禁用 qtype 64/65 查询，防止 Cloudflare 站点因 fake-ip + ECH 握手失败无法访问
- **延迟测试优化**：`unified-delay` + `tcp-concurrent`，延迟显示更准确
- **TUN 配置**：mips 协议栈、strict-route、防 DNS 泄露（dns-hijack 接管 53 端口）
- **配置持久化**：记住手动选择的节点与 fake-ip 缓存，重启不丢失
- **嗅探配置**：开启域名嗅探但关闭 `override-destination`，防止域名前置绕过规则
- **广告拦截**：默认 REJECT（原版默认 DIRECT），误杀时可手动切 DIRECT 放行
- **REALITY 抗量子**：自动为 REALITY 节点添加 `support-x25519mlkem768: true`，适配 bing 等站点的 PQ 握手要求
- **GeoData 瘦身**：规则全走 .mrs，关闭 `geodata-mode`，不再下载无用的 .dat/.mmdb
- **境外 DNS 去直连**：删除 `nameserver-policy` 里直连 1.1.1.1/8.8.8.8 的 DoH（国内基本不通，fake-ip 下也不需要真实解析）

### 📦 sing-box 配置优化
- **DNS**：DoH 服务器直接用 IP（Cloudflare 1.1.1.1、阿里 223.5.5.5），避免明文 bootstrap 泄露与额外往返；直连 DNS 显式走 DIRECT 出站，防 TUN 回环
- **fake-ip**：仅 IPv4 段（198.18.0.0/15），避开 IPv6 ULA 地址触发浏览器局域网权限弹窗
- **支付域名保护**：支付宝、银联、各大银行域名绕过 optimistic cache，防止缓存过期导致支付/登录失败
- **版本兼容**：针对 sing-box 1.11–1.15 各版本差异做适配（废弃字段清理、Duration 类型修正等）
- **规则集下载**：走 direct 出站，避免代理回环
- **死代码清理**：移除无 `clash_api` 时永远匹配不上的 `clash_mode` 规则

### 🔗 短链接增强
- **有效期选择**：生成短链接时可选 1小时 / 1天 / 7天 / 30天 / 永久，过期自动失效，适合分享防泄露
- 短链接按输出格式隔离存储（clash/singbox/surge 互不串扰）

### 🎨 界面与品牌
- 导航栏/页脚指向本仓库，页脚保留原作者来源标注
- 移除原版文档按钮（文档站为原作者维护）

### 🔒 安全
- 自定义规则的 site/ip 标识符做严格校验，防止 SSRF/URL 注入（CWE-918）

## 🤝 参与贡献

欢迎提交 Issue 和 Pull Request 改进本项目。

## 📄 开源协议

本项目基于 MIT 协议开源，详见 [LICENSE](LICENSE) 文件。

## ⚠️ 免责声明

本项目仅供学习交流使用，请勿用于非法用途。因使用本项目产生的一切后果由使用者自行承担，与开发者无关。

## ⭐ Star 历史

感谢每一位 star 本项目的朋友！🌟

<a href="https://star-history.com/#asdzx07/sublink&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=asdzx07/sublink&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=asdzx07/sublink&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=asdzx07/sublink&type=Date" />
 </picture>
</a>
