/**
 * Can chi, giờ/ngày hoàng đạo và tiết khí — xây dựng trên nền `lunar.ts`.
 *
 * Toàn bộ quy tắc theo lịch pháp truyền thống Việt Nam: chu kỳ lục thập hoa
 * giáp cho năm/tháng/ngày, bảng giờ hoàng đạo theo chi của ngày, chu kỳ 12
 * sao (Thanh Long … Câu Trận) cho ngày hoàng đạo/hắc đạo, và 24 tiết khí
 * suy ra từ kinh độ mặt trời (bước 15°).
 */

import { getSunLongitudeRadians, VN_TIMEZONE } from "./lunar";

/** Mười thiên can. */
export const CAN = [
  "Giáp",
  "Ất",
  "Bính",
  "Đinh",
  "Mậu",
  "Kỷ",
  "Canh",
  "Tân",
  "Nhâm",
  "Quý",
] as const;

/** Mười hai địa chi. */
export const CHI = [
  "Tý",
  "Sửu",
  "Dần",
  "Mão",
  "Thìn",
  "Tỵ",
  "Ngọ",
  "Mùi",
  "Thân",
  "Dậu",
  "Tuất",
  "Hợi",
] as const;

/**
 * 24 tiết khí, đánh số theo kinh độ mặt trời bước 15°
 * (0 = Xuân phân tại 0°, 1 = Thanh minh tại 15°, …).
 */
export const TIET_KHI = [
  "Xuân phân",
  "Thanh minh",
  "Cốc vũ",
  "Lập hạ",
  "Tiểu mãn",
  "Mang chủng",
  "Hạ chí",
  "Tiểu thử",
  "Đại thử",
  "Lập thu",
  "Xử thử",
  "Bạch lộ",
  "Thu phân",
  "Hàn lộ",
  "Sương giáng",
  "Lập đông",
  "Tiểu tuyết",
  "Đại tuyết",
  "Đông chí",
  "Tiểu hàn",
  "Đại hàn",
  "Lập xuân",
  "Vũ thủy",
  "Kinh trập",
] as const;

/**
 * Chu kỳ 12 sao (Thập nhị trực tinh) khởi từ Thanh Long, dùng để xác định
 * ngày hoàng đạo/hắc đạo theo tháng âm lịch và chi của ngày.
 */
export const NGAY_HOANG_DAO_STARS = [
  "Thanh Long",
  "Minh Đường",
  "Thiên Hình",
  "Chu Tước",
  "Kim Quỹ",
  "Kim Đường",
  "Bạch Hổ",
  "Ngọc Đường",
  "Thiên Lao",
  "Huyền Vũ",
  "Tư Mệnh",
  "Câu Trận",
] as const;

/** Sao hoàng đạo trong chu kỳ 12 sao (theo thứ tự của `NGAY_HOANG_DAO_STARS`). */
const HOANG_DAO_STAR_INDEXES = new Set([0, 1, 4, 5, 7, 10]);

/**
 * Bảng giờ hoàng đạo truyền thống, mỗi chuỗi 12 ký tự ứng với 12 giờ
 * (Tý → Hợi), '1' = giờ hoàng đạo. Chỉ số bảng = chi của ngày % 6
 * (các cặp Tý/Ngọ, Sửu/Mùi, Dần/Thân, Mão/Dậu, Thìn/Tuất, Tỵ/Hợi
 * dùng chung một hàng).
 */
const GIO_HOANG_DAO_TABLE = [
  "110100101100", // Ngày Tý / Ngọ
  "001101001011", // Ngày Sửu / Mùi
  "110011010010", // Ngày Dần / Thân
  "101100110100", // Ngày Mão / Dậu
  "001011001101", // Ngày Thìn / Tuất
  "010010110011", // Ngày Tỵ / Hợi
] as const;

/** Một giờ hoàng đạo: tên chi và khung giờ tương ứng. */
export interface GioHoangDaoItem {
  /** Tên chi của giờ (Tý, Sửu, …). */
  chi: string;
  /** Khung giờ, ví dụ "23h-1h". */
  range: string;
  /** Chỉ số chi 0–11. */
  chiIndex: number;
}

/** Kết quả tra sao của ngày. */
export interface NgayHoangDaoResult {
  /** Tên sao trong chu kỳ 12 sao (Thanh Long, Minh Đường, …). */
  star: string;
  /** `true` nếu là ngày hoàng đạo. */
  isHoangDao: boolean;
}

/** Đánh giá chất lượng ngày: sao, hoàng/hắc đạo, nhãn hiển thị và giờ tốt. */
export interface DayQuality extends NgayHoangDaoResult {
  /** Nhãn hiển thị, ví dụ "Ngày hoàng đạo (Thanh Long)". */
  label: string;
  /** Danh sách 6 giờ hoàng đạo trong ngày. */
  gioHoangDao: GioHoangDaoItem[];
}

/**
 * Chỉ số can (0–9) của ngày Julius `jd`.
 */
export function canIndexOfDay(jd: number): number {
  return (jd + 9) % 10;
}

/**
 * Chỉ số chi (0–11) của ngày Julius `jd`.
 */
export function chiIndexOfDay(jd: number): number {
  return (jd + 1) % 12;
}

/**
 * Can chi của năm âm lịch, ví dụ `canChiOfYear(2025)` → "Ất Tỵ".
 *
 * @param lunarYear Năm âm lịch
 */
export function canChiOfYear(lunarYear: number): string {
  return `${CAN[(lunarYear + 6) % 10]} ${CHI[(lunarYear + 8) % 12]}`;
}

/**
 * Can chi của tháng âm lịch (tháng Giêng luôn là tháng Dần).
 * Tháng nhuận mang cùng can chi với tháng chính.
 *
 * @param lunarMonth Tháng âm lịch (1–12)
 * @param lunarYear Năm âm lịch
 */
export function canChiOfMonth(lunarMonth: number, lunarYear: number): string {
  const can = CAN[(lunarYear * 12 + lunarMonth + 3) % 10];
  const chi = CHI[(lunarMonth + 1) % 12];
  return `${can} ${chi}`;
}

/**
 * Can chi của ngày theo số ngày Julius, ví dụ ngày 1/1/2000 → "Mậu Ngọ".
 *
 * @param jd Số ngày Julius (từ `jdFromDate`)
 */
export function canChiOfDay(jd: number): string {
  return `${CAN[canIndexOfDay(jd)]} ${CHI[chiIndexOfDay(jd)]}`;
}

/** Khung giờ của giờ-chi thứ `i` (0 = Tý 23h-1h, 1 = Sửu 1h-3h, …). */
function hourRange(i: number): string {
  const start = (i * 2 + 23) % 24;
  const end = (i * 2 + 1) % 24;
  return `${start}h-${end}h`;
}

/**
 * Danh sách 6 giờ hoàng đạo của ngày Julius `jd`, tra theo bảng truyền thống
 * dựa trên chi của ngày.
 *
 * @param jd Số ngày Julius
 * @returns Mảng 6 phần tử `{ chi, range }`, ví dụ `{ chi: "Tý", range: "23h-1h" }`
 */
export function gioHoangDao(jd: number): GioHoangDaoItem[] {
  const dayChi = chiIndexOfDay(jd);
  const pattern = GIO_HOANG_DAO_TABLE[dayChi % 6];
  const result: GioHoangDaoItem[] = [];
  for (let i = 0; i < 12; i++) {
    if (pattern.charAt(i) === "1") {
      result.push({ chi: CHI[i], range: hourRange(i), chiIndex: i });
    }
  }
  return result;
}

/**
 * Vị trí chi khởi Thanh Long theo tháng âm lịch:
 * tháng 1&7 → Tý, 2&8 → Dần, 3&9 → Thìn, 4&10 → Ngọ, 5&11 → Thân, 6&12 → Tuất.
 */
function thanhLongStartChi(lunarMonth: number): number {
  return (((lunarMonth - 1) % 6) * 2) % 12;
}

/**
 * Tra sao (chu kỳ 12 sao) và xác định ngày hoàng đạo/hắc đạo.
 *
 * Với mỗi cặp tháng âm lịch (1&7, 2&8, 3&9, 4&10, 5&11, 6&12), chu kỳ 12 sao
 * Thanh Long → Câu Trận lần lượt ứng với 12 chi của ngày; sao hoàng đạo là
 * Thanh Long, Minh Đường, Kim Quỹ, Kim Đường, Ngọc Đường, Tư Mệnh.
 *
 * @param lunarMonth Tháng âm lịch (1–12); tháng nhuận dùng số tháng chính
 * @param dayChi Chỉ số chi của ngày (0–11, từ `chiIndexOfDay`)
 */
export function ngayHoangDao(lunarMonth: number, dayChi: number): NgayHoangDaoResult {
  const starIndex = (((dayChi - thanhLongStartChi(lunarMonth)) % 12) + 12) % 12;
  return {
    star: NGAY_HOANG_DAO_STARS[starIndex],
    isHoangDao: HOANG_DAO_STAR_INDEXES.has(starIndex),
  };
}

/**
 * Tiết khí đang diễn ra trong ngày Julius `jd`.
 *
 * Tính theo kinh độ mặt trời (bước 15°) tại thời điểm cuối ngày (0h địa
 * phương của ngày kế tiếp) — cùng quy ước với amlich của Hồ Ngọc Đức.
 *
 * @param jd Số ngày Julius
 * @param timeZone Múi giờ (mặc định +7)
 * @returns Tên tiết khí, ví dụ "Đại thử"
 */
export function tietKhi(jd: number, timeZone: number = VN_TIMEZONE): string {
  const index = Math.floor((getSunLongitudeRadians(jd + 1, timeZone) / Math.PI) * 12);
  return TIET_KHI[index % 24];
}

/**
 * Đánh giá tổng hợp chất lượng ngày: sao, hoàng/hắc đạo, nhãn hiển thị
 * ("Ngày hoàng đạo (Thanh Long)" / "Ngày hắc đạo (Bạch Hổ)") và danh sách
 * giờ hoàng đạo.
 *
 * @param jd Số ngày Julius
 * @param lunarMonth Tháng âm lịch chứa ngày đó (1–12)
 */
export function getDayQuality(jd: number, lunarMonth: number): DayQuality {
  const { star, isHoangDao } = ngayHoangDao(lunarMonth, chiIndexOfDay(jd));
  return {
    star,
    isHoangDao,
    label: isHoangDao ? `Ngày hoàng đạo (${star})` : `Ngày hắc đạo (${star})`,
    gioHoangDao: gioHoangDao(jd),
  };
}
