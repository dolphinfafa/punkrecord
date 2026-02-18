---
description: Build MCP (Model Context Protocol) servers for LLM integration using TypeScript
---

# MCP Builder Skill

This workflow uses the globally installed `mcp-builder` skill at:
`C:\Users\YZ\.antigravity\skills\skills\skills\mcp-builder`

Read the full skill instructions before proceeding:
```
C:\Users\YZ\.antigravity\skills\skills\skills\mcp-builder\SKILL.md
```

## When to Use

Use this skill when:
- Building a new MCP server to expose tools or resources to LLMs
- Integrating external APIs or services via MCP protocol
- Creating evaluations for MCP server functionality

## Four-Phase Workflow

### Phase 1: Research & Planning

1. Read the SKILL.md for full guidance
2. Study the MCP protocol documentation
3. Define the tools/resources the server will expose
4. Plan the TypeScript project structure

### Phase 2: Implementation

```bash
# Initialize TypeScript MCP server project
npm init -y
npm install @modelcontextprotocol/sdk typescript
npx tsc --init
```

Key implementation points:
- Use TypeScript for type safety
- Follow MCP protocol spec for tool definitions
- Handle errors gracefully with proper MCP error responses
- Implement proper input validation

### Phase 3: Review & Test

- Test each tool with realistic inputs
- Verify error handling works correctly
- Check that tool descriptions are clear and accurate
- Ensure the server starts and connects properly

### Phase 4: Create Evaluations

- Write evaluation cases for each tool
- Cover happy path and edge cases
- Document expected inputs and outputs

## Key Libraries

```bash
npm install @modelcontextprotocol/sdk
npm install -D typescript @types/node
```
