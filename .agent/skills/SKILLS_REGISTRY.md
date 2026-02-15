# Skills Registry - 技能查询总表

本文档提供所有可用 skills 的快速查询索引。

## 📊 统计概览

| 类别 | 数量 | 来源 |
|------|------|------|
| **本地自定义 Skills** | 2 | punkrecord 项目 |
| **Anthropic Skills** | 16 | [anthropics/skills](https://github.com/anthropics/skills) |
| **UI/UX Pro Max** | 1 | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) |
| **总计** | 19 | - |

---

## 🏠 本地自定义 Skills

这些是专门为 punkrecord 项目创建的 skills。

### 1. Database Migration
- **路径**: [database-migration/SKILL.md](file:///f:/workspace/punkrecord/.agent/skills/database-migration/SKILL.md)
- **描述**: 数据库迁移和初始化的标准流程,支持 Windows (conda) 和 macOS (pyenv) 环境
- **适用场景**: 
  - 数据库初始化
  - 创建和应用迁移
  - 回滚操作
  - 数据库故障排除
- **环境支持**:
  - Windows: conda 环境 (`conda activate punkrecord`)
  - macOS: pyenv 环境 (`pyenv activate punkrecord`)

### 2. Python Environment Management
- **路径**: [python-env/SKILL.md](file:///f:/workspace/punkrecord/.agent/skills/python-env/SKILL.md)
- **描述**: Python 环境管理和包安装规范,根据操作系统自动使用正确的虚拟环境
- **适用场景**:
  - 激活 Python 虚拟环境
  - 安装 Python 依赖
  - 运行 Python 脚本
  - 环境故障排除
- **环境支持**:
  - Windows: conda 环境 (`conda activate punkrecord`)
  - macOS: pyenv 环境 (`pyenv activate punkrecord`)

---

## 🎨 Anthropic Skills

来自 Anthropic 官方的 skills 集合,涵盖创意设计、开发技术、企业沟通和文档处理。

### Creative & Design

#### 3. Algorithmic Art
- **路径**: [anthropic-skills/skills/algorithmic-art/SKILL.md](file:///f:/workspace/punkrecord/.agent/skills/anthropic-skills/skills/algorithmic-art/SKILL.md)
- **描述**: 使用算法生成艺术作品
- **适用场景**: 生成式艺术、数据可视化、创意编程

#### 4. Canvas Design
- **路径**: [anthropic-skills/skills/canvas-design/SKILL.md](file:///f:/workspace/punkrecord/.agent/skills/anthropic-skills/skills/canvas-design/SKILL.md)
- **描述**: Canvas 设计和绘图
- **适用场景**: 图形设计、UI 原型、可视化

#### 5. Frontend Design
- **路径**: [anthropic-skills/skills/frontend-design/SKILL.md](file:///f:/workspace/punkrecord/.agent/skills/anthropic-skills/skills/frontend-design/SKILL.md)
- **描述**: 前端设计最佳实践
- **适用场景**: UI/UX 设计、前端开发

#### 6. Theme Factory
- **路径**: [anthropic-skills/skills/theme-factory/SKILL.md](file:///f:/workspace/punkrecord/.agent/skills/anthropic-skills/skills/theme-factory/SKILL.md)
- **描述**: 主题和样式系统生成
- **适用场景**: 设计系统、主题定制

### Development & Technical

#### 7. MCP Builder
- **路径**: [anthropic-skills/skills/mcp-builder/SKILL.md](file:///f:/workspace/punkrecord/.agent/skills/anthropic-skills/skills/mcp-builder/SKILL.md)
- **描述**: MCP (Model Context Protocol) 服务器构建
- **适用场景**: 构建 MCP 服务器、集成外部工具

#### 8. Skill Creator
- **路径**: [anthropic-skills/skills/skill-creator/SKILL.md](file:///f:/workspace/punkrecord/.agent/skills/anthropic-skills/skills/skill-creator/SKILL.md)
- **描述**: 创建新的 skills
- **适用场景**: 扩展 AI 能力、自定义工作流

#### 9. Web Artifacts Builder
- **路径**: [anthropic-skills/skills/web-artifacts-builder/SKILL.md](file:///f:/workspace/punkrecord/.agent/skills/anthropic-skills/skills/web-artifacts-builder/SKILL.md)
- **描述**: 构建 Web 应用和组件
- **适用场景**: 快速原型、Web 应用开发

#### 10. Webapp Testing
- **路径**: [anthropic-skills/skills/webapp-testing/SKILL.md](file:///f:/workspace/punkrecord/.agent/skills/anthropic-skills/skills/webapp-testing/SKILL.md)
- **描述**: Web 应用测试
- **适用场景**: 自动化测试、质量保证

### Enterprise & Communication

#### 11. Brand Guidelines
- **路径**: [anthropic-skills/skills/brand-guidelines/SKILL.md](file:///f:/workspace/punkrecord/.agent/skills/anthropic-skills/skills/brand-guidelines/SKILL.md)
- **描述**: 品牌指南创建和维护
- **适用场景**: 品牌一致性、企业标准

#### 12. Internal Comms
- **路径**: [anthropic-skills/skills/internal-comms/SKILL.md](file:///f:/workspace/punkrecord/.agent/skills/anthropic-skills/skills/internal-comms/SKILL.md)
- **描述**: 内部沟通文档
- **适用场景**: 团队沟通、公告、备忘录

#### 13. Slack GIF Creator
- **路径**: [anthropic-skills/skills/slack-gif-creator/SKILL.md](file:///f:/workspace/punkrecord/.agent/skills/anthropic-skills/skills/slack-gif-creator/SKILL.md)
- **描述**: 为 Slack 创建 GIF
- **适用场景**: 团队沟通、趣味内容

### Document Skills

这些是 Claude 文档功能背后的 skills(源码可用,非开源)。

#### 14. DOCX
- **路径**: [anthropic-skills/skills/docx/SKILL.md](file:///f:/workspace/punkrecord/.agent/skills/anthropic-skills/skills/docx/SKILL.md)
- **描述**: Word 文档创建和编辑
- **适用场景**: 报告、文档、合同

#### 15. PDF
- **路径**: [anthropic-skills/skills/pdf/SKILL.md](file:///f:/workspace/punkrecord/.agent/skills/anthropic-skills/skills/pdf/SKILL.md)
- **描述**: PDF 文档处理
- **适用场景**: PDF 生成、表单提取、文档转换

#### 16. PPTX
- **路径**: [anthropic-skills/skills/pptx/SKILL.md](file:///f:/workspace/punkrecord/.agent/skills/anthropic-skills/skills/pptx/SKILL.md)
- **描述**: PowerPoint 演示文稿创建
- **适用场景**: 演示文稿、幻灯片设计

#### 17. XLSX
- **路径**: [anthropic-skills/skills/xlsx/SKILL.md](file:///f:/workspace/punkrecord/.agent/skills/anthropic-skills/skills/xlsx/SKILL.md)
- **描述**: Excel 电子表格处理
- **适用场景**: 数据分析、报表、财务表格

#### 18. Doc Coauthoring
- **路径**: [anthropic-skills/skills/doc-coauthoring/SKILL.md](file:///f:/workspace/punkrecord/.agent/skills/anthropic-skills/skills/doc-coauthoring/SKILL.md)
- **描述**: 文档协作编辑
- **适用场景**: 团队协作、文档审阅

---

## 🎯 UI/UX Pro Max Skill

专业的 UI/UX 设计智能系统,提供全面的设计指导。

### 19. UI/UX Pro Max
- **路径**: [ui-ux-pro-max/src/](file:///f:/workspace/punkrecord/.agent/skills/ui-ux-pro-max/src/)
- **README**: [ui-ux-pro-max/README.md](file:///f:/workspace/punkrecord/.agent/skills/ui-ux-pro-max/README.md)
- **描述**: AI 驱动的设计智能系统,提供 UI/UX 设计的全方位支持
- **核心功能**:
  - **100 条行业特定推理规则** - 针对不同行业的设计决策
  - **67 种 UI 风格** - Glassmorphism、Minimalism、Brutalism 等
  - **96 个调色板** - 行业特定的配色方案
  - **57 种字体配对** - 精选的字体组合
  - **25 种图表类型** - 数据可视化推荐
  - **13 种技术栈支持** - React、Next.js、Vue、SwiftUI、Flutter 等
  - **设计系统生成器** - 自动生成完整的设计系统

- **适用场景**:
  - 构建落地页
  - 创建仪表板
  - 设计移动应用 UI
  - 生成设计系统
  - UI/UX 审查和改进

- **使用方法**:
  ```bash
  # 生成设计系统
  python3 .agent/skills/ui-ux-pro-max/scripts/search.py "beauty spa" --design-system -p "Serenity Spa"
  
  # 搜索特定领域
  python3 .agent/skills/ui-ux-pro-max/scripts/search.py "glassmorphism" --domain style
  python3 .agent/skills/ui-ux-pro-max/scripts/search.py "elegant serif" --domain typography
  
  # 技术栈特定指南
  python3 .agent/skills/ui-ux-pro-max/scripts/search.py "form validation" --stack react
  ```

- **支持的技术栈**:
  - Web: HTML+Tailwind, React, Next.js, Vue, Nuxt.js, Svelte, Astro, shadcn/ui
  - Mobile: React Native, Flutter
  - Native: SwiftUI, Jetpack Compose

---

## 📖 如何使用 Skills

### 自动激活
当您的请求涉及某个 skill 的领域时,AI 助手会自动读取并应用相关的 skill。

### 手动引用
您也可以在对话中明确提到某个 skill:

```
请使用 Database Migration skill 来初始化数据库
```

### 查看 Skill 详情
点击上面的文件路径链接可以查看每个 skill 的详细说明。

---

## 🔧 维护指南

### 添加新 Skill

1. 在 `.agent/skills/` 下创建新文件夹
2. 创建 `SKILL.md` 文件(包含 YAML frontmatter)
3. 更新本注册表

### 更新 Skill

1. 修改对应的 `SKILL.md` 文件
2. 如有必要,更新本注册表的描述

### 删除 Skill

1. 删除对应的 skill 文件夹
2. 从本注册表中移除条目

---

## 📚 参考资源

- [Agent Skills 标准](http://agentskills.io)
- [Anthropic Skills 文档](https://support.claude.com/en/articles/12512176-what-are-skills)
- [如何创建自定义 Skills](https://support.claude.com/en/articles/12512198-creating-custom-skills)
- [UI/UX Pro Max 官网](https://uupm.cc)

---

*最后更新: 2026-02-15*
