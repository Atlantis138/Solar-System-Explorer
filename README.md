# 太阳系探索者 (Solar System Explorer V8.0)

这是一个基于 React 19、TypeScript 和 D3.js 构建的交互式 2D/2.5D 太阳系模拟应用。它结合了精确的天文算法（Astronomy Engine）与 Google Gemini AI，旨在提供既科学严谨又具有视觉吸引力的天文探索体验。

## 🌟 项目简介

该项目并非单纯的静态展示，而是一个实时轨道物理模拟器。它支持：
*   **双重渲染模式**：示意图模式（Schematic，易于观察）与真实比例模式（True Scale，感受宇宙的浩渺）。
*   **AI 增强**：集成 Google Gemini API，提供关于天体的实时问答和搜索接地（Grounding）。
*   **天象搜寻**：能够计算并预测行星连珠、凌日等罕见天象。
*   **虚拟漫游**：支持全方位视角的相机控制（偏航/俯仰）和类似 3D 的透视效果。

## 📂 项目结构

项目采用了模块化架构，核心逻辑与 UI 组件分离：

```
root/
├── components/          # UI 组件
│   ├── renderers/       # 核心渲染器 (Schematic/TrueScale)
│   ├── SolarSystem.tsx  # 主画布容器
│   ├── StarField.tsx    # 星空与银河背景绘制
│   ├── Controls.tsx     # 时间与播放控制
│   ├── SettingsPanel.tsx# 设置面板
│   └── ...
├── core/                # 核心数学引擎
│   ├── projection.ts    # 3D 到 2D 的正交/透视投影逻辑
│   └── renderConfig.ts  # 渲染配置与视距剔除逻辑
├── data/                # 数据定义
│   ├── constants.ts     # 物理常数
│   └── ...
├── public/data/         # 外部配置文件
│   └── solar_system.txt # 自定义天体数据文件
├── utils/               # 工具函数
│   ├── astronomy.ts     # 天文算法与轨道计算
│   └── DataLoader.ts    # 数据文件解析器
├── hooks/               # 自定义 React Hooks
│   └── useSimulation.ts # 模拟循环与时间管理
└── App.tsx              # 应用入口与状态管理
```

## 💾 数据存储架构

本项目已将天体数据从代码中解耦，采用自定义的 **Block-based 文本格式** 存储。

### 数据文件位置
`public/data/solar_system.txt`

### 数据格式规范
数据采用易于阅读和手动编辑的键值对格式。解析器位于 `utils/DataLoader.ts`。

*   **区块标识**：使用 `[TYPE]` 定义新对象（如 `[PLANET]`, `[SATELLITE]`, `[RING]`）。
*   **层级关系**：通过 `parent: id` 属性自动构建父子层级（如卫星归属于行星）。
*   **轨道要素**：使用 J2000 标准的开普勒轨道六要素 (`a e i N w M`)。

**示例：**
```text
[PLANET]
id: earth
name: 地球
elements: 1.000 0.016 0.000 -11.26 102.94 357.51

[SATELLITE]
parent: earth
id: moon
elements: 0.002 0.054 5.145 125.08 318.15 115.37
```

这种设计使得无需重新编译代码即可添加新的小行星、彗星或调整现有天体参数。

## 🧊 3D 效果实现原理

虽然本项目使用 HTML5 Canvas/SVG (2D API) 进行渲染，但它通过数学投影实现了完整的 3D 空间模拟。核心逻辑位于 `core/projection.ts`。

### 1. 坐标系定义
*   **世界坐标 (World Space)**：使用日心笛卡尔坐标系 ($x, y, z$)，单位为天文单位 (AU)。
*   **坐标手性**：修正后的右手坐标系，+Z 指向屏幕外（或深度），+Y 指向“北方/上方”。

### 2. 旋转矩阵 (Rotation)
相机并不真正移动，而是通过旋转世界坐标来模拟视角变化：
1.  **Yaw (偏航)**：绕 Z 轴旋转，模拟水平旋转。
2.  **Tilt (俯仰)**：绕 X 轴旋转，模拟从“北极俯视 (+90°)”过渡到“黄道面侧视 (0°)”再到“南极仰视 (-90°)”。

### 3. 投影算法 (Projection)
将 3D 坐标转换 2D 屏幕坐标：
*   **正交投影 (Orthographic)**：基础投影，无透视变形。
    *   $x_{screen} = x_{rotated} \times scale$
    *   $y_{screen} = -(y_{rotated} \times \sin(Tilt) + z_{rotated} \times \cos(Tilt)) \times scale$
    *   *注意：这里做了 Y 轴翻转处理，以适配 Canvas 坐标系 (+Y 向下) 与天文坐标系 (+Y 向上) 的差异。*

*   **透视模拟 (Perspective Simulation)**：
    当开启 `enablePerspective` 时，引入深度因子 $w$。
    *   $scaleFactor = \frac{CameraDistance}{CameraDistance - Depth}$
    *   该系数用于缩放物体大小和轨道线宽，从而产生“近大远小”的视觉深度感。

### 4. 深度排序 (Z-Sorting)
为了正确处理遮挡关系（如行星遮挡轨道，或太阳遮挡行星），渲染器计算每个对象的 `depth` 值，并使用画家算法（Painter's Algorithm），按照深度从远到近的顺序绘制 SVG/Canvas 元素。

## 🛠️ 技术栈

*   **React 19**: UI 构建与状态管理。
*   **TypeScript**: 类型安全与代码健壮性。
*   **Tailwind CSS**: 现代化样式设计。
*   **D3.js**: 处理缩放 (Zoom/Pan) 交互。
*   **Astronomy Engine**: 提供高精度的星历计算支持。
*   **Google GenAI SDK**: AI 智能交互。

---
*Created by Senior Frontend Engineer*
