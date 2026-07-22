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
 * Single source of truth for site navigation & tool metadata.
 * Sidebar, home page, breadcrumbs and static route params all derive from here.
 */

export const CATEGORIES: Category[] = [
  {
    id: "converters",
    name: "Chuyển đổi",
    tagline: "Timezone, epoch, tỷ giá, hệ cơ số, đơn vị đo lường",
    icon: ArrowLeftRight,
    order: 1,
  },
  {
    id: "utilities",
    name: "Tiện ích",
    tagline: "Máy tính, tính tuổi, lãi kép, lương Net/Gross, lịch vạn niên",
    icon: Wrench,
    order: 2,
  },
  {
    id: "technology",
    name: "Technology",
    tagline: "Code editor online chạy Java, Python, JavaScript",
    icon: Cpu,
    order: 3,
  },
  {
    id: "insights",
    name: "Thống kê",
    tagline: "Lượt truy cập theo giờ, ngày, tháng, năm",
    icon: BarChart3,
    order: 4,
  },
];

export const TOOLS: ToolDefinition[] = [
  // ---- Chuyển đổi ----
  {
    slug: "timezone",
    category: "converters",
    name: "Chuyển đổi múi giờ",
    shortName: "Múi giờ",
    description:
      "Chuyển đổi giờ địa phương sang các timezone khác nhau và ngược lại, hỗ trợ toàn bộ múi giờ IANA.",
    icon: Clock,
    keywords: ["timezone", "múi giờ", "utc", "gmt", "giờ quốc tế"],
  },
  {
    slug: "epoch",
    category: "converters",
    name: "Epoch / Unix Timestamp",
    shortName: "Epoch time",
    description:
      "Chuyển đổi Unix epoch time sang định dạng ngày giờ thông thường và ngược lại (giây / mili giây).",
    icon: Timer,
    keywords: ["epoch", "unix", "timestamp", "thời gian"],
  },
  {
    slug: "currency",
    category: "converters",
    name: "Tỷ giá tiền tệ & Crypto",
    shortName: "Tỷ giá & Crypto",
    description:
      "Chuyển đổi giữa các loại tiền tệ và tiền mã hóa theo tỷ giá thời gian thực, kèm biểu đồ lịch sử.",
    icon: CandlestickChart,
    keywords: ["tỷ giá", "currency", "usd", "vnd", "bitcoin", "crypto", "exchange rate"],
  },
  {
    slug: "number-base",
    category: "converters",
    name: "Hệ cơ số & ASCII",
    shortName: "Hệ cơ số",
    description:
      "Chuyển đổi Binary, Octal, Decimal, Hexadecimal và các hệ cơ số 2–36, kèm chuyển đổi văn bản ASCII.",
    icon: Binary,
    keywords: ["binary", "hex", "decimal", "octal", "ascii", "cơ số", "nhị phân"],
  },
  {
    slug: "units",
    category: "converters",
    name: "Đơn vị đo lường",
    shortName: "Đơn vị đo",
    description:
      "Chuyển đổi chiều dài, diện tích, thể tích, khối lượng và nhiệt độ (°C ↔ °F ↔ K).",
    icon: Ruler,
    keywords: ["mét", "km", "mile", "inch", "kg", "lb", "celsius", "fahrenheit", "đơn vị"],
  },

  // ---- Tiện ích ----
  {
    slug: "calculator",
    category: "utilities",
    name: "Máy tính Cơ bản & Khoa học",
    shortName: "Máy tính",
    description:
      "Máy tính cơ bản và khoa học (sin, cos, tan, log, lũy thừa, căn thức) với lịch sử tính toán và bộ nhớ MC/MR/M+/M-.",
    icon: Calculator,
    keywords: ["calculator", "máy tính", "khoa học", "scientific", "sin", "cos", "log"],
  },
  {
    slug: "age-calculator",
    category: "utilities",
    name: "Tính tuổi chính xác",
    shortName: "Tính tuổi",
    description:
      "Tính chính xác số năm, tháng, tuần, ngày, giờ, phút, giây từ lúc sinh ra đến hiện tại.",
    icon: Cake,
    keywords: ["tuổi", "age", "sinh nhật", "birthday"],
  },
  {
    slug: "compound-interest",
    category: "utilities",
    name: "Lãi kép tiết kiệm",
    shortName: "Lãi kép",
    description:
      "Tính số tiền tích lũy khi gửi tiết kiệm ngân hàng theo lãi suất, kỳ hạn và tần suất nhập gốc.",
    icon: PiggyBank,
    keywords: ["lãi kép", "compound interest", "tiết kiệm", "ngân hàng", "lãi suất"],
  },
  {
    slug: "salary",
    category: "utilities",
    name: "Lương Net ⇄ Gross (Việt Nam)",
    shortName: "Lương Net/Gross",
    description:
      "Chuyển đổi lương Net/Gross theo quy định bảo hiểm và thuế TNCN Việt Nam, có bảng diễn giải chi tiết.",
    icon: Wallet,
    keywords: ["lương", "net", "gross", "thuế tncn", "bảo hiểm", "salary"],
  },
  {
    slug: "lunar-calendar",
    category: "utilities",
    name: "Lịch vạn niên",
    shortName: "Lịch vạn niên",
    description:
      "Âm lịch Việt Nam: can chi, tiết khí, giờ hoàng đạo, ngày tốt xấu, chuyển đổi dương ↔ âm lịch.",
    icon: CalendarDays,
    keywords: ["lịch âm", "âm lịch", "vạn niên", "can chi", "hoàng đạo"],
  },

  // ---- Technology ----
  {
    slug: "code-editor",
    category: "technology",
    name: "Code Editor Online",
    shortName: "Code Editor",
    description:
      "Soạn thảo và chạy code Java, Python, JavaScript trực tuyến với syntax highlighting.",
    icon: Code2,
    keywords: ["code", "editor", "ide", "java", "python", "javascript", "online compiler"],
    status: "beta",
  },

  // ---- Thống kê ----
  {
    slug: "traffic",
    category: "insights",
    name: "Thống kê truy cập",
    shortName: "Truy cập",
    description: "Biểu đồ lượt truy cập website theo giờ, ngày, tháng và năm.",
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
  title: "DevTility — Bộ công cụ tiện ích cho Developer",
  description:
    "Bộ sưu tập công cụ chuyển đổi, máy tính, lịch vạn niên và code editor online: timezone, epoch, tỷ giá, hệ cơ số, đơn vị đo, lương Net/Gross…",
  repo: "https://github.com/liquid8796/devtility",
} as const;
