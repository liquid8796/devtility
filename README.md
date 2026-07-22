# DevTility ⚡

**Bộ công cụ tiện ích online cho lập trình viên & người dùng Việt** — chuyển đổi, máy tính, lịch vạn niên, code editor… trong một giao diện hiện đại, mượt mà, hỗ trợ Dark/Light mode và responsive hoàn chỉnh trên mobile.

> 🔗 Deploy trên [Vercel](https://vercel.com) · 📖 Lịch sử thay đổi: [CHANGELOG.md](CHANGELOG.md) · 🚀 Hướng dẫn triển khai: [DEPLOYMENT.md](DEPLOYMENT.md)

## ✨ Tính năng

### 🔄 Chuyển đổi (Converters)
| Công cụ | Mô tả |
|---|---|
| **Múi giờ** | Chuyển giờ địa phương ↔ mọi timezone IANA, chế độ "bây giờ" cập nhật realtime, xử lý DST chuẩn |
| **Epoch / Unix time** | Epoch ↔ ngày giờ (tự nhận diện giây/ms/µs), ISO 8601, RFC 2822, thời gian tương đối |
| **Tỷ giá & Crypto** | 200+ tiền tệ + crypto (BTC, ETH…), tỷ giá cập nhật theo ngày, biểu đồ lịch sử 7D/1M/3M/1Y |
| **Hệ cơ số & ASCII** | Binary/Octal/Decimal/Hex + hệ 2–36 tùy chọn, hỗ trợ phần thập phân, văn bản ⇄ bytes UTF-8 |
| **Đơn vị đo lường** | Chiều dài, diện tích, thể tích, khối lượng, nhiệt độ (°C ↔ °F ↔ K) — chính xác bằng Decimal |

### 🧰 Tiện ích (Utilities)
| Công cụ | Mô tả |
|---|---|
| **Máy tính** | Cơ bản + Khoa học (sin/cos/tan, log, lũy thừa, căn, giai thừa…), lịch sử tính toán, bộ nhớ MC/MR/M+/M−, **xử lý floating-point chính xác** (0.1 + 0.2 = 0.3) |
| **Tính tuổi** | Chính xác đến giây: năm/tháng/tuần/ngày/giờ/phút/giây + đếm ngược sinh nhật |
| **Lãi kép** | Tính tiền gửi tiết kiệm theo lãi suất, kỳ hạn, tần suất ghép lãi + bảng chi tiết theo năm |
| **Lương Net ⇄ Gross** | Theo quy định BHXH/BHYT/BHTN + thuế TNCN lũy tiến Việt Nam (chế độ 2025 & 2026), bảng diễn giải + chi phí doanh nghiệp |
| **Lịch vạn niên** | Âm lịch (thuật toán thiên văn Hồ Ngọc Đức), can chi, tiết khí, giờ hoàng đạo, ngày hoàng/hắc đạo, đổi dương ↔ âm |

### 💻 Technology
- **Code Editor Online** — soạn thảo với syntax highlighting (CodeMirror 6), chạy **Java, Python** (server qua Piston) và **JavaScript** (Web Worker sandbox ngay trong trình duyệt), chia sẻ snippet qua Vercel Blob.

### 📊 Thống kê
- Đếm lượt truy cập theo **giờ / ngày / tháng / năm** (Redis), biểu đồ + top trang được xem nhiều nhất. Không dùng cookie.

## 🏗️ Kiến trúc

```
src/
├── app/                    # Next.js App Router (pages + API routes)
│   ├── tools/[category]/[slug]/   # 1 dynamic route cho MỌI công cụ
│   └── api/                # track, stats, rates, execute, snippets
├── components/
│   ├── layout/             # AppShell, SidebarNav (registry-driven)
│   ├── theme/              # Dark/Light (next-themes)
│   └── ui/                 # Card, Button, Field, Tabs… (primitives)
├── features/<slug>/        # Mỗi công cụ 1 thư mục độc lập (client components)
│   └── registry.tsx        # slug → lazy-loaded component
├── lib/                    # Domain logic THUẦN (không phụ thuộc UI)
│   ├── registry/           # ⭐ Single source of truth: categories + tools
│   ├── math/decimal.ts     # Decimal.js wrapper (chống lỗi floating-point)
│   ├── calendar/           # Thuật toán âm lịch + can chi
│   ├── convert/            # Hệ cơ số, đơn vị đo
│   └── salary/             # Thuế TNCN + bảo hiểm VN
└── server/                 # Server-side (Repository & Strategy pattern)
    ├── analytics/          # AnalyticsRepository: Redis ⇄ in-memory
    ├── rates/              # RateProvider: fawazahmed0 CDN + cache Redis
    ├── execute/            # ExecutionProvider: Piston (thay được qua env)
    ├── snippets/           # Vercel Blob store
    └── storage/            # Redis client factory
```

**Design patterns chính**

- **Registry pattern** — `src/lib/registry/tools.ts` là nguồn chân lý duy nhất: sidebar, trang chủ, breadcrumb, static params, metadata đều derive từ đây. **Thêm công cụ mới = 1 entry registry + 1 thư mục feature.**
- **Repository pattern** — analytics trừu tượng hóa storage; đổi Redis → Postgres/Mongo chỉ cần một implementation mới.
- **Strategy pattern** — nguồn tỷ giá và engine thực thi code đều là interface, swap qua env không đụng UI.
- **Feature-folder isolation** — mỗi công cụ tự chứa UI + logic riêng, lazy-load theo route, không import chéo giữa các feature.

## 🚀 Chạy local

```bash
npm install
npm run dev
```

Mở http://localhost:3000. **Không cần cấu hình gì thêm** — analytics tự chuyển sang in-memory, tỷ giá gọi CDN công cộng, code editor dùng Piston công cộng. Muốn bật đầy đủ (Redis, Blob), copy `.env.example` → `.env.local` và điền credentials (xem [DEPLOYMENT.md](DEPLOYMENT.md)).

```bash
npm run build   # production build
npm run lint    # eslint
```

## 🧩 Thêm công cụ mới

1. Thêm entry vào `src/lib/registry/tools.ts` (slug, category, tên, mô tả, icon, keywords).
2. Tạo `src/features/<slug>/<slug>-tool.tsx` — client component, default export.
3. Đăng ký vào map trong `src/features/registry.tsx`.

Xong — route, sidebar, trang chủ, SEO metadata tự động có.

## 📄 License

Copyright © 2026 **Nam Tran**.

[PolyForm Noncommercial 1.0.0](LICENSE.md) — được phép sử dụng, chỉnh sửa, chia sẻ cho mục đích **phi thương mại**. **Nghiêm cấm sử dụng vào mục đích thương mại dưới mọi hình thức.**
