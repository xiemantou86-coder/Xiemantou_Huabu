# 🎨 Xiemantou_Huabu · 无限画布（谢馒头定制增强版）

> 面向 **游戏买量投放（KV / 大弹窗 / 异形弹窗）**、**多语言本地化批量改图** 与 **AI 全能视觉创作** 的工业级节点式画布工作台。
>
> 📌 **开源致谢与说明**：本项目基于 [@hero8152/Infinite-Canvas](https://github.com/hero8152/Infinite-Canvas) 进行深度二次开发与工作流重构，遵循原项目开源精神与非商用规范。

---

## 🚀 谢馒头定制版 · 八大深度改造与原创模块

相较于上游基础版本，本仓库针对真实的商业游戏美术投放、多语种高频改图与日常多模态交互场景，重点自研并重构了以下 **8 大核心系统**：

### 1. 🎯 游戏买量广告 KV 工业级流水线（核心原创）
- **三级 KV 提示词继承链（`kvInheritance`）**：独创 `gameKvPrompt`（主 KV）→ `gameKvPopupPrompt`（大弹窗：支持左文右图 / 左图右文构图）→ `irregularPopupKvPrompt`（异形弹窗：支持突破边框 / 透明背景 / 绿色限制安全区控制）级联继承体系。
- **KV 参考图库节点（`kvReferenceGallery`）自持与总控接管**：
  - 支持图片**拖拽 / 点击直存图框**（即拖即换，不产生冗余上传节点）与缩略图右上角 `×` 一键清除；
  - 顶部绿点（`galleryOut`）输出整库参考职责绑定，单图框右侧蓝点（`gallerySlotOut`）支持单张参考图独立拆出喂给任意生成器；
  - **三槽位反向接管 KV**：当图库开启 Logo / 下载按钮 / 字体样式槽位时，自动锁定下游 KV 节点对应表单（灰显标记「由图库控制」），并在编译阶段原位重写提示词规则。
- **主控 API 节点（`masterGenerator`）串并联级联**：支持一对多主控广播，新增「串联模式（等上游出图完成后再触发下游）」开关，自由编排并发或先后接力生成。

### 2. 🌍 改图 / 多语言翻译矩阵节点（`translationInput / Output`）
- **7 语种 × 多尺寸矩阵自动裂变**：支持繁中、韩、泰、俄、越、印尼、英等多语言广告文案一键批量本地化，新增「自动识别源语言（适用于多图混合修改）」与 `9:21` 超竖屏等全比例选项。
- **8 并发队列与防死锁机制**：下游输出节点对齐 Output 多列比例格子追加排列，支持 2 秒冷却循环重跑、排队节点手动摘队独立触发及 300s 轮询超时兜底保护。

### 3. 🤖 Omni 全能流式对话生图模式（GPT Chat Agent）
- **SSE 流式伴聊 + 气泡内计时进度卡**：日常对话秒级流式响应；触发绘图/改图意图时，先流式输出自然陪伴回复，气泡下层实时挂载毛玻璃呼吸计时框（`.omni-img-loader`），出图后原地合体展开。
- **跨平台大脑与画笔混搭 + `#1 / #2` 跨图回溯**：对话路由模型（LLM）与生图模型（Image API）完全解耦，支持跨中转站自由组合；支持在多轮对话中直接用口语指定“回到第 1 张原图修改”（防止多轮叠改画质衰减），每张生成图均带 `#N` 序号徽章与「🎨 基于 #N 改图」一键挂载按钮。
- **视觉真图直喂 + 口语自动换比例 / 4K / 真透明 PNG**：自动将上传参考图与历史生成图转为视觉流喂给多模态路由器，并配备 `vision → text_only` 双层防降级重试；对话中直接说“9:16”、“4K超高清”或“透明底 / 阿尔法通道 / 免抠 PNG”，自动触发底层尺寸映射与 4 通道 RGBA 真透明输出。

### 4. 🖌️ 图片浏览 AI 侧栏精修工作台（Image Editor AI Sidebar）
- **画布内双击即改**：在图片预览/编辑弹窗右侧内嵌 350px 专属 AI 精修侧栏，支持画笔涂鸦与文字标签隐式压合垫图、涂抹遮罩局部重绘（Inpaint）、裁剪区高精提取。
- **完整参数矩阵与独立记忆**：涵盖 11 档比例（含适配当前图比例与自定义）、6 档画质（自动/低/中/高/超高`xhigh`/极高`max`）、官方保真度（`input_fidelity: high/low`）、透明背景 PNG 三态门禁及右侧红绿状态反馈卡；每张图片节点独立记忆专属修图 Prompt，全局模型偏好跨会话自动保留。

### 5. 🦋 Rust + Tauri 异形透明桌面启动器（`画布-启动.exe`）
- **DWM 真透明异形窗口 + 矢量叶形书签**：基于 `tao + wry` 原生构建（体积仅 ~1.2MB），支持浅色手绘 / 暗夜极客双主题、系统托盘常驻、单实例唤醒、端口占用检测与强制关停、8 大核心 Python 依赖一键自检安装、存储目录（`storage_settings.json`）动态识别。
- **版本分离与双源差分热更新（`VERSION` + `LAUNCHER_VERSION`）**：打通 **ModelScope（魔搭国内高速直连）+ GitHub** 双源容灾更新，内置 `--apply-update` 独立进程自我替换内核（含 PE 头校验与失败回滚）及 `.new` 延迟替换自愈机制。
- **双端 API 配置实时同步**：启动器本地直读合并（`merge_providers`）+ 后端 `API/.env` 原子重试写入 + 网页端 10s 指纹轮询，彻底解决启动器与网页端同时改配置互相覆盖的痛点。

### 6. 🧩 画布编辑体验与视觉细节全方位打磨
- **Ctrl+M 容器分组增强**：新增「容器锁定开关」（冻结容器内成员节点不被其他容器误吸抢占，同时拒收外部误拖入节点），全面采用 `color-mix()` 动态主题色派生与深浅色高对比度边框。
- **标签节点（Label）五项重构**：字号上限由 96px 解锁至 400px（Scale 达 20）、Flex 垂直居中、打字固定字号不缩小、文本溢出自动增高、双击缩放柄复位自适应。
- **主画布对称撤销/重做栈**：补齐主画布 `Ctrl+Z` 撤销与 `Ctrl+Shift+Z` 重做（`performRedo` 对偶栈）及 **12 帧拟真漫游新手引导教程（小猫演示视口特写自动对焦）**。

### 7. 🔌 多中转网关深度兼容与专家解耦模式
- 原生深度适配 OpenAI 标准协议、APIMart 协议、畅指（三档推荐尺寸智能吸附 + 比例提示词注入）、ZhenZhen 异步协议（单数端点 + 自动 `/v1/files/upload` 换公网直链）、Sub2API 异步任务网关（`/images/generations/async` + `/images/tasks/{id}`）、Grok Imagine（14 项全宽高比 + 公网图床自动桥接）。
- API 设置面板内置 **「高级专家模式 + AI 结构化提取提示词」**，用户粘贴任意第三方 API 文档即可让 LLM 自动提取端点填空，零代码接入非标生图接口。

### 8. 🛠️ 上游生态完整保留（ComfyUI / RunningHub / 即梦 / 多媒体工具）
- 完整保留并兼容本地及局域网 **ComfyUI** 工作流调用、**RunningHub** 工作流与 AI 应用、**ModelScope** 免费模型、**火山引擎**、**即梦 CLI**、360° 全景图预览截图、多角度相机控制、视频帧抽取、循环节点及 Chrome / PS 采集插件。

---

## ⚡ 快速开始 (Quick Start)

1. **一键启动（推荐 Windows 用户）**：
   双击项目根目录下的 **`画布-启动.exe`**（或运行 `run.bat`），在启动器面板中点击「启动服务」即可自动拉起后端并打开工作台。
2. **环境与更新说明**：
   - 若通过 `git clone` 或 `Download ZIP` 首次获取代码，请确保将便携 `python` 环境解压至项目根目录（或在系统 PATH 中配置 Python 3.10+），可在启动器中点击「一键安装依赖」。
   - 项目内置 `VERSION`（画布版本）与 `LAUNCHER_VERSION`（启动器版本），可在启动器或网页顶栏一键检查并拉取最新差分更新。

---

## 📜 开源协议与声明 (License & Credits)

- **原作者与上游仓库 (Upstream Author)**: [hero8152/Infinite-Canvas](https://github.com/hero8152/Infinite-Canvas)
- **定制增强与维护 (Customized & Maintained by)**: [xiemantou86-coder (谢馒头)](https://github.com/xiemantou86-coder)
- **使用规范**：
  * 本软件仅供个人学习、作品集展示与公司内部提效使用，**严禁用于任何形式的修改封装成商业产品售卖**（商用须取得原作者授权）。
  * 基于本代码二次开发的软件必须保持开源，并明确注明原作者及本分支来源。
  * This software is for personal and internal company use only, and is prohibited from being modified or packaged into commercial products in any way. Software developed based on this code must remain open source and credit the original author.

---

## 🖼️ 工作台画面预览 (Screenshots)

<img width="2079" height="665" alt="image" src="https://github.com/user-attachments/assets/8469923b-f7a2-403c-9c37-e6e789211f28" />

<img width="1865" height="1503" alt="image" src="https://github.com/user-attachments/assets/f4030201-67c6-4845-b08b-b6fdf304afaa" />

<img width="1696" height="1350" alt="b68e144c5b04a322bfd035da4d89aba3" src="https://github.com/user-attachments/assets/0a6090fb-a8dd-4c3d-adee-bb1f9233a2d91" />

<img width="1525" height="1473" alt="image" src="https://github.com/user-attachments/assets/6f61fcf9-746c-425b-9e36-cfc8d252da7c" />

<img width="1261" height="864" alt="image" src="https://github.com/user-attachments/assets/57f3e230-3134-488f-8179-d97e7d15383a" />

<img width="1530" height="858" alt="image" src="https://github.com/user-attachments/assets/9990e42d-22d5-4a10-a1e1-ad35a634edd2" />

<img width="1735" height="1400" alt="image" src="https://github.com/user-attachments/assets/d8328ff8-bbe0-4f1c-9ffa-7b56e8a1a51d" />

<img width="2258" height="969" alt="image" src="https://github.com/user-attachments/assets/4a752d99-885d-4ba9-8b86-91b495786b5c" />

<img width="1531" height="1374" alt="image" src="https://github.com/user-attachments/assets/0af79e38-0955-4740-9e65-5c9bb057f58c" />

<img width="2196" height="1040" alt="image" src="https://github.com/user-attachments/assets/6d823668-cde2-4836-8332-1858efe5f520" />

<img width="2214" height="771" alt="image" src="https://github.com/user-attachments/assets/52e10958-753f-45ba-a50e-3bbec27be436" />