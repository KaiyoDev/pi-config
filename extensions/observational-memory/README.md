# Bộ nhớ quan sát

Extension này sống trong repo riêng:

**→ [pi-observational-memory](https://github.com/pi-observational-memory)**

Tiered, subprocess-backed memory cho pi. Parallel observers cô đọng conversation thành atomic observations, consolidator nâng cái cũ nhất thành durable `.memory/` topic files, và compaction là deterministic và model-free. Implementation của bản thân về observational-memory idea (xem Mastra).
