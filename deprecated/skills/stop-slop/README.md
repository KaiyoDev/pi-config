# Stop Slop

Skill loại bỏ AI tells khỏi prose.

<img width="3840" height="2160" alt="G-Yg4RVbIAAhVxW" src="https://github.com/user-attachments/assets/902afc15-1f40-4a9d-af24-8cd67afb8ebf" />

## Đây là gì

AI writing có patterns. Predictable phrases, structures, rhythms. Skill này dạy Claude (hoặc LLM nào cũng được) catch và remove chúng.

## Cấu trúc Skill

```
stop-slop/
├── SKILL.md              # Hướng dẫn core
├── references/
│   ├── phrases.md        # Phrases cần xóa
│   ├── structures.md     # Structural patterns cần tránh
│   └── examples.md       # Before/after transformations
├── README.md
└── LICENSE
```

## Quick start

**Claude Code:** Thêm folder này như skill.

**Claude Projects:** Upload `SKILL.md` và reference files vào project knowledge.

**Custom instructions:** Copy core rules từ `SKILL.md`.

**API calls:** Include `SKILL.md` trong system prompt của bạn. Reference files load on demand.

## Nó catch gì

**Banned phrases** - Throat-clearing openers, emphasis crutches, business jargon, all adverbs, vague declaratives, meta-commentary. Xem `references/phrases.md`.

**Structural clichés** - Binary contrasts, negative listings, dramatic fragmentation, rhetorical setups, false agency, narrator-from-a-distance voice, passive voice. Xem `references/structures.md`.

**Sentence-level rules** - Không Wh- sentence starters, không em dashes, không staccato fragmentation, không lazy extremes, active voice required.

## Scoring

Rate 1-10 trên mỗi dimension:

| Dimension | Question |
|-----------|----------|
| Directness | Statements hay announcements? |
| Rhythm | Varied hay metronomic? |
| Trust | Respects reader intelligence? |
| Authenticity | Sounds human? |
| Density | Có gì cuttable không? |

Dưới 35/50: revise.

## Tác giả

[Hardik Pandya](https://hvpandya.com)

## License

MIT. Dùng tự do, chia sẻ rộng rãi.
