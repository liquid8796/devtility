import {
  ArrowLeftRight,
  BarChart3,
  Binary,
  Cake,
  CalendarDays,
  Calculator,
  CandlestickChart,
  Clock,
  Code2,
  Cpu,
  PiggyBank,
  Ruler,
  Timer,
  Wallet,
  Wrench,
} from "lucide-react";

import type { Category, CategoryId, ToolDefinition } from "./types";

/**
 * Single source of truth for site navigation & tool metadata (vi/en).
 * Sidebar, home page, breadcrumbs and static route params all derive from here.
 */

export const CATEGORIES: Category[] = [
  {
    id: "converters",
    name: { vi: "Chuyển đổi", en: "Converters" },
    tagline: {
      vi: "Timezone, epoch, tỷ giá, hệ cơ số, đơn vị đo lường",
      en: "Timezones, epoch, exchange rates, number bases, measurement units",
    },
    icon: ArrowLeftRight,
    order: 1,
  },
  {
    id: "utilities",
    name: { vi: "Tiện ích", en: "Utilities" },
    tagline: {
      vi: "Máy tính, tính tuổi, lãi kép, lương Net/Gross, lịch vạn niên",
      en: "Calculators, age, compound interest, Net/Gross salary, lunar calendar",
    },
    icon: Wrench,
    order: 2,
  },
  {
    id: "technology",
    name: { vi: "Technology", en: "Technology" },
    tagline: {
      vi: "Code editor online chạy Java, Python, JavaScript",
      en: "Online code editor running Java, Python, JavaScript",
    },
    icon: Cpu,
    order: 3,
  },
  {
    id: "insights",
    name: { vi: "Thống kê", en: "Insights" },
    tagline: {
      vi: "Lượt truy cập theo giờ, ngày, tháng, năm",
      en: "Visits by hour, day, month, year",
    },
    icon: BarChart3,
    order: 4,
  },
];

export const TOOLS: ToolDefinition[] = [
  // ---- Converters ----
  {
    slug: "timezone",
    category: "converters",
    name: { vi: "Chuyển đổi múi giờ", en: "Timezone Converter" },
    shortName: { vi: "Múi giờ", en: "Timezone" },
    description: {
      vi: "Chuyển đổi giờ địa phương sang các timezone khác nhau và ngược lại, hỗ trợ toàn bộ múi giờ IANA.",
      en: "Convert local time to any timezone and back, supporting the full IANA timezone database.",
    },
    icon: Clock,
    keywords: ["timezone", "múi giờ", "utc", "gmt", "giờ quốc tế"],
  },
  {
    slug: "epoch",
    category: "converters",
    name: { vi: "Epoch / Unix Timestamp", en: "Epoch / Unix Timestamp" },
    shortName: { vi: "Epoch time", en: "Epoch time" },
    description: {
      vi: "Chuyển đổi Unix epoch time sang định dạng ngày giờ thông thường và ngược lại (giây / mili giây).",
      en: "Convert Unix epoch time to human-readable date time and back (seconds / milliseconds).",
    },
    icon: Timer,
    keywords: ["epoch", "unix", "timestamp", "thời gian"],
  },
  {
    slug: "currency",
    category: "converters",
    name: { vi: "Tỷ giá tiền tệ & Crypto", en: "Currency & Crypto Rates" },
    shortName: { vi: "Tỷ giá & Crypto", en: "Currency & Crypto" },
    description: {
      vi: "Chuyển đổi giữa các loại tiền tệ và tiền mã hóa theo tỷ giá thời gian thực, kèm biểu đồ lịch sử.",
      en: "Convert between world currencies and cryptocurrencies at live rates, with historical charts.",
    },
    icon: CandlestickChart,
    keywords: ["tỷ giá", "currency", "usd", "vnd", "bitcoin", "crypto", "exchange rate"],
  },
  {
    slug: "number-base",
    category: "converters",
    name: { vi: "Hệ cơ số & ASCII", en: "Number Base & ASCII" },
    shortName: { vi: "Hệ cơ số", en: "Number base" },
    description: {
      vi: "Chuyển đổi Binary, Octal, Decimal, Hexadecimal và các hệ cơ số 2–36, kèm chuyển đổi văn bản ASCII.",
      en: "Convert Binary, Octal, Decimal, Hexadecimal and any base 2–36, plus text ⇄ ASCII bytes.",
    },
    icon: Binary,
    keywords: ["binary", "hex", "decimal", "octal", "ascii", "cơ số", "nhị phân"],
  },
  {
    slug: "units",
    category: "converters",
    name: { vi: "Đơn vị đo lường", en: "Unit Converter" },
    shortName: { vi: "Đơn vị đo", en: "Units" },
    description: {
      vi: "Chuyển đổi chiều dài, diện tích, thể tích, khối lượng và nhiệt độ (°C ↔ °F ↔ K).",
      en: "Convert length, area, volume, mass and temperature (°C ↔ °F ↔ K).",
    },
    icon: Ruler,
    keywords: ["mét", "km", "mile", "inch", "kg", "lb", "celsius", "fahrenheit", "đơn vị"],
  },

  // ---- Utilities ----
  {
    slug: "calculator",
    category: "utilities",
    name: { vi: "Máy tính Cơ bản & Khoa học", en: "Basic & Scientific Calculator" },
    shortName: { vi: "Máy tính", en: "Calculator" },
    description: {
      vi: "Máy tính cơ bản và khoa học (sin, cos, tan, log, lũy thừa, căn thức) với lịch sử tính toán và bộ nhớ MC/MR/M+/M-.",
      en: "Basic and scientific calculator (sin, cos, tan, log, powers, roots) with calculation history and MC/MR/M+/M- memory.",
    },
    icon: Calculator,
    keywords: ["calculator", "máy tính", "khoa học", "scientific", "sin", "cos", "log"],
  },
  {
    slug: "age-calculator",
    category: "utilities",
    name: { vi: "Tính tuổi chính xác", en: "Age Calculator" },
    shortName: { vi: "Tính tuổi", en: "Age" },
    description: {
      vi: "Tính chính xác số năm, tháng, tuần, ngày, giờ, phút, giây từ lúc sinh ra đến hiện tại.",
      en: "Calculate your exact age in years, months, weeks, days, hours, minutes and seconds.",
    },
    icon: Cake,
    keywords: ["tuổi", "age", "sinh nhật", "birthday"],
  },
  {
    slug: "compound-interest",
    category: "utilities",
    name: { vi: "Lãi kép tiết kiệm", en: "Compound Interest" },
    shortName: { vi: "Lãi kép", en: "Interest" },
    description: {
      vi: "Tính số tiền tích lũy khi gửi tiết kiệm ngân hàng theo lãi suất, kỳ hạn và tần suất nhập gốc.",
      en: "Project savings growth from interest rate, term and compounding frequency.",
    },
    icon: PiggyBank,
    keywords: ["lãi kép", "compound interest", "tiết kiệm", "ngân hàng", "lãi suất"],
  },
  {
    slug: "salary",
    category: "utilities",
    name: { vi: "Lương Net ⇄ Gross (Việt Nam)", en: "Net ⇄ Gross Salary (Vietnam)" },
    shortName: { vi: "Lương Net/Gross", en: "Net/Gross salary" },
    description: {
      vi: "Chuyển đổi lương Net/Gross theo quy định bảo hiểm và thuế TNCN Việt Nam, có bảng diễn giải chi tiết.",
      en: "Convert Net/Gross salary under Vietnamese insurance and PIT rules, with a detailed breakdown.",
    },
    icon: Wallet,
    keywords: ["lương", "net", "gross", "thuế tncn", "bảo hiểm", "salary"],
  },
  {
    slug: "lunar-calendar",
    category: "utilities",
    name: { vi: "Lịch vạn niên", en: "Vietnamese Lunar Calendar" },
    shortName: { vi: "Lịch vạn niên", en: "Lunar calendar" },
    description: {
      vi: "Âm lịch Việt Nam: can chi, tiết khí, giờ hoàng đạo, ngày tốt xấu, chuyển đổi dương ↔ âm lịch.",
      en: "Vietnamese lunar calendar: Can Chi, solar terms, auspicious hours and days, solar ↔ lunar conversion.",
    },
    icon: CalendarDays,
    keywords: ["lịch âm", "âm lịch", "vạn niên", "can chi", "hoàng đạo"],
  },

  // ---- Technology ----
  {
    slug: "code-editor",
    category: "technology",
    name: { vi: "Code Editor Online", en: "Online Code Editor" },
    shortName: { vi: "Code Editor", en: "Code Editor" },
    description: {
      vi: "Soạn thảo và chạy code Java, Python, JavaScript trực tuyến với syntax highlighting và code completion.",
      en: "Write and run Java, Python and JavaScript online with syntax highlighting and code completion.",
    },
    icon: Code2,
    keywords: ["code", "editor", "ide", "java", "python", "javascript", "online compiler"],
    status: "beta",
  },

  // ---- Insights ----
  {
    slug: "traffic",
    category: "insights",
    name: { vi: "Thống kê truy cập", en: "Traffic Analytics" },
    shortName: { vi: "Truy cập", en: "Traffic" },
    description: {
      vi: "Biểu đồ lượt truy cập website theo giờ, ngày, tháng và năm.",
      en: "Website visit charts by hour, day, month and year.",
    },
    icon: BarChart3,
    keywords: ["thống kê", "analytics", "traffic", "truy cập"],
  },
];

export function getCategory(id: CategoryId): Category {
  const category = CATEGORIES.find((c) => c.id === id);
  if (!category) throw new Error(`Unknown category: ${id}`);
  return category;
}

export function getToolsByCategory(id: CategoryId): ToolDefinition[] {
  return TOOLS.filter((t) => t.category === id);
}

export function getTool(category: string, slug: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.category === category && t.slug === slug);
}

export const SITE = {
  name: "DevTility",
  author: "Nam Tran",
  title: {
    vi: "DevTility — Bộ công cụ tiện ích cho Developer",
    en: "DevTility — Utility toolbox for developers",
  },
  description: {
    vi: "Bộ sưu tập công cụ chuyển đổi, máy tính, lịch vạn niên và code editor online: timezone, epoch, tỷ giá, hệ cơ số, đơn vị đo, lương Net/Gross…",
    en: "A collection of converters, calculators, the Vietnamese lunar calendar and an online code editor: timezone, epoch, exchange rates, number bases, units, Net/Gross salary…",
  },
  repo: "https://github.com/liquid8796/devtility",
} as const;
