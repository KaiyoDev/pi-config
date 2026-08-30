# Tiện ích mở rộng browser pi

Trình duyệt Chromium headless điều khiển bởi Playwright mà pi có thể điều khiển trực tiếp. Cho phép agent gỡ lỗi SPA live giống cách con người làm trong devtools: điều hướng, chạy JS, kiểm tra localStorage, theo dõi console và network, điền form, click.

## Tại sao có extension này

Khi một lỗi frontend chỉ còn là "localStorage chứa gì?" hoặc "header `Authorization` mà supabase-js đính kèm là gì?", agent hiện phải yêu cầu user dán output từ console và curls. Với extension này, nó có thể tự trả lời những câu hỏi đó.

## Cài đặt

```bash
cd ~/.pi/agent/extensions/browser
npm install
npx playwright install chromium    # tải browser binary một lần (~150MB)
```

Sau đó `/reload` trong pi (hoặc restart). Các công cụ mới (`browser_goto`, `browser_eval`, …) xuất hiện trong `pi.getAllTools()` tự động vì folder nằm dưới `~/.pi/agent/extensions/`.

## Mặc định tắt, kích hoạt theo phiên

Các công cụ browser tốn ~800 tokens trong system prompt (snippets + guidelines) nhưng chỉ hữu ích ở số ít phiên làm việc liên quan đến điều khiển SPA live. Vì vậy chúng được đăng ký nhưng **không hoạt động** mặc định: vô hình với agent, không thể gọi, không có prompt snippets hay guidelines.

Bật chúng khi thực sự cần:

```
/browser on        # bật
/browser           # trạng thái
/browser off       # tắt và đóng headless browser
```

Bit enable tồn tại cho phiên hiện tại qua custom session entry, nên `/reload` và pi restart giữ nguyên. `/new` reset về off. Tắt cũng tear down Chromium context (semantics `browser_close`) nên không để browser background chạy lạc.

## Công cụ

(Chỉ hiển thị với agent khi `/browser on`.)

| Công cụ | Mục đích |
|---|---|
| `browser_goto`       | Điều hướng đến URL. Trả về `{ status, finalUrl }`. |
| `browser_eval`       | Chạy JS trong page. Expression, function source, hoặc IIFE đã gọi — cả ba đều hoạt động. Return value phải JSON-serializable. |
| `browser_console`    | Drain buffered console + pageerror entries (filterable, bounded 1000). |
| `browser_network`    | Drain buffered network requests. Output mặc định ngắn gọn (`status method url`); truyền `verbose: true` và/hoặc `includeHeaders: [...]` để inline curated request/response headers trên mỗi row. |
| `browser_fill`       | Gõ giá trị vào input matched bởi selector. |
| `browser_click`      | Click element (CSS, `text=...`, `role=...`). |
| `browser_screenshot` | Lưu PNG vào tempdir và trả về path; pi có thể `read` để xem. |
| `browser_close`      | Kill persistent context. |

Tất cả công cụ touch page được serialize qua single internal queue, nên an toàn khi fire nhiều `browser_*` calls trong một batch — chúng chạy theo submission order trên shared Page thay vì racing nhau.

Lệnh `/browser` cũng kiểm soát enable gate (`on` / `off` / bare để status; `close` và `kill` là aliases của `off`).

## Trạng thái

- Browser state (cookies, localStorage, IndexedDB) được persist vào `~/.pi/agent/extensions/browser/.profile` qua `chromium.launchPersistentContext`. Login sessions tồn tại qua các lần quay pi và khởi động lại pi.
- Console + network events được capture vào in-memory ring buffers (max 1000 entries mỗi cái). `browser_console` và `browser_network` drain chúng mặc định.
- Persistent context được đóng trong `session_shutdown`, nên `/new` hoặc pi exit clean up. User-data dir trên disk được giữ nguyên.

## Cài đặt

| Biến môi trường | Mặc định | Tác dụng |
|---|---|---|
| `PI_BROWSER_HEADFUL` | chưa đặt | Nếu đặt, launch visible Chromium window. Hữu ích khi debugging extension本身. |
| `PI_BROWSER_PROFILE` | `~/.pi/agent/extensions/browser/.profile` | Override persistent user-data dir. Đặt về tempdir cho ephemeral sessions. |

## Output network: gọn nhẹ mặc định, headers khi chọn

`browser_network` giữ default text payload tối giản — một dòng cho mỗi request, `status method url` — vì một lần tải trang SPA đơn lẻ kích hoạt 30–100 subresource requests và inline headers trên tất cả sẽ làm context window của agent ngập trong nhiễu.

Khi bạn thực sự muốn headers (use case auth-debugging), chọn:

- `verbose: true` — inline curated set của request/response headers trên mỗi returned row. Curated set nhỏ có chủ đích:

  ```
  authorization, apikey, content-type, x-client-info, accept-profile,
  content-profile, prefer, location, www-authenticate, retry-after
  ```

- `includeHeaders: ["cookie", "cache-control", ...]` — extend curated set cho call này chỉ (case-insensitive). Implies `verbose: true`.

Tất cả headers được capture vào ring buffer bất kể; `verbose` / `includeHeaders` chỉ ảnh hưởng what được render vào text output. Best paired với `urlFilter` / `status` để headers chỉ xuất hiện trên rows bạn thực sự quan tâm.

Clear-on-read drain **toàn bộ** buffer mặc định, không chỉ rows returned. Điều này có chủ đích: subsequent calls quan sát fresh activity window thay vì re-walking cùng subresource noise. Truyền `clear: false` để peek mà không drain.

## Hạn chế đã biết

- `playwright-core` được cung cấp không có browser binaries; bước `npx playwright install chromium` ở trên là bắt buộc đúng một lần cho mỗi máy.
- Page object là singleton — không có tab/window management. Nếu bạn cần nhiều tab, extend `ensurePage` để accept tab id.
- `browser_eval` evaluate source một lần và, nếu result là function, gọi nó. Vậy expressions (`localStorage.length`), function values (`() => doStuff()`), và đã gọi IIFEs (`(() => 42)()`) đều làm những gì bạn mong đợi. Note: top-level `return` và multi-statement bodies không phải valid expressions — wrap chúng trong `(() => { ... })()`.
- Với DOM nodes, return primitive properties (`.outerHTML`, `.textContent`, `.value`) thay vì node本身; Playwright serialize nodes thành opaque sentinel `"ref: <Node>"`.
- `browser_eval` trả về `undefined` как `null` sau JSON serialization. Wrap expressions trong function trả về sentinel nếu bạn quan tâm.
- `browser_click`: CSS attribute selectors match HTML attributes, không phải DOM properties. `button[type=submit]` sẽ KHÔNG match `<button>Submit</button>` ngay cả khi button đó có `.type === "submit"` mặc định. Prefer `text=Submit` hoặc `role=button[name=Submit]` cho semantic matching.
- `browser_network` show `ERR net::ERR_ABORTED` cho fetches whose body was never consumed (vd `await fetch(url)` không có `.text()` / `.json()`). Chromium cancel body stream và Playwright báo `requestfailed` ngay cả khi JS side thấy response thành công. Consume body nếu bạn muốn clean status row.
- Network buffer capture headers không phải bodies. Thêm `request.postData()` / `response.text()` capture nếu bạn cần bodies (sẽ ingest context nhanh — gate nó sau flag).
- Chưa có download / file-upload helpers. Thêm khi cần.
- OTP / 2FA: extension không có mail integration. Human vẫn phải paste code vào `browser_fill`.

## Tính năng có thể thêm sau

- `browser_wait_for(selector|url)` cho explicit synchronization.
- `browser_request_body` để expose request/response bodies on demand không làm ballooning default network buffer.
- Mail-fetch tool (Gmail API hoặc Mailpit) để OTP logins có thể fully automated.
- `fly_logs` companion tool — `flyctl logs -a <app>` tailed vào similar ring buffer — để agent có thể correlate frontend behavior với backend errors không cần context switching.
