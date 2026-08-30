---
name: analyze-sessions
description: Phân tích các phiên pi agent trước đó lưu dưới ~/.pi/agent/sessions. Dùng khi user hỏi về cost (tổng, theo project, theo model, theo ngày), muốn khai thác pattern prompt từ prompt trước, xem session cụ thể, hoặc tìm kiếm qua session transcripts.
---

# Phân tích Sessions

Công cụ query các phiên pi trước đó. Tất cả scripts là Python 3 stdlib, không dependencies, và đọc trực tiếp từ `~/.pi/agent/sessions/`.

## Data shape (one-liner)

Mỗi session là một JSONL file. Records là `session` (header với `cwd`, `id`, `timestamp`), `model_change`, `thinking_level_change`, và `message` (roles: `user`, `assistant`, `toolResult`). Assistant messages mang `usage.cost` đã chia thành input/output/cacheRead/cacheWrite/total — cost analysis chỉ là summing những cái đó. Subagent transcripts sống nested trong parent session directory.

## Scripts

Tất cả scripts chia sẻ cùng filter vocabulary (xem "Shared filters" bên dưới). Chạy chúng với `python3` từ bất kỳ đâu:

```bash
python3 ~/.pi/agent/skills/analyze-sessions/scripts/<script>.py [args]
```

### `cost.py` — cost rollups

Cost subagents được **bao gồm mặc định** để totals phản ánh actual spend. Truyền `--show-subagents` để xem subagent share per row, hoặc `--no-subagents` để exclude.

```bash
# 7 ngày gần nhất, breakdown theo day (mặc định)
python3 cost.py

# 30 ngày gần nhất, top 10 projects by spend
python3 cost.py --since 30d --by project --limit 10

# Cost-per-model (mỗi assistant message credited cho model của chính nó)
python3 cost.py --since 30d --by model

# 10 sessions đắt nhất của tháng trước
python3 cost.py --since 30d --by session --limit 10

# Cost của một project, tất cả thời gian
python3 cost.py --cwd /path/to/your/project

# Grand total only
python3 cost.py --since 30d --by total

# Machine-readable
python3 cost.py --since 30d --by day --json
```

Groupings: `total`, `day`, `project`, `model`, `session`. Khi grouping, `--limit` cap groups, không phải sessions.

### `prompts.py` — dump user prompts cho pattern mining

Output là markdown grouped by project (`--format jsonl` available). Prompts trên `--max-chars` bị drop vì hầu hết là pasted context, không phải actual prompting.

```bash
# Mặc định: markdown dump, max 2000 chars per prompt
python3 prompts.py --since 30d

# Cap tighter hơn, một prompt per JSONL line
python3 prompts.py --since 7d --max-chars 1500 --format jsonl

# Prompts của một project
python3 prompts.py --cwd /path/to/your/project --since 30d

# Prompts đề cập topic
python3 prompts.py --grep "rate limit" --since 60d
```

Workflow điển hình cho "find patterns I could turn into global instructions":
1. Chạy `prompts.py --since 30d` và đọc output.
2. Group by recurring themes (cùng correction lặp qua projects, cùng setup question, cùng complaint).
3. Đề xuất additions cho global `CLAUDE.md` / project AGENTS.md / pi instructions.

### `show_session.py` — render một session как markdown

```bash
# Session gần nhất
python3 show_session.py --latest

# Session cụ thể theo id prefix (8 chars đủ unique)
python3 show_session.py --session 019e475b

# Session gần nhất trong một project
python3 show_session.py --latest --cwd /path/to/your/project

# Bao gồm subagent transcripts inline bên dưới
python3 show_session.py --session 019e475b --include-subagents-content

# Bỏ thinking entirely / show ít chars hơn
python3 show_session.py --session 019e475b --max-thinking -1 --max-tool-output 800
```

Mỗi tool result được fenced với `…[N more chars elided]…` nếu truncated. Default truncations: tool output 2000, assistant text 4000, thinking 600. Truyền `0` cho limit để disable, `-1` cho `--max-thinking` để omit thinking hoàn toàn.

### `search.py` — tìm kiếm qua transcripts

Substring mặc định, regex với `--regex` (smart-case). Tìm cả user và assistant text mặc định.

```bash
# Substring qua everything
python3 search.py "supabase RLS"

# Chỉ prompts của tôi, 60 ngày gần nhất
python3 search.py "global instruction" --in user --since 60d

# Regex
python3 search.py --regex "TODO\\(.+\\)"

# Context nhiều hơn per match
python3 search.py "rate limit" --context 2
```

Mỗi hit print session header плюс `python3 show_session.py --session <id>` line để bạn có thể drill in trực tiếp.

## Shared filters

Available trên **tất cả 4 scripts**:

| Flag | Meaning |
|---|---|
| `--since WHEN` / `--until WHEN` | `YYYY-MM-DD`, ISO datetime, hoặc relative: `7d`, `2w`, `3h`, `30m` |
| `--cwd SUBSTR` | Substring match trên session's real `cwd`. Repeatable. |
| `--model SUBSTR` | Substring match trên model id. Repeatable. |
| `--provider {anthropic,openai,google}` | |
| `--session ID` | Session id hoặc prefix (8 chars thường unique) |
| `--include-subagents` / `--no-subagents` | Override script mặc định |
| `--limit N` | Cap items returned (cap groups, không phải sessions, cho `cost.py` group views) |
| `--min-cost USD` | Drop sessions dưới spend này |
| `--min-messages N` | Drop short sessions |
| `--errors-only` | Chỉ sessions với ít nhất một `toolResult.isError` |
| `--grep SUBSTR` | Case-insensitive substring trên session's concatenated user prompts |

### Subagent mặc định
- `cost.py`: **bao gồm** (totals = real spend)
- `prompts.py`, `show_session.py`, `search.py`: **exclude** (subagent's "user" message là task description viết bởi agent khác, không phải prompt của bạn)

## Common queries

| Question | Command |
|---|---|
| Total cost 7 ngày gần nhất | `python3 cost.py --since 7d --by total` |
| Daily spend trend, 30 ngày gần nhất | `python3 cost.py --since 30d --by day` |
| Projects đắt nhất tháng này | `python3 cost.py --since 30d --by project --limit 10` |
| Sessions đắt nhất mọi thời đại | `python3 cost.py --by session --limit 10 --until 1d` |
| Cost của một project | `python3 cost.py --cwd /path/to/proj` |
| Patterns trong prompting của tôi | `python3 prompts.py --since 30d --max-chars 1500` → đọc output |
| Tôi đã làm gì yesterday | `python3 show_session.py --latest --since 1d` |
| Agent struggled ở đâu | `python3 cost.py --since 30d --errors-only --by session --limit 10` |
| Tìm session cũ về X | `python3 search.py "X"` |

## Notes

- Tất cả paths là read-only; scripts không bao giờ modify session files.
- Library (`scripts/sessions.py`) reusable: import nó cho ad-hoc analysis.
- Full scan qua vài hundred sessions mất ~1–2 seconds. Không caching.
