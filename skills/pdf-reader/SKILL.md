---
name: pdf-reader
description: Đọc và hiểu PDF files, đặc biệt là math lecture notes và academic papers. Dùng khi user hỏi đọc, parse, analyze, hoặc extract content từ PDF file.
---

# PDF Reader

Đọc và hiểu PDF files, đặc biệt là math lecture notes và academic papers. Dùng hybrid text extraction + vision approach cho maximum comprehension của equations, diagrams, và structured content.

## Setup

Tất cả scripts dùng venv tại `SKILL_DIR/.venv` với `pymupdf` installed. Nếu venv missing, tạo nó từ `requirements.txt`:

```bash
python3 -m venv SKILL_DIR/.venv
SKILL_DIR/.venv/bin/pip install -r SKILL_DIR/requirements.txt
```

**Lệnh Python:** Luôn invoke scripts với:
```
SKILL_DIR/.venv/bin/python SKILL_DIR/scripts/<script>.py [args]
```

## Scripts

Tất cả scripts trong `SKILL_DIR/scripts/`.

| Script | Purpose | Key args |
|---|---|---|
| `pdf_info.py <path>` | Metadata + per-page analysis (page count, TOC, text density, math density, image count) | — |
| `pdf_extract.py <path> [--pages SPEC]` | Extract text by page | `--pages all\|1-5\|1,3,7\|3` |
| `pdf_render.py <path> [--pages SPEC] [--dpi N]` | Render pages to PNG images trong `/tmp/pi-pdf-*/` | `--pages`, `--dpi` (default 150) |
| `pdf_search.py <path> <query> [--context N] [--literal]` | Search text content bởi regex hoặc literal | `--context` lines (default 3), `--literal` flag |

Page specs: `all`, `1-5`, `1,3,7`, `3` (1-indexed, inclusive ranges).

## Strategy: Cách đọc PDF

### Bước 1: Luôn Triage Trước

Chạy `pdf_info.py` trên mọi PDF mới trước khi làm gì. Cái này cho bạn biết:
- Bao nhiêu pages (quyết định strategy)
- Có TOC không (enable structural navigation)
- Per-page math density và image count (identifies pages cần vision)
- Per-page text length (spots pages mostly diagrams/figures)

### Bước 2: Chọn Strategy Dựa trên Size và Content

#### PDFs ngắn (≤15 pages)
- Extract all text: `pdf_extract.py <path>`
- Render all pages: `pdf_render.py <path>`
- Đọc tất cả rendered images với `read` tool cho full visual comprehension
- Cái này cho hiểu biết complete ở reasonable token cost

#### PDFs trung bình (15–60 pages)
- Extract all text trước (cheap, cho structural overview)
- Check `pdf_info.py` output cho pages với high `math_density` (>0.02) hoặc `image_count` > 0 hoặc low `text_length` (<100, likely diagram-only pages)
- Render chỉ那些 math/diagram-heavy pages làm images
- Đọc những images đó với `read` cho equation và figure comprehension
- Với phần còn lại, text extraction đủ

#### PDFs dài (60+ pages)
- Extract text cho structural overview — tập trung vào TOC và section headers
- KHÔNG render tất cả pages (quá nhiều tokens)
- Cho targeted questions: dùng `pdf_search.py` để find relevant pages, sau đó render那些
- Cho full comprehension: làm section by section, summarizing как bạn go
- Warn user về scope — offer để focus на specific sections

### Bước 3: Targeted Lookups

Khi user hỏi cái gì đó specific (vd, "check theorem 3.2", "trang 7 nói gì"):
1. `pdf_search.py <path> "theorem 3.2"` — find page
2. `pdf_render.py <path> --pages <page>` — render just that page
3. `read` the image — see actual theorem với proper math rendering
4. Nếu cần context, extract text từ surrounding pages

### Bước 4: Visual Reading Guidelines

Khi đọc rendered page images:
- **150 DPI** (mặc định) tốt cho most math和text
- **200 DPI** nếu equations nhỏ, dense, hoặc khó đọc tại 150
- **100 DPI** chỉ cho quick structural scanning (tiết kiệm tokens)
- State equations explicitly trong response sử dụng LaTeX notation khi discussing chúng
- Describe diagrams và figures chi tiết — user có thể không nhìn PDF đồng thời
- Note page numbers khi referencing content để user có thể find nó

### Bước 5: Những gì cần watch for

- **Pages với low text_length nhưng high image_count**: likely full-page diagrams hoặc figures — luôn render những cái này
- **Pages với high math_density**: equations mà text extraction sẽ mangle — luôn render những cái này
- **Pages với decent text nhưng zero math**: text extraction alone đủ, skip rendering
- **TOC entries**: dùng những cái này để navigate structurally thay vì đọc linearly

## Common Patterns

### "Đọc PDF này" (full document)
```
1. pdf_info.py → assess size và content
2. Chọn strategy (short/medium/long)
3. Extract text + selectively render
4. Provide summary với key findings
```

### "Theorem X nói gì?"
```
1. pdf_search.py → find page
2. pdf_render.py → render page đó
3. Đọc image, state theorem precisely
```

### "Giải thích proof trên trang N"
```
1. pdf_render.py --pages N → render page
2. Đọc image cho full visual comprehension
3. Cũng extract text từ pages N-1 và N+1 cho surrounding context
4. Walk through proof step by step
```

### "Tóm tắt paper này"
```
1. pdf_info.py → get TOC và page count
2. pdf_extract.py → full text extraction
3. Đọc abstract, intro, conclusion trước (text thường đủ)
4. Render figures/theorem pages как needed cho deeper understanding
5. Provide structured summary
```
