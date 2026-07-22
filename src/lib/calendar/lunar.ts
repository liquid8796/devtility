/**
 * Thuật toán âm lịch Việt Nam (múi giờ mặc định GMT+7).
 *
 * Cài đặt theo thuật toán nổi tiếng của Hồ Ngọc Đức ("amlich"), dựa trên các
 * chuỗi xấp xỉ thiên văn trong "Astronomical Algorithms" (Jean Meeus, 1998):
 * thời điểm sóc (new moon) và kinh độ mặt trời được tính trực tiếp, từ đó suy
 * ra tháng âm lịch, tháng nhuận theo quy tắc "tháng 11 âm lịch chứa Đông chí".
 *
 * Phạm vi hợp lệ: ít nhất 1900–2199. Tất cả hàm đều thuần (pure), không phụ
 * thuộc `Date` hay múi giờ hệ thống.
 */

/** Múi giờ Việt Nam (GMT+7) — giá trị mặc định cho mọi hàm bên dưới. */
export const VN_TIMEZONE = 7;

/** Kết quả đổi dương lịch sang âm lịch. */
export interface LunarDate {
  /** Ngày âm lịch (1–30). */
  day: number;
  /** Tháng âm lịch (1–12). */
  month: number;
  /** Năm âm lịch. */
  year: number;
  /** `true` nếu là tháng nhuận. */
  leap: boolean;
}

/** Phần nguyên (làm tròn xuống) — dùng thống nhất trong toàn bộ thuật toán. */
const INT = Math.floor;

const PI = Math.PI;

/** Độ dài trung bình của một tháng giao hội (ngày). */
const SYNODIC_MONTH = 29.530588853;

/** JDN của điểm sóc gốc dùng làm mốc đánh số kỳ sóc `k`. */
const NEW_MOON_EPOCH = 2415021.076998695;

/**
 * Đổi ngày dương lịch sang số ngày Julius (Julian Day Number).
 *
 * Áp dụng đúng công thức lịch Gregory/Julius cổ điển: các ngày sau
 * 5/10/1582 dùng lịch Gregory, trước đó dùng lịch Julius.
 *
 * @param dd Ngày (1–31)
 * @param mm Tháng (1–12)
 * @param yy Năm dương lịch
 * @returns Số ngày Julius (số nguyên, ứng với 12:00 UT của ngày đó)
 */
export function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = INT((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd =
    dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
  if (jd < 2299161) {
    jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  }
  return jd;
}

/**
 * Đổi số ngày Julius về ngày dương lịch.
 *
 * @param jd Số ngày Julius (số nguyên)
 * @returns Bộ ba `[ngày, tháng, năm]` dương lịch
 */
export function jdToDate(jd: number): [number, number, number] {
  let a: number;
  let b: number;
  let c: number;
  if (jd > 2299160) {
    // Sau 5/10/1582: lịch Gregory
    a = jd + 32044;
    b = INT((4 * a + 3) / 146097);
    c = a - INT((b * 146097) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  const d = INT((4 * c + 3) / 1461);
  const e = c - INT((1461 * d) / 4);
  const m = INT((5 * e + 2) / 153);
  const day = e - INT((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * INT(m / 10);
  const year = b * 100 + d - 4800 + INT(m / 10);
  return [day, month, year];
}

/**
 * Tính ngày (theo giờ địa phương) chứa điểm sóc thứ `k` kể từ 1/1/1900.
 *
 * Dùng chuỗi xấp xỉ thiên văn chuẩn (Meeus) với hiệu chỉnh nhiễu loạn và
 * delta-T như trong amlich của Hồ Ngọc Đức. `k = 0` ứng với điểm sóc đầu
 * tiên sau ngày 1/1/1900.
 *
 * @param k Số thứ tự kỳ sóc
 * @param timeZone Múi giờ (mặc định +7)
 * @returns JDN của ngày chứa điểm sóc theo giờ địa phương
 */
export function getNewMoonDay(k: number, timeZone: number = VN_TIMEZONE): number {
  const T = k / 1236.85; // Thế kỷ Julius kể từ 1900 January 0.5
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 = Jd1 + 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  // Trung bình dị thường của mặt trời
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  // Trung bình dị thường của mặt trăng
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  // Đối số vĩ độ của mặt trăng
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 = C1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  let deltat: number;
  if (T < -11) {
    deltat = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3;
  } else {
    deltat = -0.000278 + 0.000265 * T + 0.000262 * T2;
  }
  const JdNew = Jd1 + C1 - deltat;
  return INT(JdNew + 0.5 + timeZone / 24);
}

/**
 * Kinh độ mặt trời (radian, chuẩn hóa về [0, 2π)) tại 0h địa phương
 * của ngày `jdn`.
 *
 * @param jdn Số ngày Julius
 * @param timeZone Múi giờ (mặc định +7)
 */
export function getSunLongitudeRadians(jdn: number, timeZone: number = VN_TIMEZONE): number {
  // Thế kỷ Julius kể từ J2000 (2000-01-01 12:00 UT)
  const T = (jdn - 2451545.5 - timeZone / 24) / 36525;
  const T2 = T * T;
  const dr = PI / 180;
  // Trung bình dị thường (độ)
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  // Kinh độ trung bình (độ)
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = L0 + DL; // Kinh độ thực (độ)
  L = L * dr;
  L = L - PI * 2 * INT(L / (PI * 2)); // Chuẩn hóa về [0, 2π)
  return L;
}

/**
 * Kinh độ mặt trời tại 0h địa phương của ngày `jdn`, tính theo đơn vị 30°.
 *
 * @param jdn Số ngày Julius
 * @param timeZone Múi giờ (mặc định +7)
 * @returns Số nguyên 0–11 (0: Xuân phân → 30°, 1: 30°–60°, …)
 */
export function getSunLongitude(jdn: number, timeZone: number = VN_TIMEZONE): number {
  return INT((getSunLongitudeRadians(jdn, timeZone) / PI) * 6);
}

/**
 * Tìm ngày bắt đầu tháng 11 âm lịch của năm dương lịch `yy`
 * (tháng âm lịch chứa Đông chí).
 *
 * @param yy Năm dương lịch
 * @param timeZone Múi giờ (mặc định +7)
 * @returns JDN của ngày mồng 1 tháng 11 âm lịch
 */
export function getLunarMonth11(yy: number, timeZone: number = VN_TIMEZONE): number {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = INT(off / SYNODIC_MONTH);
  let nm = getNewMoonDay(k, timeZone);
  const sunLong = getSunLongitude(nm, timeZone); // Kinh độ mặt trời lúc 0h ngày sóc
  if (sunLong >= 9) {
    nm = getNewMoonDay(k - 1, timeZone);
  }
  return nm;
}

/**
 * Xác định vị trí tháng nhuận sau tháng 11 âm lịch bắt đầu tại `a11`.
 *
 * Tháng nhuận là tháng đầu tiên không chứa trung khí (kinh độ mặt trời
 * không đổi bước 30° giữa hai ngày sóc liên tiếp).
 *
 * @param a11 JDN mồng 1 tháng 11 âm lịch của năm trước
 * @param timeZone Múi giờ (mặc định +7)
 * @returns Khoảng cách (số tháng) từ tháng 11 tới tháng nhuận
 */
export function getLeapMonthOffset(a11: number, timeZone: number = VN_TIMEZONE): number {
  const k = INT((a11 - NEW_MOON_EPOCH) / SYNODIC_MONTH + 0.5);
  let last: number;
  let i = 1; // Bắt đầu từ tháng ngay sau tháng 11
  let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  do {
    last = arc;
    i++;
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  } while (arc !== last && i < 14);
  return i - 1;
}

/**
 * Đổi ngày dương lịch sang âm lịch.
 *
 * @param dd Ngày dương lịch
 * @param mm Tháng dương lịch
 * @param yy Năm dương lịch
 * @param timeZone Múi giờ (mặc định +7)
 * @returns Ngày âm lịch `{ day, month, year, leap }`
 */
export function convertSolar2Lunar(
  dd: number,
  mm: number,
  yy: number,
  timeZone: number = VN_TIMEZONE,
): LunarDate {
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = INT((dayNumber - NEW_MOON_EPOCH) / SYNODIC_MONTH);
  let monthStart = getNewMoonDay(k + 1, timeZone);
  if (monthStart > dayNumber) {
    monthStart = getNewMoonDay(k, timeZone);
  }
  let a11 = getLunarMonth11(yy, timeZone);
  let b11 = a11;
  let lunarYear: number;
  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = getLunarMonth11(yy - 1, timeZone);
  } else {
    lunarYear = yy + 1;
    b11 = getLunarMonth11(yy + 1, timeZone);
  }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = INT((monthStart - a11) / 29);
  let lunarLeap = false;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, timeZone);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff) {
        lunarLeap = true;
      }
    }
  }
  if (lunarMonth > 12) {
    lunarMonth = lunarMonth - 12;
  }
  if (lunarMonth >= 11 && diff < 4) {
    lunarYear -= 1;
  }
  return { day: lunarDay, month: lunarMonth, year: lunarYear, leap: lunarLeap };
}

/**
 * Đổi ngày âm lịch sang dương lịch.
 *
 * @param lunarDay Ngày âm lịch (1–30)
 * @param lunarMonth Tháng âm lịch (1–12)
 * @param lunarYear Năm âm lịch
 * @param lunarLeap `true` nếu là tháng nhuận
 * @param timeZone Múi giờ (mặc định +7)
 * @returns Bộ ba `[ngày, tháng, năm]` dương lịch; `[0, 0, 0]` nếu ngày âm
 *   lịch không tồn tại (ví dụ tháng nhuận sai)
 */
export function convertLunar2Solar(
  lunarDay: number,
  lunarMonth: number,
  lunarYear: number,
  lunarLeap: boolean,
  timeZone: number = VN_TIMEZONE,
): [number, number, number] {
  let a11: number;
  let b11: number;
  if (lunarMonth < 11) {
    a11 = getLunarMonth11(lunarYear - 1, timeZone);
    b11 = getLunarMonth11(lunarYear, timeZone);
  } else {
    a11 = getLunarMonth11(lunarYear, timeZone);
    b11 = getLunarMonth11(lunarYear + 1, timeZone);
  }
  const k = INT(0.5 + (a11 - NEW_MOON_EPOCH) / SYNODIC_MONTH);
  let off = lunarMonth - 11;
  if (off < 0) {
    off += 12;
  }
  if (b11 - a11 > 365) {
    const leapOff = getLeapMonthOffset(a11, timeZone);
    let leapMonth = leapOff - 2;
    if (leapMonth < 0) {
      leapMonth += 12;
    }
    if (lunarLeap && lunarMonth !== leapMonth) {
      return [0, 0, 0];
    }
    if (lunarLeap || off >= leapOff) {
      off += 1;
    }
  }
  const monthStart = getNewMoonDay(k + off, timeZone);
  return jdToDate(monthStart + lunarDay - 1);
}
