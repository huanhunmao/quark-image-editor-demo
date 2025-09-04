# Quark Image Editor Demo (MVP)

**最小可行图片编辑器**，展示 Canvas 渲染、滤镜、裁剪、旋转、缩放、撤销/重做与导出等核心能力。

> 纯前端实现，无后端依赖，适合部署到 Vercel / Netlify。

## ✨ 功能
- 上传图片（拖拽/选择文件）
- 裁剪（框选区域 → 应用裁剪）
- 旋转（±90°）、缩放
- 滤镜：亮度 / 模糊 / 灰度（使用 `CanvasRenderingContext2D.filter`）
- 撤销 / 重做（快照栈）
- 导出 PNG / JPG

## 🧱 技术栈
- React 18 + Vite
- Canvas 2D + `ctx.filter`
- 自实现 History 栈（撤销/重做）
- 无后端依赖

## 🛠️ 开发
```bash
pnpm i   # 或 npm i / yarn
pnpm dev # 本地运行
```

## 📦 构建
```bash
pnpm build
pnpm preview
```

## 🧪 可继续扩展
- 多图层（贴纸 / 文本）
- 矩形/椭圆/路径绘制
- 更强滤镜（曲线、色阶、HSL）
- 智能抠图（前端推理：如 onnxruntime-web + 模型）
- 快捷键体系、历史快照缩略图
- Web Worker：在滤镜较重时避免阻塞 UIs

## 📄 许可
MIT
