# Changelog

Tất cả thay đổi đáng chú ý của DevTility được ghi lại tại đây.

Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), phiên bản theo [Semantic Versioning](https://semver.org/lang/vi/).

## [1.3.0] — 2026-07-23

### Added — 12 công cụ mới trong category Technology
- **JSON Toolkit**: format/minify/validate (chỉ ra dòng:cột lỗi), tree view thu gọn được, sort key đệ quy, escape/unescape.
- **JSON Converter**: JSON ⇄ YAML ⇄ XML ⇄ TOML ⇄ CSV (pivot qua object, cảnh báo chuyển đổi lossy).
- **JWT Inspector**: decode header/payload, bảng claims exp/nbf/iat/iss/aud với trạng thái hết hạn, verify HS256/384/512 bằng secret hoặc RS/ES bằng JWK, tạo & ký JWT mới.
- **Base64 & URL**: Base64 thường/URL-safe chuẩn UTF-8, URL encode/decode, phân tích query string.
- **UUID Toolkit**: sinh UUID v4/v7, ULID, NanoID (hàng loạt tới 1000), validate + trích timestamp từ v7/ULID.
- **Regex Tester**: highlight match trực tiếp, bảng capture groups (có named groups), replace preview, bảng tra cứu nhanh, sinh snippet JavaScript/Java/Python.
- **Diff Checker**: text diff theo dòng/từ/ký tự (bỏ qua whitespace/hoa thường) và JSON semantic diff liệt kê thay đổi theo path.
- **Cron Builder**: visual builder 5 trường, giải thích biểu thức bằng ngôn ngữ tự nhiên (vi/en), preset phổ biến, 10 lần chạy tiếp theo theo timezone chọn.
- **Hash & HMAC**: MD5/SHA-1/SHA-256/SHA-512, HMAC (hex + Base64), checksum file xử lý ngay trong trình duyệt, bcrypt verify + generate.
- **SQL Formatter**: format/minify với dialect MySQL/PostgreSQL/Oracle, keyword case, syntax highlight tự viết không thêm dependency nặng.
- **cURL Converter**: parse cURL đầy đủ (Postman export, multiline, -F, -u, --json…) và grpcurl → request model chỉnh sửa được → sinh fetch, Axios, Java HttpClient, Spring WebClient, cURL chuẩn hóa.
- **OpenAPI Viewer**: đọc spec JSON/YAML (OpenAPI 3.x + Swagger 2 cơ bản), duyệt endpoint theo tag với tìm kiếm/lọc method, sinh example từ schema ($ref, enum) và request mẫu cURL/fetch.

Tất cả chạy hoàn toàn phía client (không gửi dữ liệu lên server), song ngữ Việt/Anh, dark/light, responsive.

## [1.2.1] — 2026-07-23

### Changed
- Gỡ đoạn gợi ý/ghi chú engine ở cuối trang Code Editor và dòng "Backend / cookie" ở cuối trang Thống kê (gọn giao diện; kiểm tra backend Redis chuyển sang `/api/stats`).

### Fixed
- Icon refresh (Tỷ giá, Thống kê) giờ luôn xoay khi bấm — component `RefreshButton` dùng chung, xoay tối thiểu 800ms kể cả khi phản hồi quá nhanh (nút ở trang Tỷ giá trước đây hoàn toàn không có animation).

## [1.2.0] — 2026-07-23

### Added
- **Code completion kiểu IntelliJ IDEA** cho Code Editor với 3 chế độ: Tắt / **Basic** (từ khóa + định danh trong file) / **Smart** (mặc định — thêm live templates `sout`, `psvm`, `fori`, `iter`…, API/JDK phổ biến, gợi ý member sau dấu chấm; JavaScript có scope-aware completion thật qua `scopeCompletionSource`). Kích hoạt khi gõ hoặc Ctrl+Space; lựa chọn được lưu localStorage.

## [1.1.0] — 2026-07-23

### Added
- **Giao diện song ngữ Việt / Anh**: nút chuyển VI/EN trên header, lưu lựa chọn vào localStorage, đổi ngôn ngữ tức thì không reload. Toàn bộ 12 công cụ, sidebar, trang chủ, thông báo lỗi và định dạng số (1.234,56 ⇄ 1,234.56) đều theo ngôn ngữ đã chọn.
- Hạ tầng i18n nhẹ không phụ thuộc thư viện: `Localized {vi, en}` + hook `useI18n()` (useSyncExternalStore, SSR-safe), registry công cụ song ngữ.

### Changed
- `formatNumber` / `formatDecimalVN` / helpers tỷ giá nhận thêm tham số `locale`.

## [1.0.1] — 2026-07-23

### Changed
- Copyright ở footer, README và LICENSE thuộc về **Nam Tran** (thêm `SITE.author` + metadata `authors`).

## [1.0.0] — 2026-07-23

🎉 **Phát hành đầu tiên.**

### Added — Nền tảng
- Scaffold Next.js 16 (App Router) + React 19 + TypeScript strict + Tailwind CSS v4.
- Design system: CSS variables 2 theme (Light/Dark qua `next-themes`), nền lưới kỹ thuật + glow, hiệu ứng fade-up, gradient text, focus ring, reduced-motion.
- **Tool Registry** (`src/lib/registry`) — single source of truth cho category/tool; sidebar, trang chủ, breadcrumb, static params, SEO metadata đều derive tự động.
- AppShell responsive: header sticky + sidebar desktop + drawer mobile, hỗ trợ đến 360px.
- UI primitives: Card, Button, Field/Input/Select/TextArea, Tabs, CopyButton, ToolPage.
- Wrapper `Decimal` (decimal.js, precision 40) chống lỗi làm tròn floating-point cho mọi phép tính.

### Added — Chuyển đổi
- **Múi giờ**: giờ địa phương ↔ mọi timezone IANA, live "bây giờ", offset UTC, chênh lệch ngày, xử lý DST.
- **Epoch/Unix time**: epoch hiện tại realtime; epoch → ngày giờ (auto giây/ms/µs, ISO 8601, RFC 2822, tương đối tiếng Việt); ngày giờ → epoch theo timezone.
- **Tỷ giá & Crypto**: 200+ tiền tệ + crypto, chuyển đổi 2 chiều, biểu đồ 7D/1M/3M/1Y (nguồn mở fawazahmed0/exchange-api, cache 2 lớp Next Data Cache + Redis).
- **Hệ cơ số & ASCII**: cơ số 2–36 (BigInt + phần thập phân Decimal), nhóm nibble, văn bản ⇄ bytes UTF-8 (bin/oct/dec/hex).
- **Đơn vị đo lường**: chiều dài, diện tích, thể tích, khối lượng (yến/tạ/tấn…), nhiệt độ °C/°F/K; bảng "tất cả đơn vị" live.

### Added — Tiện ích
- **Máy tính Cơ bản & Khoa học**: tokenizer + shunting-yard trên Decimal; sin/cos/tan (DEG/RAD), log/ln, lũy thừa, căn, giai thừa, %, π, e; lịch sử tính toán (localStorage, 50 mục); bộ nhớ MC/MR/M+/M−/MS; hỗ trợ bàn phím.
- **Tính tuổi**: chính xác năm/tháng/ngày + tổng tháng/tuần/ngày/giờ/phút/giây, live từng giây, sinh nhật tiếp theo (xử lý 29/02).
- **Lãi kép tiết kiệm**: mô phỏng theo tháng với gửi thêm định kỳ, tần suất ghép lãi (tháng/quý/6 tháng/năm), bảng chi tiết theo năm.
- **Lương Net ⇄ Gross (VN)**: BHXH 8% / BHYT 1.5% / BHTN 1% với trần 20× lương cơ sở & 20× lương tối thiểu vùng; thuế TNCN lũy tiến 7 bậc; chế độ giảm trừ 2025 (11tr/4.4tr) & 2026 (15.5tr/6.2tr); bảng diễn giải từng bậc + chi phí doanh nghiệp; Net→Gross bằng binary search chính xác 1 ₫.
- **Lịch vạn niên**: thuật toán thiên văn Hồ Ngọc Đức (1900–2199, đã kiểm chứng Tết 2024/2025/2026 + 200 roundtrip); can chi năm/tháng/ngày, tiết khí, giờ hoàng đạo, ngày hoàng/hắc đạo (12 sao); lịch tháng + đổi dương ↔ âm (hỗ trợ tháng nhuận).

### Added — Technology
- **Code Editor Online**: CodeMirror 6, theme VS Code sáng/tối theo app; Java & Python chạy qua Piston API (Strategy pattern — đổi provider bằng `EXECUTE_API_URL`); JavaScript chạy trong Web Worker sandbox ngay trên trình duyệt (timeout 5s); stdin; chia sẻ snippet qua **Vercel Blob** (link `?snippet=<id>`).

### Added — Thống kê & hạ tầng
- Đếm pageview không cookie: beacon → Redis (Upstash) theo bucket giờ/ngày/tháng/năm + top trang; fallback in-memory khi thiếu cấu hình (Repository pattern).
- Dashboard thống kê: tiles tổng quan, bar chart theo 4 khung thời gian, bảng top 10 trang.
- API: `/api/track`, `/api/stats`, `/api/rates/{currencies,latest,history}`, `/api/execute{,/runtimes}`, `/api/snippets`.

### Docs
- README (kiến trúc + hướng dẫn mở rộng), DEPLOYMENT.md (Vercel + Blob + Redis), LICENSE (PolyForm Noncommercial 1.0.0 — cấm thương mại), `.env.example`.

---

<!--
Mẫu cho phiên bản tiếp theo:

## [x.y.z] — YYYY-MM-DD
### Added      — tính năng mới
### Changed    — thay đổi hành vi hiện có
### Fixed      — sửa lỗi
### Removed    — gỡ bỏ
### Security   — vá bảo mật
-->
