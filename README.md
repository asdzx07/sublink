<div align="center">
  <img src="public/favicon.png" alt="Sublink" width="120" height="120"/>

  <h1><b>Sublink</b></h1>
  <h5><i>One Worker, All Subscriptions · 高性能全能代理订阅转换与管理工具</i></h5>

  <p><b>轻量、现代化、高性能的代理协议订阅转换与聚合管理工具，支持部署于 Cloudflare Workers、Vercel、Node.js 及 Docker。</b></p>

  <p>
    <a href="https://github.com/asdzx07/sublink/actions"><img src="https://img.shields.io/badge/tests-308%20passed-brightgreen.svg" alt="Tests Passed"/></a>
    <a href="https://github.com/asdzx07/sublink/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License MIT"/></a>
    <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg" alt="Node Version"/></a>
    <a href="https://workers.cloudflare.com"><img src="https://img.shields.io/badge/Cloudflare-Workers-orange.svg" alt="Cloudflare Workers"/></a>
  </p>

  <p><i>💡 本项目 Fork 自优秀的开源项目 <a href="https://github.com/7Sageer/sublink-worker">7Sageer/sublink-worker</a>。在此基础上，重构了核心转换与去重引擎，加入了针对复杂网络环境的配置加固、坏节点沙箱容错、全链路网络超时控制以及一系列性能与体验增强。</i></p>

  <br>

  <p style="display: flex; justify-content: center; align-items: center; gap: 10px;">
    <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/asdzx07/sublink">
      <img src="https://deploy.workers.cloudflare.com/button" alt="部署到 Cloudflare Workers" style="height: 32px;"/>
    </a>
    <a href="https://vercel.com/new/clone?repository-url=https://github.com/asdzx07/sublink&env=KV_REST_API_URL,KV_REST_API_TOKEN&envDescription=Vercel%20KV%20credentials%20for%20data%20storage&envLink=https://vercel.com/docs/storage/vercel-kv">
      <img src="https://vercel.com/button" alt="部署到 Vercel" style="height: 32px;"/>
    </a>
  </p>

  <h3>📚 相关文档</h3>
  <p>
    <a href="https://sublink.works"><b>中文文档</b></a> ·
    <a href="https://sublink.works/en/"><b>English Docs</b></a> ·
    <a href="https://sublink.works/guide/quick-start/">快速上手</a> ·
    <a href="https://sublink.works/api/">API 参考</a> ·
    <a href="https://sublink.works/guide/faq/">常见问题</a>
  </p>
</div>

---

## ✨ 核心特性

### 🌐 全协议与输入格式支持
- **协议全覆盖**：Shadowsocks (含 SIP002/SIP003 插件)、VMess、VLESS (Reality/TLS)、Hysteria2 (含端口跳跃)、Trojan、TUIC、AnyTLS。
- **多输入格式自适应**：
  - 标准 Base64 编码订阅
  - 单条/多条原生协议节点 URI
  - HTTP / HTTPS 远程订阅链接
  - 完整客户端配置文件（Sing-Box JSON、Clash YAML、Surge INI）

### 📱 全目标客户端输出
- **Sing-Box**（完美兼容 1.11 ~ 1.15+ 最新特性，生成干净精简的 JSON 配置）
- **Clash / Mihomo**（支持标准 YAML 配置，默认启用高效 .mrs 规则集）
- **Surge**（标准 INI 配置生成）
- **Xray / V2Ray**（明文协议行与 Base64 订阅输出）
- **Subconverter API 兼容**（无缝平替原生 subconverter 后端）

### 🛠️ 灵活管理与聚合能力
- **多源订阅聚合**：支持将多个不同机场、不同格式的订阅链接一键聚合为一个订阅。
- **智能节点去重与重命名**：自动消歧重名节点，按内容特征精准去重。
- **国别智能分组**：按节点旗帜 Emoji / 国家地区名称自动归类策略组。
- **短链接管理**：支持自定义 / 随机短链生成，可配置过期时间（1小时 ~ 永久），各输出格式安全隔离。
- **自适应 Web 界面**：支持深色/浅色模式、多语言（中、英、波斯、俄）、直观的可视化配置面板。

---

## 🚀 相对于原版（7Sageer/sublink-worker）的重点改进

本项目在继承原版优雅设计的同时，针对大规模节点订阅、复杂网络环境以及长时间稳定运行，进行了**全方位的计算引擎重构与配置加固**：

### 1. ⚡ 核心转换引擎重构与极限性能提升
* **节点去重算法由 $O(N^2)$ 降至 $O(N)$**：
  * 原版针对数百上千个节点时采用暴力两两比对与全量 `JSON.stringify`，耗时成倍暴增。
  * 本项目引入 `WeakMap` 缓存与特征签名哈希索引，千级节点去重耗时从百毫秒/秒级暴降至**数毫秒级**。
* **正则匹配与国别识别预编译**：
  * 提取国家识别正则与别名映射表在模块加载期常驻单例，建立常数级别名哈希索引，彻底消除单个节点重复构造大正则的 CPU 浪费。
* **内存深拷贝削减 95%+**：
  * 在提取配置覆盖元数据时，采用属性解构先行排除占体积 95% 以上的巨型节点数组，彻底杜绝无意义的大对象递归深拷贝，极大降低内存占用。
* **Base64 编解码引擎加速**：
  * Node/Worker 运行时直通原生 `Buffer`；纯 JS 运行时使用 `Int8Array` 高速查表法与分块聚合，彻底消除逐字节不可变字符串累加引起的频繁垃圾回收（GC）停顿。
* **模块静态加载优化**：
  * 消除循环体内的动态 `await import(...)` 调度开销，重构为顶层静态模块引用，加速 URL 批量解析。

### 2. 🛡️ 生产级容错隔离与健壮性保障
* **坏节点沙箱隔离**：
  * 在解析入口与 VMess 协议反序列化处构建安全沙箱，对个别畸形、损坏的非法节点安全跳过并记录日志，**彻底终结了原版因单个坏节点导致整个订阅转换接口抛出 500 崩溃的顽疾**。
* **全链路网络超时防护**：
  * 为远程订阅抓取（15s）、KV 访问（10s）与外部直通请求全面接入 `AbortSignal` 超时控制，杜绝上游机场服务宕机或被墙时服务无休止挂起。
* **消除状态篡改隐患**：
  * 修复了原版 `customRules.reverse()` 会原地篡改外部入参数组的隐蔽副作用，保证函数无副作用与并发安全性。
* **全局基数规范**：
  * 全局补齐 `parseInt(..., 10)` 显式十进制基数，优化字符串前缀检测为原生 `startsWith`。

### 3. 🌐 Clash / Mihomo 配置深度加固
* **ECH / SVCB 握手防护**：禁用 qtype 64/65 查询，彻底解决 Cloudflare 站点在 fake-ip + ECH 下握手失败无法加载的问题。
* **延迟测试优化**：启用 `unified-delay` 与 `tcp-concurrent`，测速更准更快。
* **严苛 TUN 防泄漏**：严格路由规则、mips 协议栈、`dns-hijack` 强制接管 53 端口，杜绝 DNS 泄漏。
* **状态持久化**：本地缓存记住用户选中的节点与 fake-ip 记录，重启客户端不丢状态。
* **REALITY 抗量子前瞻**：自动为 REALITY 节点追加 `support-x25519mlkem768: true`，完美兼容现代后量子密码握手。
* **规则集精简瘦身**：全量迁移至高性能二进制 `.mrs` 规则，关闭 `geodata-mode`，不再拉取冗余的大体积 `.dat` 数据库。

### 4. 📦 Sing-Box 现代化配置调优
* **无明文泄漏的纯 IP DoH**：DNS 服务器采用直连 IP（1.1.1.1、223.5.5.5），省去明文 bootstrap 查询风险与额外 RTT，直连 DNS 显式绑定 DIRECT 防止 TUN 模式下产生回环。
* **局域网弹窗防护**：Fake-IP 仅限定在 IPv4 专有段（`198.18.0.0/15`），避开 IPv6 ULA 段导致现代浏览器频繁弹出“访问本地网络设备”权限提示。
* **支付与金融服务保护**：针对银联、支付宝及各大银行域名绕过 optimistic cache，防止缓存失效导致支付失败。
* **版本兼容与死代码剔除**：全盘适配 1.11 ~ 1.15 规范，移除废弃字段及无 `clash_api` 时永远无效的冗余规则。

### 5. 🔒 安全与短链增强
* **SSRF / 注入防御**：自定义规则集标识符引入安全字符白名单校验，严防路径穿越与 SSRF（CWE-918）。
* **多维度短链有效期**：支持自定义生成 1小时 / 1天 / 7天 / 30天 / 永久短链，过期自动失效，防止敏感节点泄露。

---

## 🏃 快速开始

### 方式一：一键云端部署（推荐）
- **Cloudflare Workers**：点击上方“Deploy with Workers”按钮，登录 Cloudflare 即可秒级完成全球边缘部署。
- **Vercel**：点击上方“Deploy with Vercel”按钮，按提示绑定免费的 Upstash KV 即可。

### 方式二：Docker 容器化部署
使用 Docker Compose 可以一键部署包含独立 Redis 存储的 Sublink 实例：

```bash
# 启动服务
docker compose up -d

# 默认访问地址：http://localhost:3000
```

### 方式三：Node.js 独立运行
```bash
# 克隆仓库
git clone https://github.com/asdzx07/sublink.git
cd sublink

# 安装依赖
npm install

# 运行自动化测试
npm test

# 构建并启动服务
npm run build:node
node dist/node-server.cjs
```

---

## 🤝 鸣谢与声明

- 本项目基于开源项目 [7Sageer/sublink-worker](https://github.com/7Sageer/sublink-worker) 深入开发，感谢原作者及社区贡献者的杰出工作！
- 规则集资源感谢 [MetaCubeX/meta-rules-dat](https://github.com/MetaCubeX/meta-rules-dat) 提供的优质规则源。

## 📄 开源协议

本项目遵循 [MIT License](LICENSE) 开源协议。

## ⚠️ 免责声明

本项目仅供网络技术学习、科研与管理个人合法订阅配置之用，请勿用于任何非法用途。作者不对使用者因使用本项目所产生的任何行为或损失承担法律责任。

## ⭐ Star 历史

感谢每一位 star 本项目的朋友！🌟

<a href="https://star-history.com/#asdzx07/sublink&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=asdzx07/sublink&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=asdzx07/sublink&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=asdzx07/sublink&type=Date" />
 </picture>
</a>

