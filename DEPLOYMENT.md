# 🚀 Hướng dẫn Deploy DevTility lên Vercel

Tài liệu này hướng dẫn từng bước: deploy app → gắn **Blob Store** → gắn **Redis (Upstash)** → (tùy chọn) database khác & self-host engine chạy code.

> App được thiết kế **degrade gracefully**: thiếu bất kỳ storage nào vẫn chạy được (analytics chuyển sang in-memory, nút chia sẻ snippet báo "chưa bật"). Vì vậy bạn có thể deploy trước, gắn storage sau.

---

## 1. Deploy lần đầu

### Cách A — qua GitHub (khuyên dùng)

1. Push code lên GitHub:
   ```bash
   git remote add origin https://github.com/<username>/devtility.git
   git push -u origin master
   ```
2. Vào https://vercel.com/new → **Import** repo `devtility`.
3. Vercel tự nhận diện **Next.js** — giữ nguyên mọi thiết lập mặc định (không cần Build Command/Output tùy chỉnh).
4. Bấm **Deploy**. Xong — bạn có URL dạng `https://devtility.vercel.app`.

Từ đây, **mỗi lần `git push` sẽ tự động deploy**: push lên branch khác → Preview deployment; push lên branch production (mặc định `master`/`main`) → Production.

### Cách B — qua Vercel CLI

```bash
npm i -g vercel
```

```bash
vercel login
```

```bash
vercel --yes
```

Deploy production:

```bash
vercel --prod
```

---

## 2. Gắn Blob Store (chia sẻ code snippet)

Blob dùng cho tính năng **Chia sẻ** trong Code Editor (lưu snippet dưới dạng JSON object storage, truy cập qua link `?snippet=<id>`).

1. Vào **Vercel Dashboard → chọn project `devtility` → tab Storage**.
2. Bấm **Create Database / Browse Storage** → chọn **Blob** → **Create**.
3. Đặt tên (vd: `devtility-blob`) → chọn region gần người dùng (Singapore `sin1` cho VN) → **Create**.
4. Ở bước **Connect Project**: chọn project `devtility` + cả 3 môi trường (Production, Preview, Development) → **Connect**.
   - Vercel tự thêm biến môi trường `BLOB_READ_WRITE_TOKEN` vào project.
5. **Redeploy** (Deployments → ⋯ → Redeploy) để biến môi trường có hiệu lực.

Chạy local với Blob thật:

```bash
vercel env pull .env.local
```

(lệnh trên kéo toàn bộ env đã gắn về file `.env.local` — gồm cả Redis ở bước 3).

---

## 3. Gắn Redis — Upstash (analytics + cache tỷ giá)

Redis dùng cho: **đếm lượt truy cập** theo giờ/ngày/tháng/năm (INCR theo bucket, ZSET top trang) và **cache lịch sử tỷ giá** (immutable per-day values).

> Lưu ý: Vercel KV cũ đã ngừng — hiện Redis được cung cấp qua **Vercel Marketplace (Upstash)**. App hỗ trợ cả 2 kiểu tên biến (`UPSTASH_REDIS_REST_*` và `KV_REST_API_*`).

1. **Dashboard → project → Storage → Browse Storage** (hoặc https://vercel.com/marketplace/upstash).
2. Chọn **Upstash → Redis** (serverless, có free tier) → **Install/Create**.
3. Đặt tên (vd `devtility-redis`), chọn region **ap-southeast-1 (Singapore)**, plan Free.
4. **Connect Project** → chọn `devtility` + 3 môi trường → Connect.
   - Vercel tự inject `UPSTASH_REDIS_REST_URL` và `UPSTASH_REDIS_REST_TOKEN` (kèm `KV_REST_API_URL`/`KV_REST_API_TOKEN` tùy integration; app nhận cả hai).
5. **Redeploy**.

Kiểm tra: mở `https://<domain>/api/stats` — response JSON phải có `"backend":"redis"` (thay vì `"memory"`).

### Dữ liệu được tổ chức thế nào?

| Key | Ý nghĩa | TTL |
|---|---|---|
| `dt:pv:total` | Tổng pageview | ∞ |
| `dt:pv:h:2026072314` | Pageview theo giờ | 8 ngày |
| `dt:pv:d:20260723` | Theo ngày | 400 ngày |
| `dt:pv:m:202607` / `dt:pv:y:2026` | Theo tháng / năm | ∞ |
| `dt:pv:paths` (ZSET) | Top trang | ∞ |
| `dt:rates:<date>:<base>:<quote>` | Cache tỷ giá lịch sử | ∞ (immutable) |

Múi giờ bucketing mặc định `Asia/Ho_Chi_Minh` — đổi bằng env `ANALYTICS_TZ`.

---

## 4. (Tùy chọn) Database khác — khi nào cần?

Kiến trúc dùng **Repository pattern** (`src/server/analytics/types.ts`), nên khi cần chuyển analytics (hoặc thêm tính năng mới) sang database khác, chỉ cần viết 1 class implement `AnalyticsRepository` và đổi factory — UI/API giữ nguyên:

| Nhu cầu | Chọn gì trên Vercel Marketplace |
|---|---|
| Counters/cache tốc độ cao (hiện tại) | **Upstash Redis** ✅ |
| Dữ liệu quan hệ (users, saved data, query phức tạp) | **Neon** (Serverless Postgres) hoặc **Supabase** |
| Document/NoSQL linh hoạt schema | **MongoDB Atlas** |
| Object storage (file, ảnh, snippet) | **Vercel Blob** ✅ |

Các bước gắn tương tự mục 3: **Storage → Marketplace → chọn provider → Connect Project → Redeploy** (env tự inject).

---

## 5. (Tùy chọn) Engine chạy code — mở khóa Java 8–25

Mặc định Code Editor dùng **Wandbox** (wandbox.org — miễn phí, không cần key): OpenJDK 21/22, CPython 3.7–3.14. JavaScript luôn chạy ngay trong trình duyệt (Web Worker), không phụ thuộc server.

> Lưu ý: Piston công cộng (emkc.org) đã chuyển sang **whitelist-only từ 02/2026** nên không còn là mặc định.

Muốn đầy đủ **Java 8–25** + không giới hạn:

1. Self-host Piston (VPS/Fly.io/Railway có Docker):
   ```bash
   docker run -d --privileged -p 2000:2000 -v piston_packages:/piston/packages ghcr.io/engineer-man/piston
   ```
2. Cài các runtime cần (ví dụ):
   ```bash
   curl -X POST http://<host>:2000/api/v2/packages -H "Content-Type: application/json" -d '{"language":"java","version":"8.0.302"}'
   ```
   (lặp lại cho các version java/python muốn hỗ trợ — xem `GET /api/v2/packages` để biết danh sách)
3. Thêm env vào Vercel: **Settings → Environment Variables**
   - `EXECUTE_API_URL = http://<host>:2000/api/v2` → Redeploy.

UI tự đọc danh sách version từ `/api/execute/runtimes` — không cần sửa code.

---

## 6. Checklist sau khi deploy

- [ ] Trang chủ hiển thị đủ 12 công cụ, Dark/Light toggle hoạt động.
- [ ] `/tools/converters/currency` — có tỷ giá + biểu đồ (cần internet ra ngoài, không cần key).
- [ ] `/tools/technology/code-editor` — chạy thử JavaScript (browser) và Python (Piston).
- [ ] `/api/stats` — trả về `"backend":"redis"` sau khi gắn Redis.
- [ ] Nút **Chia sẻ** trong Code Editor trả về link sau khi gắn Blob.
- [ ] Mở trên điện thoại: menu drawer, mọi tool dùng được ở 360px.

## 7. Env variables tổng hợp

| Biến | Bắt buộc? | Nguồn | Dùng cho |
|---|---|---|---|
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Không | Marketplace Upstash | Analytics + cache tỷ giá |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Không | (biến thể tên cũ) | như trên |
| `BLOB_READ_WRITE_TOKEN` | Không | Vercel Blob | Chia sẻ snippet |
| `EXECUTE_API_URL` | Không | tự host | Engine chạy Java/Python |
| `ANALYTICS_TZ` | Không | tay | Múi giờ thống kê (mặc định Asia/Ho_Chi_Minh) |

> Sau khi thêm/sửa env trên Vercel luôn cần **Redeploy** để có hiệu lực.
