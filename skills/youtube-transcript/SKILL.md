---
name: youtube-transcript
description: Fetch transcript và title của YouTube video dưới dạng JSON. Dùng khi user cung cấp YouTube URL và bạn cần spoken content (captions) cho analysis, summarization, quoting, hoặc search.
---

# YouTube Transcript

Fetch title và full transcript của YouTube video bằng cách pull captions qua `yt-dlp`. Prefer manual English subtitles, fallback đến auto-generated English.

## Requirements

- `yt-dlp` trên PATH (`brew install yt-dlp`)
- Python 3

## Usage

```bash
python3 ~/.pi/agent/skills/youtube-transcript/fetch_transcript.py "<youtube_url>"
```

## Output

In JSON object ra stdout:

```json
{
  "title": "Tiêu đề video",
  "transcript": "full transcript text dưới dạng single string"
}
```

Progress/info logs ra stderr. Trên failure (không có English captions, network error, bad URL), script exit non-zero với message trên stderr.

## Notes

- Chỉ English captions được attempted (`en`, `en-US`, `en-GB`, sau đó bất kỳ `en*`). Manual captions preferred over auto-generated.
- Transcript là plain text với timing/formatting stripped — không timestamped.
- Với non-English videos hoặc videos có captions disabled, script sẽ fail; consider `video_extract` với Gemini prompt như fallback.
