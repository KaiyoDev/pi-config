# Minimal Subagents

Một pi extension đăng ký single `subagent` tool với ba agents:

| Agent | Tools | Model | Purpose |
|-------|-------|-------|---------|
| **scout** | read, grep, find, ls | claude-haiku-4-5 | Fast codebase recon |
| **researcher** | web_search, web_fetch | claude-sonnet-4-6 | Web research |
| **worker** | read, write, edit, safe_bash | claude-sonnet-4-6 | Code changes |

## Usage

**Single mode:**
```json
{ "agent": "scout", "task": "Tìm tất cả auth-related files trong src/" }
```

**Parallel mode:**
```json
{ "tasks": [
  { "agent": "scout", "task": "Map database layer" },
  { "agent": "researcher", "task": "Best practices cho connection pooling" }
]}
```

Max 4 concurrent subagents (configurable). Mỗi chạy như isolated `pi` process không có inherited context — tất cả context phải trong task description.

## Config

Optional `config.json` cạnh `index.ts`:

```json
{ "maxConcurrency": 4 }
```

## UI

Default view hiển thị medium detail (agent status, task preview, recent tools). Expand để thấy full task, tất cả tool calls, complete output, và token usage.

## Registering Agents từ Extensions khác

Extensions khác có thể dynamically register và unregister agents tại runtime. Cái này hữu ích cho domain-specific agents nên chỉ available khi particular extension active.

### 1. Define agent `.md` files

Tạo markdown files với YAML frontmatter trong extension directory của bạn (vd, `my-extension/agents/my-agent.md`):

```markdown
---
name: my-agent
description: Làm một cái gì đó specific
tools: web_search, video_extract
model: claude-sonnet-4-20250514
---

Bạn là một agent làm một cái gì đó specific...
```

Frontmatter fields:
- **name** (required) — unique agent name, used trong `{ agent: "my-agent" }` calls
- **description** — short description
- **tools** — comma-separated list của tools agent cần (builtin hoặc extension)
- **model** — model identifier (mặc định `anthropic/claude-sonnet-4-6`)

Markdown body trở thành agent's system prompt.

### 2. Register agents qua `globalThis.__pi_subagents`

Pi load extensions qua jiti, tạo separate module instances. Direct imports từ subagents extension sẽ reference different `agents` array hơn `subagent` tool dùng. Dùng `globalThis` bridge thay thế:

```typescript
import { parseFrontmatter } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";

interface AgentConfig {
  name: string;
  description: string;
  tools: string[];
  model: string;
  systemPrompt: string;
  filePath: string;
}

const AGENTS_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), "agents");

function registerMyAgents(): void {
  const subagents = (globalThis as any).__pi_subagents như
    | { registerAgent: (config: AgentConfig) => void; unregisterAgent: (name: string) => void }
    | undefined;
  if (!subagents) return; // subagents extension chưa load

  for (const entry của fs.readdirSync(AGENTS_DIR)) {
    if (!entry.endsWith(".md")) continue;
    const filePath = path.join(AGENTS_DIR, entry);
    const content = fs.readFileSync(filePath, "utf-8");
    const { frontmatter, body } = parseFrontmatter<Record<string, string>>(content);
    if (!frontmatter.name) continue;

    const tools = (frontmatter.tools || "").split(",").map(t => t.trim()).filter(Boolean);
    try {
      subagents.registerAgent({
        name: frontmatter.name,
        description: frontmatter.description || "",
        tools,
        model: frontmatter.model || "anthropic/claude-sonnet-4-6",
        systemPrompt: body,
        filePath,
      });
    } catch {
      // Đã registered — skip
    }
  }
}
```

Gọi `registerMyAgents()` khi extension của bạn activate (vd, trong command handler). Agents trở nên available cho `subagent` tool ngay lập tức.

### 3. Adding custom tool support

Nếu agents của bạn cần tools beyond built-in set,那些 tools phải mapped trong `CUSTOM_TOOL_EXTENSIONS` record trong `subagents/index.ts`:

```typescript
const CUSTOM_TOOL_EXTENSIONS: Record<string, string> = {
  web_search: path.join(EXT_BASE, "web-search", "index.ts"),
  web_fetch: path.join(EXT_BASE, "web-fetch", "index.ts"),
  safe_bash: path.join(TOOLS_DIR, "safe-bash.ts"),
  video_extract: path.join(EXT_BASE, "video-extract", "index.ts"),
  youtube_search: path.join(EXT_BASE, "youtube-search", "index.ts"),
  google_image_search: path.join(EXT_BASE, "google-image-search", "index.ts"),
};
```

Built-in tools (`read`, `write`, `edit`, `bash`, `grep`, `find`, `ls`) work automatically. Bất kỳ tool nào agent list trong frontmatter của nó phải có corresponding entry đây pointing đến extension's `index.ts`.

## Structure

```
subagents/
├── index.ts           # Extension entry point
├── agents/            # Built-in agent configs (frontmatter + system prompt)
└── tools/             # Extensions loaded vào subagent processes
    └── safe-bash.ts   # bash với dangerous command blocking
```
