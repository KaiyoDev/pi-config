---
name: web-debug
description: "Gỡ lỗi hoặc xác minh frontend behavior bằng cách lái live page (DOM, storage, network, console) với browser_* tools thay vì đọc source hoặc yêu cầu user paste từ devtools. Dùng khi user báo cáo: broken login hoặc auth flow, failed/401/403/CORS requests, JWT hoặc session weirdness, form không submit được, button không hoạt động, blank screen, hydration mismatch, stale data, 'works locally / fails in prod', hoặc yêu cầu xác minh frontend change end-to-end."
---

# Web debugging qua live page

Bạn có một real headless browser. Hãy dùng nó. Default failure mode là đọc source, form hypothesis, và yêu cầu user verify trong devtools của họ. Cái đó chậm và sai: answer thường sống trong runtime state (localStorage, actual `Authorization` header SPA gửi, console error), không phải source.

## Khi nào dùng bộ công cụ này

Pattern-match cách diễn đạt của user với playbook bên dưới. Nếu description của họ sounding like *anything* trong list này, mở browser trước, theorize sau.

| User nói gì đó như… | First move |
|---|---|
| "Tôi không thể login" / "login bị broken" / "auth không work" | [Auth flow](#auth-flow-không-hoạt-động) |
| "Tôi đang getting 401 / 403 / CORS error từ `/api/foo`" | [Bad request](#tại-sao-request-này-thất-bại) |
| "Session không persisting" / "logged out on refresh" | [Storage inspection](#thực-tế-có-gì-trong-storage) |
| "JWT này looks weird" / "wrong claims" | [JWT decode](#giải-mã-jwt-mà-không-rời-loop) |
| "Form không làm gì cả" / "submit button không work" | [Form not submitting](#form-không-submit) |
| "Blank screen" / "page không load" / "stuck loading" | [Blank screen](#màn-hình-trắng) |
| "Works on my machine" / "fails in prod" | [Reproduce in prod](#tái-tạo-trong-prod) |
| "Bạn có thể verify fix này không?" / "change của tôi có work không?" | [Verify a change](#xác-minh-thay-đổi-frontend-end-to-end) |

Nếu none của those match nhưng bug là *behavioral* (something user sees in browser), vẫn mở `browser_goto` trước. Bạn sẽ học được nhiều hơn trong ba tool calls hơn ba rounds của source-reading.

## Core loop

Mọi playbook bên dưới là variation trên cái này:

1. `browser_goto` đến URL relevant.
2. Drive action whatever reproduces bug (`browser_fill`, `browser_click`).
3. Drain observations: `browser_console`, `browser_network` (thường với `verbose: true` và `urlFilter`).
4. `browser_eval` để đọc runtime state không visible từ console/network.
5. Form hypothesis. Make code change. Re-run loop để verify.

State (cookies, localStorage, IndexedDB) persistent xuyên suốt `browser_*` calls, xuyên suốt turns, và xuyên suốt pi restarts — một session bạn mở earlier vẫn mở now. Đó là feature: đừng `browser_close` giữa các steps.

## Playbooks

### Auth flow không hoạt động

```
browser_goto      url=<login url>
browser_fill      selector=input[type=email]    value=<email>
browser_fill      selector=input[type=password] value=<password>
browser_click     selector=text=Sign in
browser_console                                          # any JS error?
browser_network   urlFilter=/auth     verbose=true       # what was POSTed, what came back?
browser_eval      expression=Object.keys(localStorage)   # did a session land?
```

Nếu network call tới `/auth/v1/token` trả về 200 nhưng không có session hiện trong localStorage, bug nằm ở client SDK's storage adapter, không phải server. Nếu network call trả về 400/401, bug ở upstream — đọc response status và request body.

### Tại sao request này thất bại

```
browser_goto      url=<app url>
# reproduce action fires failing request
browser_network   urlFilter=<route>   verbose=true
```

`verbose=true` hiển thị curated headers (`Authorization`, `apikey`, `content-type`, v.v.). Cho CORS, thêm `includeHeaders=["origin","access-control-request-method","access-control-request-headers"]`.

Common patterns headers reveal:
- Missing hoặc stale `Authorization` → check auth flow bên trên.
- `apikey` header missing trên Supabase call → client không được construct với anon key.
- Wrong `content-type` → client serialized body unexpectedly.
- 403 với `prefer: return=representation` → RLS, not auth.

### Thực tế có gì trong storage

```
browser_goto      url=<app url>
browser_eval      expression=Object.keys(localStorage)
browser_eval      expression=Object.fromEntries(Object.entries(localStorage))
browser_eval      expression=document.cookie
```

Riêng với Supabase session key là `sb-<projectref>-auth-token`. Nếu missing sau login, SDK chưa bao giờ写 nó (nghi ngờ storage adapter hoặc race). Nếu present nhưng stale, SDK không đọc nó lúc init.

### Giải mã JWT mà không rời loop

```
browser_eval expression=`(() => {
  const raw = localStorage.getItem('sb-<projectref>-auth-token');
  if (!raw) return null;
  const tok = JSON.parse(raw).access_token;
  const [h, p] = tok.split('.').slice(0, 2).map(s => JSON.parse(atob(s.replace(/-/g,'+').replace(/_/g,'/'))));
  return { header: h, payload: p, expiresIn: p.exp - Math.floor(Date.now()/1000) };
})()`
```

Hữu ích khi user báo "tôi đã login nhưng API nghĩ tôi là anon" — inspect `role`, `aud`, `exp` trực tiếp.

### Form không submit

```
browser_goto      url=<page>
browser_eval      expression=`[...document.forms].map(f => ({ action: f.action, method: f.method, valid: f.checkValidity() }))`
browser_click     selector=text=Submit
browser_console                                  # validation error? handler threw?
browser_network                                  # có gì fire không?
```

Nếu `checkValidity()` là `false`, form có HTML validation constraint chặn submit (thường là hidden `required` field). Nếu không gì fire trên click, không có handler bound (hydration issue, hoặc button outside form).

### Màn hình trắng

```
browser_goto      url=<page>
browser_console                                  # đây almost always là answer
browser_screenshot                               # confirm nó thực sự blank
browser_eval      expression=document.body.innerHTML.length
```

Blank screen với console errors almost always là runtime JS error trong lúc render (React/Vue/Svelte teardown tree trên uncaught errors). Blank screen với *không có* console errors và `innerHTML.length === 0` là routing hoặc build issue — fetch page với `web_fetch` và check served HTML.

### Tái tạo trong prod

Persistent profile có nghĩa là session bạn đã authenticate giữ nguyên authenticated. Vậy nên:

```
browser_goto      url=<prod url>
# bạn có thể đã login từ previous turn — check dulu
browser_eval      expression=Object.keys(localStorage)
# nếu không, chạy auth playbook chống prod
```

Sau đó reproduce failing action và compare `browser_network` output chống cùng action trong dev.

### Xác minh thay đổi frontend end-to-end

Đây là underused half của kit. Sau khi make code change ảnh hưởng behavior user có thể see:

```
browser_goto      url=<changed page>            # fresh load
# drive new behavior
browser_fill / browser_click как needed
browser_eval      expression=<assertion về resulting state>
browser_screenshot                              # nếu có visual claim
```

Đừng nói "done" nếu bạn chưa exercise change. Đọc source và nói "cái này nên work" là claim strictly weaker hơn "tôi đã drive nó và quan sát expected state."

## Pitfalls

Đây là những cái đã bite — internalize them.

- **`fetch()` không consume body** hiện lên как `ERR net::ERR_ABORTED` trong `browser_network`, ngay cả khi JS side thấy 200. Nếu bạn làm quick checks, làm `const r = await fetch(url); await r.text(); return r.status`.
- **DOM nodes không JSON-serialize.** Return primitive properties: `.outerHTML`, `.textContent`, `.value`, `.checked`. Không bao giờ return node本身 hoặc `document.body`.
- **`button[type=submit]` là HTML attribute selector**, không phải DOM property selector. Một `<button>Submit</button>` có DOM `.type === "submit"` mặc định, nhưng không có `type` attribute — selector sẽ không match. Dùng `text=Submit` hoặc `role=button[name=Submit]`.
- **`browser_console` / `browser_network` drain toàn bộ buffer mặc định.** Nếu bạn muốn đọc một thing không mất rest, truyền `clear: false`.
- **Top-level `return` và multi-statement bodies không phải expressions.** Wrap chúng trong `(() => { ... })()` khi passing đến `browser_eval`.

## Khi *không nên* dùng các công cụ này

- Nếu bạn chỉ cần đọc static content từ public URL, `web_fetch` nhanh hơn (không cần browser launch, không có profile state).
- Nếu question purely về source code, đọc source. Browser không cho bạn biết tại sao function được viết, chỉ những gì nó làm tại runtime.
- Nếu bạn cần verify behavior qua nhiều URLs ở scale, viết script và chạy nó với `bash` — browser kit dành cho interactive debugging, không phải batch crawling.
