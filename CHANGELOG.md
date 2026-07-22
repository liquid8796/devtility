# Changelog

Tất cả thay đổi đáng chú ý của DevTility được ghi lại tại đây.

Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), phiên bản theo [Semantic Versioning](https://semver.org/lang/vi/).

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
