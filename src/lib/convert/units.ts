import type { Localized } from "@/lib/i18n";
import { Decimal, dec } from "@/lib/math/decimal";

/**
 * Unit conversion data + engine, entirely Decimal-based (precision 40) so
 * chained conversions never accumulate binary floating-point error.
 *
 * Linear units declare `factor` — the exact multiplier to the category's base
 * unit — as a string so it survives into Decimal without float rounding.
 * Non-linear units (temperature) declare `toBase`/`fromBase` functions.
 */

export interface Unit {
  id: string;
  /** Localized display name, e.g. { vi: "Ki-lô-mét", en: "Kilometer" }. */
  name: Localized;
  /** Short symbol, e.g. "km". */
  symbol: string;
  /** value_in_base = value × factor (string for Decimal precision). */
  factor?: string;
  /** Non-linear conversion into the base unit (overrides `factor`). */
  toBase?: (d: Decimal) => Decimal;
  /** Non-linear conversion out of the base unit (overrides `factor`). */
  fromBase?: (d: Decimal) => Decimal;
}

export type UnitCategoryId = "length" | "area" | "volume" | "mass" | "temperature";

export interface UnitCategory {
  id: UnitCategoryId;
  /** Localized category name, e.g. { vi: "Chiều dài", en: "Length" }. */
  name: Localized;
  /** id of the unit every `factor` is expressed against. */
  baseUnit: string;
  units: Unit[];
}

export const UNIT_CATEGORIES: UnitCategory[] = [
  {
    id: "length",
    name: { vi: "Chiều dài", en: "Length" },
    baseUnit: "m",
    units: [
      { id: "mm", name: { vi: "Mi-li-mét", en: "Millimeter" }, symbol: "mm", factor: "0.001" },
      { id: "cm", name: { vi: "Xen-ti-mét", en: "Centimeter" }, symbol: "cm", factor: "0.01" },
      { id: "dm", name: { vi: "Đề-xi-mét", en: "Decimeter" }, symbol: "dm", factor: "0.1" },
      { id: "m", name: { vi: "Mét", en: "Meter" }, symbol: "m", factor: "1" },
      { id: "km", name: { vi: "Ki-lô-mét", en: "Kilometer" }, symbol: "km", factor: "1000" },
      { id: "in", name: { vi: "Inch", en: "Inch" }, symbol: "in", factor: "0.0254" },
      { id: "ft", name: { vi: "Foot", en: "Foot" }, symbol: "ft", factor: "0.3048" },
      { id: "yd", name: { vi: "Yard", en: "Yard" }, symbol: "yd", factor: "0.9144" },
      { id: "mi", name: { vi: "Dặm (mile)", en: "Mile" }, symbol: "mi", factor: "1609.344" },
      { id: "nmi", name: { vi: "Hải lý", en: "Nautical mile" }, symbol: "NM", factor: "1852" },
    ],
  },
  {
    id: "area",
    name: { vi: "Diện tích", en: "Area" },
    baseUnit: "m2",
    units: [
      {
        id: "mm2",
        name: { vi: "Mi-li-mét vuông", en: "Square millimeter" },
        symbol: "mm²",
        factor: "0.000001",
      },
      {
        id: "cm2",
        name: { vi: "Xen-ti-mét vuông", en: "Square centimeter" },
        symbol: "cm²",
        factor: "0.0001",
      },
      { id: "m2", name: { vi: "Mét vuông", en: "Square meter" }, symbol: "m²", factor: "1" },
      { id: "a", name: { vi: "A (are)", en: "Are" }, symbol: "a", factor: "100" },
      { id: "ha", name: { vi: "Héc-ta", en: "Hectare" }, symbol: "ha", factor: "10000" },
      {
        id: "km2",
        name: { vi: "Ki-lô-mét vuông", en: "Square kilometer" },
        symbol: "km²",
        factor: "1000000",
      },
      {
        id: "in2",
        name: { vi: "Inch vuông", en: "Square inch" },
        symbol: "in²",
        factor: "0.00064516",
      },
      {
        id: "ft2",
        name: { vi: "Foot vuông", en: "Square foot" },
        symbol: "ft²",
        factor: "0.09290304",
      },
      {
        id: "acre",
        name: { vi: "Mẫu Anh (acre)", en: "Acre" },
        symbol: "ac",
        factor: "4046.8564224",
      },
      {
        id: "mi2",
        name: { vi: "Dặm vuông", en: "Square mile" },
        symbol: "mi²",
        factor: "2589988.110336",
      },
    ],
  },
  {
    id: "volume",
    name: { vi: "Thể tích", en: "Volume" },
    baseUnit: "l",
    units: [
      { id: "ml", name: { vi: "Mi-li-lít", en: "Milliliter" }, symbol: "ml", factor: "0.001" },
      { id: "cl", name: { vi: "Xen-ti-lít", en: "Centiliter" }, symbol: "cl", factor: "0.01" },
      { id: "l", name: { vi: "Lít", en: "Liter" }, symbol: "l", factor: "1" },
      { id: "m3", name: { vi: "Mét khối", en: "Cubic meter" }, symbol: "m³", factor: "1000" },
      {
        id: "cm3",
        name: { vi: "Xen-ti-mét khối", en: "Cubic centimeter" },
        symbol: "cm³",
        factor: "0.001",
      },
      {
        id: "gal",
        name: { vi: "Gallon Mỹ", en: "US gallon" },
        symbol: "gal",
        factor: "3.785411784",
      },
      {
        id: "qt",
        name: { vi: "Quart Mỹ", en: "US quart" },
        symbol: "qt",
        factor: "0.946352946",
      },
      {
        id: "pt",
        name: { vi: "Pint Mỹ", en: "US pint" },
        symbol: "pt",
        factor: "0.473176473",
      },
      {
        id: "cup",
        name: { vi: "Cup Mỹ", en: "US cup" },
        symbol: "cup",
        factor: "0.2365882365",
      },
      {
        id: "floz",
        name: { vi: "Ounce lỏng (fl oz)", en: "Fluid ounce (fl oz)" },
        symbol: "fl oz",
        factor: "0.0295735295625",
      },
      {
        id: "in3",
        name: { vi: "Inch khối", en: "Cubic inch" },
        symbol: "in³",
        factor: "0.016387064",
      },
      {
        id: "ft3",
        name: { vi: "Foot khối", en: "Cubic foot" },
        symbol: "ft³",
        factor: "28.316846592",
      },
    ],
  },
  {
    id: "mass",
    name: { vi: "Khối lượng", en: "Mass" },
    baseUnit: "kg",
    units: [
      { id: "mg", name: { vi: "Mi-li-gam", en: "Milligram" }, symbol: "mg", factor: "0.000001" },
      { id: "g", name: { vi: "Gam", en: "Gram" }, symbol: "g", factor: "0.001" },
      { id: "kg", name: { vi: "Ki-lô-gam", en: "Kilogram" }, symbol: "kg", factor: "1" },
      { id: "yen", name: { vi: "Yến", en: "Yến (10 kg)" }, symbol: "yến", factor: "10" },
      { id: "ta", name: { vi: "Tạ", en: "Tạ (100 kg)" }, symbol: "tạ", factor: "100" },
      { id: "tan", name: { vi: "Tấn", en: "Tonne" }, symbol: "t", factor: "1000" },
      {
        id: "oz",
        name: { vi: "Ounce (oz)", en: "Ounce (oz)" },
        symbol: "oz",
        factor: "0.028349523125",
      },
      {
        id: "lb",
        name: { vi: "Pound (lb)", en: "Pound (lb)" },
        symbol: "lb",
        factor: "0.45359237",
      },
      { id: "stone", name: { vi: "Stone", en: "Stone" }, symbol: "st", factor: "6.35029318" },
      { id: "carat", name: { vi: "Ca-ra (carat)", en: "Carat" }, symbol: "ct", factor: "0.0002" },
    ],
  },
  {
    id: "temperature",
    name: { vi: "Nhiệt độ", en: "Temperature" },
    baseUnit: "c",
    units: [
      {
        id: "c",
        name: { vi: "Độ C (Celsius)", en: "Celsius" },
        symbol: "°C",
        toBase: (d) => d,
        fromBase: (d) => d,
      },
      {
        id: "f",
        name: { vi: "Độ F (Fahrenheit)", en: "Fahrenheit" },
        symbol: "°F",
        toBase: (d) => d.minus(32).mul(5).div(9),
        fromBase: (d) => d.mul(9).div(5).plus(32),
      },
      {
        id: "k",
        name: { vi: "Kelvin", en: "Kelvin" },
        symbol: "K",
        toBase: (d) => d.minus("273.15"),
        fromBase: (d) => d.plus("273.15"),
      },
    ],
  },
];

/** Look up a category by id. */
export function getUnitCategory(id: UnitCategoryId): UnitCategory {
  const category = UNIT_CATEGORIES.find((c) => c.id === id);
  if (!category) throw new Error(`Unknown unit category: ${id}`);
  return category;
}

/** Look up a unit inside a category, or undefined. */
export function findUnit(category: UnitCategory, unitId: string): Unit | undefined {
  return category.units.find((u) => u.id === unitId);
}

/**
 * Convert `value` from one unit to another (both must belong to the same
 * category): source → base unit → target, all in Decimal.
 */
export function convertUnit(value: Decimal, from: Unit, to: Unit): Decimal {
  const base = from.toBase ? from.toBase(value) : value.mul(dec(from.factor ?? "1"));
  return to.fromBase ? to.fromBase(base) : base.div(dec(to.factor ?? "1"));
}
