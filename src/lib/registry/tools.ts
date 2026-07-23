import {
  ArrowLeftRight,
  BarChart3,
  Binary,
  BookOpen,
  Braces,
  Cake,
  CalendarClock,
  CalendarDays,
  Calculator,
  CandlestickChart,
  Clock,
  Code2,
  Cpu,
  Database,
  FileDiff,
  FileJson,
  Fingerprint,
  Hash,
  KeyRound,
  Link,
  PiggyBank,
  Regex,
  Ruler,
  Terminal,
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
    // Display name is "Developer Tools"; the id stays "technology" so existing
    // /tools/technology/* URLs (bookmarks, SEO) keep working.
    id: "technology",
    name: { vi: "Developer Tools", en: "Developer Tools" },
    tagline: {
      vi: "Code editor online, JSON, JWT, regex, SQL, cURL, OpenAPI…",
      en: "Online code editor, JSON, JWT, regex, SQL, cURL, OpenAPI…",
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

export const TOOLS = [
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

  {
    slug: "json-toolkit",
    category: "technology",
    name: { vi: "JSON Toolkit", en: "JSON Toolkit" },
    shortName: { vi: "JSON Toolkit", en: "JSON Toolkit" },
    description: {
      vi: "Format, minify, validate JSON; tree view, sắp xếp key, escape/unescape chuỗi JSON.",
      en: "Format, minify and validate JSON; tree view, sort keys, escape/unescape JSON strings.",
    },
    icon: Braces,
    keywords: ["json", "format", "beautify", "minify", "validate", "tree"],
  },
  {
    slug: "json-converter",
    category: "technology",
    name: { vi: "JSON Converter", en: "JSON Converter" },
    shortName: { vi: "JSON ⇄ YAML/XML", en: "JSON ⇄ YAML/XML" },
    description: {
      vi: "Chuyển đổi hai chiều giữa JSON, YAML, XML, TOML và CSV.",
      en: "Two-way conversion between JSON, YAML, XML, TOML and CSV.",
    },
    icon: FileJson,
    keywords: ["json", "yaml", "xml", "toml", "csv", "convert"],
  },
  {
    slug: "jwt",
    category: "technology",
    name: { vi: "JWT Inspector", en: "JWT Inspector" },
    shortName: { vi: "JWT", en: "JWT" },
    description: {
      vi: "Decode header/payload, kiểm tra exp/nbf/iat/iss/aud, verify chữ ký bằng secret hoặc JWK, tạo JWT mới.",
      en: "Decode header/payload, check exp/nbf/iat/iss/aud claims, verify signatures with a secret or JWK, mint new JWTs.",
    },
    icon: KeyRound,
    keywords: ["jwt", "token", "decode", "verify", "hs256", "jwk"],
  },
  {
    slug: "base64-url",
    category: "technology",
    name: { vi: "Base64 & URL", en: "Base64 & URL" },
    shortName: { vi: "Base64 & URL", en: "Base64 & URL" },
    description: {
      vi: "Encode/decode Base64 thường và URL-safe, URL encode/decode, phân tích query string.",
      en: "Encode/decode standard and URL-safe Base64, URL encode/decode, query-string parser.",
    },
    icon: Link,
    keywords: ["base64", "url", "encode", "decode", "query string"],
  },
  {
    slug: "uuid",
    category: "technology",
    name: { vi: "UUID Toolkit", en: "UUID Toolkit" },
    shortName: { vi: "UUID / ULID", en: "UUID / ULID" },
    description: {
      vi: "Sinh UUID v4/v7, ULID, NanoID; validate và sinh hàng loạt.",
      en: "Generate UUID v4/v7, ULID and NanoID; validate and batch generation.",
    },
    icon: Fingerprint,
    keywords: ["uuid", "ulid", "nanoid", "guid", "generate"],
  },
  {
    slug: "regex-tester",
    category: "technology",
    name: { vi: "Regex Tester", en: "Regex Tester" },
    shortName: { vi: "Regex", en: "Regex" },
    description: {
      vi: "Test và debug regex: highlight match, capture groups, xem trước replace, snippet Java/JS/Python.",
      en: "Test and debug regex: match highlighting, capture groups, replace preview, Java/JS/Python snippets.",
    },
    icon: Regex,
    keywords: ["regex", "regular expression", "match", "replace", "pattern"],
  },
  {
    slug: "diff",
    category: "technology",
    name: { vi: "Diff Checker", en: "Diff Checker" },
    shortName: { vi: "Diff", en: "Diff" },
    description: {
      vi: "So sánh văn bản và JSON semantic diff; tùy chọn bỏ qua whitespace hoặc thứ tự key.",
      en: "Compare text and semantic JSON diff; optionally ignore whitespace or key order.",
    },
    icon: FileDiff,
    keywords: ["diff", "compare", "so sánh", "json diff"],
  },
  {
    slug: "cron",
    category: "technology",
    name: { vi: "Cron Builder", en: "Cron Builder" },
    shortName: { vi: "Cron", en: "Cron" },
    description: {
      vi: "Visual builder cho biểu thức cron, giải thích ý nghĩa và liệt kê các lần chạy tiếp theo.",
      en: "Visual cron expression builder with human explanation and upcoming run times.",
    },
    icon: CalendarClock,
    keywords: ["cron", "crontab", "schedule", "lịch chạy"],
  },
  {
    slug: "hash",
    category: "technology",
    name: { vi: "Hash & HMAC", en: "Hash & HMAC" },
    shortName: { vi: "Hash & HMAC", en: "Hash & HMAC" },
    description: {
      vi: "MD5, SHA-256/512, HMAC, checksum file và kiểm tra bcrypt.",
      en: "MD5, SHA-256/512, HMAC, file checksums and bcrypt verification.",
    },
    icon: Hash,
    keywords: ["hash", "md5", "sha256", "hmac", "checksum", "bcrypt"],
  },
  {
    slug: "sql-formatter",
    category: "technology",
    name: { vi: "SQL Formatter", en: "SQL Formatter" },
    shortName: { vi: "SQL Formatter", en: "SQL Formatter" },
    description: {
      vi: "Format và minify SQL với syntax highlighting, hỗ trợ Oracle, PostgreSQL, MySQL.",
      en: "Format and minify SQL with syntax highlighting for Oracle, PostgreSQL and MySQL.",
    },
    icon: Database,
    keywords: ["sql", "format", "beautify", "oracle", "postgresql", "mysql"],
  },
  {
    slug: "curl-converter",
    category: "technology",
    name: { vi: "cURL Converter", en: "cURL Converter" },
    shortName: { vi: "cURL Converter", en: "cURL Converter" },
    description: {
      vi: "Chuyển cURL (kể cả bản export từ Postman, grpcurl) sang fetch, Axios, Java HttpClient, Spring WebClient và ngược lại.",
      en: "Convert cURL (including Postman exports and grpcurl) to fetch, Axios, Java HttpClient, Spring WebClient and back.",
    },
    icon: Terminal,
    keywords: ["curl", "fetch", "axios", "httpclient", "webclient", "grpcurl", "postman"],
  },
  {
    slug: "openapi-viewer",
    category: "technology",
    name: { vi: "OpenAPI Viewer", en: "OpenAPI Viewer" },
    shortName: { vi: "OpenAPI", en: "OpenAPI" },
    description: {
      vi: "Đọc Swagger/OpenAPI (JSON/YAML), duyệt endpoint theo tag và sinh request mẫu.",
      en: "Read Swagger/OpenAPI specs (JSON/YAML), browse endpoints by tag and generate sample requests.",
    },
    icon: BookOpen,
    keywords: ["openapi", "swagger", "api", "endpoint", "spec"],
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
] as const satisfies readonly ToolDefinition[];

/** Union of every registered slug — lets consumers (e.g. the feature map) stay in lockstep at compile time. */
export type ToolSlug = (typeof TOOLS)[number]["slug"];

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
