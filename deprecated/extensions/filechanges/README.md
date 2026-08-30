# filechanges (tiện ích mở rộng pi)

Theo dõi files changed (modified/created) bởi **pi** qua built-in `edit` và `write` tools.

## Tính năng

- Persistent log (stored trong session như custom entries)
- Status line + widget listing changed files
- `/filechanges` overlay để inspect diffs
- `/filechanges-accept` để clear log (giữ files)
- `/filechanges-decline` để revert logged changes (restore original contents / delete created files)

## Usage

1. Reload pi: `/reload`
2. Make changes qua pi (dùng `edit`/`write`)
3. Chạy:
   - `/filechanges` để inspect
   - `/filechanges-accept` để accept (clear log)
   - `/filechanges-decline` để decline (revert)

### Non-interactive usage

Nếu `ctx.hasUI` là false (print/json mode), accept/decline require explicit confirmation:

- `/filechanges-accept force`
- `/filechanges-decline force`

## Notes

- Chỉ theo dõi changes performed qua `edit` và `write` tools.
- Để support "decline", extension lưu original file contents (trước first pi change) trong session file như custom entry.
