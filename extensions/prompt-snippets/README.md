# Prompt Snippets

Các quy tắc prompt đơn mục đích có thể kết hợp, được thêm vào đầu hoặc cuối tin nhắn của bạn khi gửi. Khác với skills, mỗi snippet là một hướng dẫn nhỏ, độc lập — bật/tắt chính xác những cái bạn muốn cho mỗi tin nhắn.

## Cách sử dụng

- Nhấn **alt+s** hoặc chạy **/snippets** để mở menu toggle.
  - `up`/`down` để navigate, `space` để toggle, `enter` để apply, `esc` để cancel.
  - `tab` preview snippet được highlight (tên, placement, order, filename, và full body; `up`/`down` scroll long bodies). `tab` hoặc `esc` trở về list với cursor position preserved.
  - Menu được framed với top/bottom border lines và scroll khi list vượt viewport (max height adapts到你的 terminal), với `↑ n more` / `↓ n more` indicators khi clipped.
- Active snippets hiện lên như widget phía trên editor:
  - `↑ prepend: ...` (accent color) — chèn trước tin nhắn của bạn
  - `↓ append: ...` (warning color) — chèn sau tin nhắn của bạn
- Khi bạn gửi tin nhắn, active snippet bodies được merge vào message text: prepend group (sorted by `order`) → text của bạn → append group (sorted by `order`), cách nhau bằng dòng trống.
- Toggles được reset về **tắt hết** sau mỗi lần gửi và đầu phiên.

## File snippets

Snippets sống trong `snippets/` cạnh `index.ts` — mỗi cái một file markdown, có frontmatter:

```markdown
---
name: Ngắn gọn
description: Giữ câu trả lời ngắn và đi thẳng vấn đề
placement: prepend
order: 10
---
Giữ response của bạn concise. Bỏ preamble và explanation không cần thiết.
```

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| `name` | không | Display name; mặc định là filename không có `.md` |
| `description` | không | Hiển thị cạnh name trong toggle menu |
| `placement` | không | `prepend` hoặc `append` (mặc định: `append`) |
| `order` | không | Number; sắp xếp snippets trong group của chúng, trong menu và trong applied text (mặc định: `9999`, ties broken by name) |

Files được re-scan mỗi khi menu mở và mỗi khi message được gửi, nên edits có effect ngay — không cần `/reload`.
