# 宝宝纸本助手（Baby Paper Hybrid）

纸质喂养本 + 家长数字化助手。保姆只填打印日表；家长用手机快记、拍本入库、看时间轴、存照片、导出 CSV/PDF。

## 快速开始

```bash
npm install
cp .env.example .env   # 如尚未创建
npm run db:push -w server
npm run db:seed -w server
npm run dev:server     # http://localhost:8787
npm run dev:web        # http://localhost:5173
```

浏览器打开 `http://localhost:5173`。

## 纸表打印

打开后浏览器打印 / 另存 PDF：

- [templates/print/daily-log-a4.html](templates/print/daily-log-a4.html)
- [templates/print/daily-log-b5.html](templates/print/daily-log-b5.html)
- [templates/print/nanny-guide.html](templates/print/nanny-guide.html)

也可在应用「拍本 / 导出」页直接打开模板链接。

## 功能

| 模块 | 说明 |
| --- | --- |
| 今日 | 喂养/尿布/睡眠汇总与时间轴 |
| 快记 | 父母快捷补记喂养、尿布、睡眠、成长、备注 |
| 拍本 | 拍照或粘贴文本 → OCR/解析草稿 → 核对入库 |
| 相册 | 按月上传成长照片 |
| 导出 | 日/周 PDF、CSV，纸表模板入口 |

## OCR 说明

默认 `OCR_PROVIDER=mock`：无云密钥时可用「粘贴转写文本」解析；仅上传图片会生成**示例草稿**供核对流程演示。

若有云 OCR HTTP 接口，设置：

```env
OCR_PROVIDER=http
OCR_API_ENDPOINT=https://your-ocr.example/v1/ocr
OCR_API_KEY=...
```

接口需返回 JSON：`{ "text": "..." }`。

## Docker

```bash
docker compose up -d --build
```

服务监听 `http://localhost:8787`（同时提供 API 与前端静态资源）。

## 技术栈

- 前端：Vue 3 + Vite PWA
- 后端：Hono + Prisma + SQLite
- 导出：CSV / PDFKit

## 许可与定位

家庭自用 MVP；后续可包装为「实物记录本 + 数字化订阅」。不提供医疗建议。
