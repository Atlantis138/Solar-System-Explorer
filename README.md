# 太阳系探索者 (Solar System Explorer V9.0)

这是一个基于 React 19、TypeScript 和 D3.js 构建的交互式 2D/2.5D 太阳系模拟应用。它结合了精确的天文算法（Astronomy Engine）与 Google Gemini AI，旨在提供既科学严谨又具有视觉吸引力的天文探索体验。

## 🌟 项目简介

该项目并非单纯的静态展示，而是一个实时轨道物理模拟器。它支持：
*   **双重渲染模式**：示意图模式（Schematic，易于观察）与真实比例模式（True Scale，感受宇宙的浩渺）。
*   **AI 增强**：集成 Google Gemini API，提供关于天体的实时问答和搜索接地（Grounding）。
*   **天象搜寻**：能够计算并预测行星连珠、凌日等罕见天象。
*   **虚拟漫游**：支持全方位视角的相机控制（偏航/俯仰）和类似 3D 的透视效果。
*   **自定义天体**：允许用户通过 UI 添加自定义的行星、卫星或小天体。

## 📂 项目结构

项目采用了模块化架构，核心逻辑与 UI 组件分离：

```
root/
├── components/          # UI 组件
│   ├── renderers/       # 核心渲染器 (Schematic/TrueScale)
│   ├── SolarSystem.tsx  # 主画布容器
│   ├── StarField.tsx    # 星空与银河背景绘制
│   ├── ObjectManager.tsx# 天体对象管理器 (新增)
│   └── ...
├── core/                # 核心数学引擎
│   ├── projection.ts    # 3D 到 2D 的正交/透视投影逻辑
│   └── renderConfig.ts  # 渲染配置与视距剔除逻辑
├── data/                # 数据定义
├── public/data/         # 外部配置文件
│   ├── solar_system.txt # 默认天体数据
│   └── real_stars.json  # 真实恒星数据
├── utils/               # 工具函数
│   ├── astronomy.ts     # 天文算法与轨道计算
│   └── DataLoader.ts    # 数据加载与合并
└── App.tsx              # 应用入口
```

## 💾 数据架构与自定义天体

本项目采用灵活的数据加载机制，支持“官方数据”与“用户数据”的运行时合并。

### 1. 数据来源
*   **静态文件**：`public/data/solar_system.txt` 包含系统默认的行星定义。
*   **真实恒星**：`public/data/real_stars.json` 包含视星等较亮的真实恒星数据（RA/Dec）。
*   **用户存储**：浏览器 `LocalStorage` (`custom_bodies_text`) 存储用户添加的自定义天体。

### 2. 格式规范
所有天体（无论是默认还是自定义）均采用统一的 **Block-based 文本格式**。
解析器位于 `utils/DataLoader.ts`。

**格式示例：**
```text
[PLANET]
id: my_planet
name: 自定义行星
englishName: My Planet
color: #00ff00
radius: 5
relativeRadius: 1.0
elements: 1.52 0.09 1.85 49.5 286.5 19.4
# elements顺序: a e i N w M
```

### 3. 对象管理器 (Object Manager)
用户可以通过设置面板打开“对象列表”。该管理器 (`ObjectManager.tsx`) 允许：
*   查看所有已加载天体的状态（是否解析成功）。
*   **添加自定义天体**：提供模板编辑器，支持行星、矮行星、彗星、卫星和光环的快速定义。
*   **持久化**：保存的数据会写入 LocalStorage，刷新页面后依然存在。

## 🧊 3D 投影与天球背景

本项目在 2D Canvas 上实现了伪 3D 投影引擎 (`core/projection.ts`)。

### 1. 坐标系旋转
相机位置固定，通过旋转整个世界坐标系来模拟视角变化：
*   **Yaw (偏航)**：绕 Z 轴旋转 (0° - 360°)。
*   **Tilt (俯仰)**：绕 X 轴旋转 (-90° 至 +90°)。
    *   +90°: 北极俯视 (Top-down)
    *   0°: 黄道面侧视
    *   -90°: 南极仰视

### 2. 天球背景 (Celestial Sphere)
背景星空 (`StarField.tsx`) 并非静态图片，而是实时计算的 3D 点集：
*   **数据源**：赤经 (RA) 和赤纬 (Dec) 数据。
*   **转换**：
    1.  将 RA/Dec 转换为单位球上的笛卡尔坐标 $(x, y, z)$。
    2.  应用与太阳系天体相同的旋转矩阵 (Yaw & Tilt)。
    3.  投影到屏幕空间。
这确保了当用户旋转相机查看行星轨道时，背景星空会以正确的角速度同步旋转，提供沉浸式的空间感。

## ⚙️ 渲染压力与性能配置

为了兼容不同性能的设备，项目引入了分级渲染策略 (`core/renderConfig.ts`)。

### 渲染质量等级 (Render Quality)
用户可在设置中针对不同区域（内太阳系、外太阳系、小天体）独立设置质量：

1.  **节能 (Eco)**：
    *   激进的视距剔除 (Culling)。
    *   当缩放比例 (Zoom Level) 低于阈值时，天体直接隐藏（opacity = 0）。
    *   适合移动端或性能较低的设备。

2.  **通用 (Standard)**：
    *   使用平滑阶梯函数 (`smoothStep`) 计算透明度。
    *   天体在临界视距处会呈现淡入/淡出效果，视觉体验更佳。

3.  **性能 (Performance)**：
    *   禁用视距剔除，始终渲染所有可见对象（除非被遮挡）。
    *   适合桌面端，提供最完整的信息展示。

### 视距逻辑
系统根据当前的缩放系数 $k$ (Scale Factor) 动态计算每个天体的可见性。例如，在示意图模式下，如果不缩放，柯伊伯带天体默认是不可见的，只有当用户缩放至外太阳系尺度时，它们才会根据设置的策略显现出来。

## 🛠️ 技术栈

*   **React 19**: UI 构建与状态管理。
*   **TypeScript**: 类型安全与代码健壮性。
*   **D3.js**: 处理缩放 (Zoom/Pan) 交互。
*   **Astronomy Engine**: 提供高精度的星历计算支持。
*   **Google GenAI SDK**: AI 智能交互。

---
*Created by Atlantis*