# pi-config

Cấu hình cá nhân [pi](https://github.com/earendil-works/pi) của tôi.

Bộ setup từ [My Pi Setup After 6 Months](https://www.youtube.com/watch?v=...) (và bản trước đó, [Pi Coding Agent Setup After 2 Months](https://www.youtube.com/watch?v=DWWrLlM3gwQ)).

Đây **không phải** là một gói cài đặt lớn duy nhất. Duyệt qua repo và sao chép các phần bạn muốn vào cấu hình Pi của riêng bạn.

Một số extension đủ lớn để sống trong repo riêng:

- **[pi-interactive-subagents](https://github.com/pi-interactive-subagents)** — subagents tương tác, async trong multiplexer panes
- **[pi-observational-memory](https://github.com/pi-observational-memory)** — bộ nhớ phân cấp với compaction xác định
- **[pi-dictate](https://github.com/pi-dictate)** — gõ dictation giọng nói real-time trong pi
- **[learn](https://github.com/learn-ai)** — hệ thống học AI của tôi, xây dựng trên config này

Repo này chứa tất cả mọi thứ khác.

## Sao chép extension

Extension đơn file:

```bash
cp extensions/ask-user-question.ts ~/.pi/agent/extensions/
```

Extension dạng thư mục:

```bash
cp -r extensions/browser ~/.pi/agent/extensions/
```

Nếu extension được sao chép có `package.json`, cài đặt deps:

```bash
cd ~/.pi/agent/extensions/browser
npm install
```

Sau đó khởi động lại pi hoặc chạy `/reload`.

## Sao chép skill

```bash
cp -r skills/pdf-reader ~/.pi/agent/skills/
```

Sau đó khởi động lại pi hoặc chạy `/reload`.

## Không clone đè lên config của bạn

Tránh clone repo này trực tiếp vào `~/.pi/agent` trừ khi bạn đang thiết lập từ đầu. Nếu bạn đã dùng pi, hãy sao chép từng file/thư mục thay vì clone toàn bộ để không ghi đè config của bạn.

## Nội dung

### Extensions

- `ask-user-question.ts` — agent hỏi bạn câu hỏi qua popup UI; popup từ các extension khác nhau được serialize qua shared UI lock
- `bash-guard/` — hooks chặn lệnh bash nguy hiểm trước khi chạy, có toggle on/off
- `browser/` — Chromium headless điều khiển bởi Playwright mà agent có thể lái (navigate, eval JS, inspect network/console, click, screenshot); mặc định tắt, bật bằng `/browser on`
- `custom-header.ts` — header Π viết hoa lớn
- `interactive-subagents/` — stub, xem [pi-interactive-subagents](https://github.com/pi-interactive-subagents)
- `observational-memory/` — stub, xem [pi-observational-memory](https://github.com/pi-observational-memory)
- `prompt-snippets/` — snippet prompt nhỏ, tái sử dụng, bật/tắt lên tin nhắn trước khi gửi; reset sau khi gửi
- `web-fetch/` — fetch URL và lấy markdown sạch
- `web-search/` — tìm kiếm web

### Skills

- `analyze-sessions/` — script Python query past pi sessions: tổng cost, mining pattern prompt, render session
- `pdf-reader/` — đọc PDF (ghi chú bài giảng, paper) vào context
- `web-debug/` — playbook gỡ lỗi frontend với browser extension tools
- `youtube-transcript/` — fetch title và transcript video YouTube dưới dạng JSON

### Đã lỗi thời

`deprecated/` chứa extensions và skills từ "2-month setup" không còn dùng nữa. Chúng vẫn hoạt động; chúng chỉ không xứng đáng có chỗ đứng. Giữ lại để tham khảo.

## Dependencies

Dependencies npm local được giữ cùng extension. Chạy `npm install` chỉ trong extension đã sao chép có `package.json`:

- `bash-guard/`
- `browser/` (cũng chạy `npx playwright install chromium` một lần)
- `web-fetch/`

Công cụ hệ thống tùy chọn:

```bash
brew install yt-dlp ffmpeg
```

Dùng bởi `youtube-transcript/`. Python 3 cần cho `youtube-transcript/` và `analyze-sessions/` (stdlib only).

Setup PDF reader sau khi copy `skills/pdf-reader/`:

```bash
python3 -m venv ~/.pi/agent/skills/pdf-reader/.venv
~/.pi/agent/skills/pdf-reader/.venv/bin/pip install -r ~/.pi/agent/skills/pdf-reader/requirements.txt
```
