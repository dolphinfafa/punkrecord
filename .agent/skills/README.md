# Skills 目录

这个目录包含了扩展 AI 助手能力的专门技能集。每个 skill 都是一个独立的文件夹,包含特定任务的指令、脚本和资源。

## Skill 结构

每个 skill 文件夹应包含:

```
skill-name/
├── SKILL.md          # 必需:主要指令文件
├── scripts/          # 可选:辅助脚本
├── examples/         # 可选:示例代码
└── resources/        # 可选:模板和其他资源
```

## SKILL.md 格式

```markdown
---
name: Skill 名称
description: 简短描述这个 skill 的用途
---

# Skill 详细说明

[这里写详细的指令和使用方法]
```

## 当前可用的 Skills

> 📋 **完整列表**: 查看 [SKILLS_REGISTRY.md](SKILLS_REGISTRY.md) 获取所有 19 个 skills 的详细索引

### 本地自定义 (2)
- **database-migration** - 数据库迁移和初始化的标准流程
- **python-env** - Python 环境管理和包安装规范

### Anthropic Skills (16)
来自 [anthropics/skills](https://github.com/anthropics/skills) 的官方 skills:
- **Creative & Design**: algorithmic-art, canvas-design, frontend-design, theme-factory
- **Development & Technical**: mcp-builder, skill-creator, web-artifacts-builder, webapp-testing
- **Enterprise & Communication**: brand-guidelines, internal-comms, slack-gif-creator
- **Document Skills**: docx, pdf, pptx, xlsx, doc-coauthoring

### UI/UX Pro Max (1)
来自 [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill):
- **ui-ux-pro-max** - AI 驱动的设计智能系统
  - 100 条行业特定推理规则
  - 67 种 UI 风格
  - 96 个调色板
  - 57 种字体配对
  - 设计系统生成器

## 如何添加新 Skill

1. 在 `.agent/skills/` 下创建新文件夹
2. 创建 `SKILL.md` 文件,包含 YAML frontmatter 和详细指令
3. 根据需要添加 scripts、examples 或 resources 目录
4. 更新本 README 的"当前可用的 Skills"列表
