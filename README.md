# pi-config — Hướng dẫn cài đặt & sử dụng

Cấu hình cá nhân cho [pi](https://github.com/earendil-works/pi) — AI coding agent.

Dự án này **không cài đặt như một package lớn**. Hãy duyệt qua và sao chép từng phần bạn cần.

---

## 📦 Cài đặt nhanh

```bash
# 1. Clone repo về (nếu chưa có)
git clone https://github.com/KaiyoDev/pi-config.git
cd pi-config

# 2. Copy extensions bạn muốn
cp extensions/ask-user-question.ts ~/.pi/agent/extensions/
cp -r extensions/browser ~/.pi/agent/extensions/
cp -r extensions/bash-guard ~/.pi/agent/extensions/
cp -r extensions/web-fetch ~/.pi/agent/extensions/
cp -r extensions/web-search ~/.pi/agent/extensions/
cp -r extensions/prompt-snippets ~/.pi/agent/extensions/

# 3. Copy skills bạn muốn
cp -r skills/analyze-sessions ~/.pi/agent/skills/
cp -r skills/pdf-reader ~/.pi/agent/skills/
cp -r skills/youtube-transcript ~/.pi/agent/skills/
cp -r skills/web-debug ~/.pi/agent/skills/

# 4. Khởi động lại pi
/reload
```

---

## 🔌 Extensions

### 1. `ask-user-question.ts` — Hỏi user qua popup UI

**Tính năng:** Agent hỏi bạn câu hỏi với 3 chế độ:
- Văn bản tự do
- Chọn 1 đáp án (single-select)
- Chọn nhiều đáp án (multi-select)

**Cài đặt:** Copy file duy nhất, không cần deps.

```bash
cp extensions/ask-user-question.ts ~/.pi/agent/extensions/
```

**Sử dụng:** Agent tự động gọi khi cần hỏi. Popup hiển thị trong TUI với:
- Text input trường
- Danh sách options (có "Other" để nhập custom)
- Nút submit/cancel

---

### 2. `browser/` — Headless Chromium điều khiển được

**Tính năng:** Điều khiển browser để debug SPA:
- Navigate đến URL
- Chạy JS trong page
- Đọc localStorage, cookies
- Xem console logs, network requests
- Fill form, click elements
- Chụp screenshot

**Cài đặt:**

```bash
# 1. Copy extension
cp -r extensions/browser ~/.pi/agent/extensions/

# 2. Cài dependencies
cd ~/.pi/agent/extensions/browser
npm install

# 3. Cài Chromium binary (một lần)
npx playwright install chromium
```

**Kích hoạt:** Mặc định tắt. Bật bằng lệnh:

```
/browser on        # Bật browser
/browser           # Xem trạng thái
/browser off       # Tắt và đóng browser
```

**Công cụ available khi bật:**

| Tool | Công dụng |
|------|-----------|
| `browser_goto <url>` | Điều hướng đến URL |
| `browser_eval <js>` | Chạy JS trong page |
| `browser_console` | Xem console logs |
| `browser_network` | Xem network requests |
| `browser_fill <selector> <value>` | Điền input |
| `browser_click <selector>` | Click element |
| `browser_screenshot` | Chụp màn hình |
| `browser_close` | Đóng browser |

**Ví dụ:**

```bash
# Debug auth issue
browser_goto https://app.example.com
browser_eval "Object.keys(localStorage)"
browser_network --verbose
```

**Environment variables:**

| Variable | Mặc định | Công dụng |
|----------|----------|-----------|
| `PI_BROWSER_HEADFUL` | (unset) | Hiển thị window (debug extension) |
| `PI_BROWSER_PROFILE` | `~/.pi/agent/extensions/browser/.profile` | Thư mục profile persistent |

---

### 3. `bash-guard/` — Chặn lệnh bash nguy hiểm

**Tính năng:** Intercepts `bash` tool calls và chặn lệnh nguy hiểm dựa trên context.

**2 chế độ:**

| Mode | Điều kiện | Hành vi |
|------|-----------|---------|
| Interactive | `PI_SUBAGENT_DEPTH=0` hoặc unset | Prompt xác nhận cho risky commands |
| Subagent | `PI_SUBAGENT_DEPTH≥1` | Hard-block catastrophic commands |

**Cài đặt:**

```bash
cp -r extensions/bash-guard ~/.pi/agent/extensions/
cd ~/.pi/agent/extensions/bash-guard
npm install
```

**Lệnh bị chặn mặc định:**

| Mức độ | Lệnh |
|--------|------|
| **High** | `rm -rf`, `sudo`, `curl\|sh`, `dd of=`, `mkfs*`, `wipefs` |
| **High** | `git reset --hard`, `git clean -fdx`, `git push --force` |
| **High** | `terraform destroy`, `kubectl delete`, `aws s3 rm --recursive` |
| **Medium** | Mọi `git` commands (prompt), `chmod -R`, `kill`, `shutdown` |

**Flags:**

| Flag | Công dụng |
|------|-----------|
| `--bash-guard-auto-allow` | Bỏ qua prompt khi không có UI (non-interactive) |

**Thay đổi trong session:**

```
# Kiểm tra trạng thái
/bash-guard status

# Tạm thời bỏ qua tất cả (session này)
/bash-guard allow-all
```

---

### 4. `web-fetch/` — Fetch URL thành markdown

**Tính năng:** Lấy nội dung URL và chuyển thành markdown sạch. Hỗ trợ PDF.

**Cài đặt:**

```bash
cp -r extensions/web-fetch ~/.pi/agent/extensions/
cd ~/.pi/agent/extensions/web-fetch
npm install
```

**Dependencies:** `@mozilla/readability`, `linkedom`, `turndown`, `unpdf`

**Công cụ:**

| Tool | Công dụng |
|------|-----------|
| `web_fetch <url>` | Fetch URL → markdown |
| `web_fetch <url> --pdf` | Fetch PDF → text |
| `web_fetch <url> --raw` | Lấy raw content |

**Ví dụ:**

```bash
# Fetch webpage
web_fetch "https://example.com/article"

# Fetch PDF
web_fetch "https://example.com/paper.pdf" --pdf
```

---

### 5. `web-search/` — Tìm kiếm web

**Tính năng:** Google Custom Search API với structured queries.

**Cài đặt:**

```bash
cp -r extensions/web-search ~/.pi/agent/extensions/
```

**Yêu cầu credentials:**

Tạo `~/.pi/agent/extensions/web-search/auth.json`:

```json
{
  "google_search_api_key": "YOUR_API_KEY",
  "google_cse_id": "YOUR_CUSTOM_SEARCH_ENGINE_ID"
}
```

Hoặc set environment variables:
- `GOOGLE_SEARCH_API_KEY`
- `GOOGLE_CSE_ID`

**Công cụ:**

| Tool | Params | Mô tả |
|------|--------|-------|
| `web_search` | `query` | Tìm kiếm cơ bản |
| `web_search` | `exactPhrases` | Tìm exact phrase |
| `web_search` | `excludeTerms` | Loại trừ từ |
| `web_search` | `site` | Tìm trong domain |
| `web_search` | `count` | Số kết quả (max 10) |

**Ví dụ:**

```bash
# Tìm cơ bản
web_search --query "react hooks best practices" --count 5

# Tìm exact phrase
web_search --query "type safety" --exactPhrases ["strict mode"]

# Tìm trong GitHub
web_search --query "playwright test" --site "github.com"
```

---

### 6. `prompt-snippets/` — Toggle prompt rules

**Tính năng:** Thêm prompt rules vào đầu/cuối tin nhắn trước khi gửi.

**Cài đặt:**

```bash
cp -r extensions/prompt-snippets ~/.pi/agent/extensions/
```

**Sử dụng:**

```
# Mở menu toggle
alt+s

# Hoặc chạy command
/snippets
```

**Menu controls:**
- `↑/↓` — Navigate
- `Space` — Toggle snippet
- `Tab` — Preview snippet
- `Enter` — Apply và đóng
- `Esc` — Cancel

**6 snippets có sẵn:**

| Snippet | Placement | Order | Công dụng |
|---------|-----------|-------|-----------|
| `session-kickoff` | prepend | 10 | Làm quen project trước khi làm việc |
| `ask-questions` | append | 10 | Hỏi đến khi hiểu 100% |
| `verify-not-assume` | append | 20 | Xác minh thay vì đoán |
| `delegate-exploration` | append | 30 | Giao exploration cho subagents |
| `orchestrator-mode` | prepend | 30 | Chế độ orchestrator纯 túy |
| `diagnose-report` | append | 40 | Chẩn đoán, không sửa code |

**Tạo snippet mới:**

Tạo file `~/.pi/agent/extensions/prompt-snippets/snippets/my-rule.md`:

```markdown
---
name: My Rule
description: Mô tả ngắn
placement: prepend
order: 50
---
Nội dung prompt rule của bạn ở đây.
```

---

### 7. `custom-header.ts` — Tùy chỉnh header

**Tính năng:** Thay thế header mặc định bằng ASCII art tùy chỉnh.

**Cài đặt:**

```bash
cp extensions/custom-header.ts ~/.pi/agent/extensions/
```

**Sửa header:** Edit file `custom-header.ts`, thay đổi mảng `ascii_art_2` và `hints`.

**Restore header mặc định:**

```
/builtin-header
```

---

## 🛠️ Skills

### 1. `analyze-sessions/` — Phân tích chi phí & patterns

**Tính năng:** Query past sessions để phân tích cost, prompts, search transcripts.

**Cài đặt:**

```bash
cp -r skills/analyze-sessions ~/.pi/agent/skills/
```

**Yêu cầu:** Python 3 (stdlib only, không cần venv)

**Commands:**

```bash
# Cost breakdown
python3 ~/.pi/agent/skills/analyze-sessions/scripts/cost.py

# Last 7 days, by day
python3 cost.py --since 7d --by day

# Top 10 projects by spend
python3 cost.py --since 30d --by project --limit 10

# Cost per model
python3 cost.py --since 30d --by model

# Grand total
python3 cost.py --since 30d --by total --json

# Dump prompts
python3 ~/.pi/agent/skills/analyze-sessions/scripts/prompts.py --since 30d

# Show session
python3 show_session.py --latest

# Search transcripts
python3 search.py "rate limit" --since 60d
```

**Shared filters:**

| Flag | Công dụng |
|------|-----------|
| `--since N[dwhm]` | Thời gian bắt đầu |
| `--until N[dwhm]` | Thời gian kết thúc |
| `--cwd SUBSTR` | Filter theo project path |
| `--model SUBSTR` | Filter theo model |
| `--session ID` | Session cụ thể |
| `--errors-only` | Chỉ sessions có lỗi |
| `--min-cost $` | Minimum spend |

---

### 2. `pdf-reader/` — Đọc & phân tích PDF

**Tính năng:** Đọc PDF với hybrid text + vision approach.

**Cài đặt:**

```bash
cp -r skills/pdf-reader ~/.pi/agent/skills/

# Tạo venv và cài deps
python3 -m venv ~/.pi/agent/skills/pdf-reader/.venv
~/.pi/agent/skills/pdf-reader/.venv/bin/pip install -r ~/.pi/agent/skills/pdf-reader/requirements.txt
```

**Requirements:** `pymupdf`

**4 scripts:**

| Script | Công dụng | Ví dụ |
|--------|-----------|-------|
| `pdf_info.py` | Metadata + analysis | `pdf_info.py paper.pdf` |
| `pdf_extract.py` | Extract text | `pdf_extract.py paper.pdf --pages 1-5` |
| `pdf_render.py` | Render trang thành PNG | `pdf_render.py paper.pdf --pages 3 --dpi 200` |
| `pdf_search.py` | Search text content | `pdf_search.py paper.pdf "theorem 3.2"` |

**Page specs:**
- `all` — tất cả trang
- `1-5` — trang 1 đến 5
- `1,3,7` — trang 1, 3, 7
- `3` — trang 3

**Strategy đọc PDF:**

| Size | Strategy |
|------|----------|
| ≤15 pages | Extract + render hết |
| 15-60 pages | Extract text + render trang math/image dense |
| >60 pages | Extract overview + search targeted |

---

### 3. `youtube-transcript/` — Fetch transcript YouTube

**Tính năng:** Lấy title và transcript từ YouTube video.

**Cài đặt:**

```bash
cp -r skills/youtube-transcript ~/.pi/agent/skills/
```

**Yêu cầu hệ thống:**

```bash
# macOS
brew install yt-dlp ffmpeg

# Linux (Ubuntu/Debian)
sudo apt install yt-dlp ffmpeg
```

**Sử dụng:**

```bash
python3 ~/.pi/agent/skills/youtube-transcript/fetch_transcript.py "<youtube_url>"
```

**Output JSON:**

```json
{
  "title": "Video Title",
  "transcript": "Full transcript text..."
}
```

**Lưu ý:**
- Ưu tiên manual English captions
- Fallback auto-generated
- Chỉ English captions được support

---

### 4. `web-debug/` — Playbook debug frontend

**Tính năng:** Hướng dẫn debug frontend qua browser extension.

**Cài đặt:**

```bash
cp -r skills/web-debug ~/.pi/agent/skills/
```

**Sử dụng:** Skill này là playbook hướng dẫn agent cách dùng `browser_*` tools. Không cần chạy command trực tiếp.

**Các playbook có sẵn:**

| Trường hợp | Steps |
|------------|-------|
| Auth flow lỗi | `browser_goto` → `browser_fill` → `browser_network` → check localStorage |
| Request 401/403 | `browser_network --verbose` → check Authorization header |
| Form không submit | `browser_eval` check `checkValidity()` → `browser_console` |
| Blank screen | `browser_console` → `browser_screenshot` → check `innerHTML` |
| Verify fix | `browser_goto` → drive action → `browser_eval` assert state |

---

## 🔗 Stubs (repo riêng)

2 extensions là stubs, code thực tế ở repo riêng:

| Stub | Repo riêng |
|------|-----------|
| `interactive-subagents/` | https://github.com/pi-interactive-subagents |
| `observational-memory/` | https://github.com/pi-observational-memory |

---

## ⚙️ Troubleshooting

### Extension không load sau `/reload`
```bash
# Check extension có trong folder không
ls ~/.pi/agent/extensions/

# Restart pi hoàn toàn
# Hoặc kill process và chạy lại
```

### Browser không khởi động được
```bash
# Reinstall Chromium
cd ~/.pi/agent/extensions/browser
npx playwright install chromium

# Check profile dir
ls ~/.pi/agent/extensions/browser/.profile
```

### PDF reader lỗi import
```bash
# Reinstall venv
rm -rf ~/.pi/agent/skills/pdf-reader/.venv
python3 -m venv ~/.pi/agent/skills/pdf-reader/.venv
~/.pi/agent/skills/pdf-reader/.venv/bin/pip install -r ~/.pi/agent/skills/pdf-reader/requirements.txt
```

### Web search không có credentials
```bash
# Tạo auth.json
cat > ~/.pi/agent/extensions/web-search/auth.json << 'EOF'
{
  "google_search_api_key": "KEY",
  "google_cse_id": "CSE_ID"
}
EOF
```

---

## 📝 License

MIT — Sử dụng tự do, sửa đổi theo nhu cầu.
