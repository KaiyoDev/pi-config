---
name: reddit
description: Tìm kiếm Reddit và duyệt subreddit posts sử dụng public JSON API. Dùng khi bạn cần find Reddit discussions, community reactions, hoặc story leads từ subreddit cụ thể.
---

# Reddit

Tìm kiếm Reddit, duyệt subreddit top posts, và đọc individual posts với comments. Không cần API key.

## Tool

Dùng `reddit.js` từ skill directory này:

```bash
node reddit.js <command> [options]
```

## Commands

### Tìm kiếm toàn bộ Reddit
```bash
reddit.js search "query" [-n count] [-t period] [-s sort]
```

### Top posts từ subreddit
```bash
reddit.js top <subreddit> [-n count] [-t period]
```

### Đọc post với top comments
```bash
reddit.js post <url> [-c comment_count]
```

## Options

| Flag | Default | Values |
|------|---------|--------|
| `-n` | 10 | Số results (max 100) |
| `-t` | year | `hour`, `day`, `week`, `month`, `year`, `all` |
| `-s` | top | `relevance`, `hot`, `top`, `new`, `comments` |
| `-c` | 5 | Số comments để show |

## Output

Mỗi post hiển thị: score, comment count, title, subreddit, author, date, link, và text preview. `post` command additionally hiển thị top comments với scores.

## Notes

- **Rate limiting**: Reddit rate-limits unauthenticated requests. Thêm small delay giữa rapid successive calls nếu needed.
- **Search relevance**: Global search có thể noisy. Subreddit-specific `top` browsing tends surfacing better results cho niche research.
- **Subreddit names**: Pass không có `r/` prefix (vd, `cybersecurity` không phải `r/cybersecurity`).
