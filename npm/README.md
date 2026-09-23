# npm/ — Pi extension cài qua npm (chọn lọc)

Bản đồng bộ **2026-09-23** từ `~/.pi/agent/npm/package.json` (live), chỉ giữ các package
cung cấp tool/skill đang dùng thật. Version range giữ nguyên như live.

## Gồm 8 package

| Package | Vai trò |
|---|---|
| `pi-atelier` | Status rail + live activity sidebar responsive cho pi (UI)
| `pi-herdsman` | Orchestration agent: tool `agent` (delegate/steer/inspect...), định nghĩa agent scout/researcher/implementer/reviewer/generalist, tool `chief`/`peer` |
| `pi-subagents` | Tool `subagent` (1-child + workflow script), council-mode, `subagent_supervisor`, skill `pi-subagents`/`council-mode` |
| `pi-btw` | Skill `btw` — side-conversation song song |
| `pi-memory` | Memory tools: `memory_read/write/search/forget/status`, file `MEMORY.md` + daily log |
| `pi-goal-x` | Tool `create_goal`/`get_goal` — goal planning + completion auditor |
| `pi-mcp-adapter` | Tool `mcp` (MCP gateway) + proxy `mcp__stitch`, `mcp__soralabs`, `mcp__shadcn*` |
| `@plannotator/pi-extension` | Plan review có annotation (skill `plannotator` + các skill `plannotator-*`) |

## Cài đặt

```bash
# 1. Tạo/copy thư mục npm của pi
mkdir -p ~/.pi/agent/npm
cp -r pi-config/npm/package.json ~/.pi/agent/npm/

# 2. Cài dependencies
cd ~/.pi/agent/npm
npm install

# 3. /reload trong pi (hoặc restart)
```

Lưu ý: `pi-mcp-adapter` cần config MCP servers (stitch, soralabs, shadcn, codebase-memory...)
nằm ở `~/.pi/agent/mcp.json` — file này KHÔNG nằm trong repo (chứa endpoint/key riêng).

## Cố tình không lấy (8 package UI/thí nghiệm khác trong live)

`pi-cache-graph`, `pi-context-view`, `pi-custom-system-prompt`,
`pi-extmgr`, `pi-tool-repair`, `pi-warden`, `@narumitw/pi-usage`, `@pify/pretty`.

Cần cái nào thì thêm vào `package.json` ở đây (version xem trong live `~/.pi/agent/npm`).
