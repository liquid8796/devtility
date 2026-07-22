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
  /** Vietnamese display name, e.g. "Ki-lô-mét". */
  name: string;
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
  /** Vietnamese category name, e.g. "Chiều dài". */
  name: string;
  /** id of the unit every `factor` is expressed against. */
  baseUnit: string;
  units: Unit[];
}

export const UNIT_CATEGORIES: UnitCategory[] = [
  {
    id: "length",
    name: "Chiều dài",
    baseUnit: "m",
    units: [
      { id: "mm", name: "Mi-li-mét", symbol: "mm", factor: "0.001" },
      { id: "cm", name: "Xen-ti-mét", symbol: "cm", factor: "0.01" },
      { id: "dm", name: "Đề-xi-mét", symbol: "dm", factor: "0.1" },
      { id: "m", name: "Mét", symbol: "m", factor: "1" },
      { id: "km", name: "Ki-lô-mét", symbol: "km", factor: "1000" },
      { id: "in", name: "Inch", symbol: "in", factor: "0.0254" },
      { id: "ft", name: "Foot", symbol: "ft", factor: "0.3048" },
      { id: "yd", name: "Yard", symbol: "yd", factor: "0.9144" },
      { id: "mi", name: "Dặm (mile)", symbol: "mi", factor: "1609.344" },
      { id: "nmi", name: "Hải lý", symbol: "NM", factor: "1852" },
    ],
  },
  {
    id: "area",
    name: "Diện tích",
    baseUnit: "m2",
    units: [
      { id: "mm2", name: "Mi-li-mét vuông", symbol: "mm²", factor: "0.000001" },
      { id: "cm2", name: "Xen-ti-mét vuông", symbol: "cm²", factor: "0.0001" },
      { id: "m2", name: "Mét vuông", symbol: "m²", factor: "1" },
      { id: "a", name: "A (are)", symbol: "a", factor: "100" },
      { id: "ha", name: "Héc-ta", symbol: "ha", factor: "10000" },
      { id: "km2", name: "Ki-lô-mét vuông", symbol: "km²", factor: "1000000" },
      { id: "in2", name: "Inch vuông", symbol: "in²", factor: "0.00064516" },
      { id: "ft2", name: "Foot vuông", symbol: "ft²", factor: "0.09290304" },
      { id: "acre", name: "Mẫu Anh (acre)", symbol: "ac", factor: "4046.8564224" },
      { id: "mi2", name: "Dặm vuông", symbol: "mi²", factor: "2589988.110336" },
    ],
  },
  {
    id: "volume",
    name: "Thể tích",
    baseUnit: "l",
    units: [
      { id: "ml", name: "Mi-li-lít", symbol: "ml", factor: "0.001" },
      { id: "cl", name: "Xen-ti-lít", symbol: "cl", factor: "0.01" },
      { id: "l", name: "Lít", symbol: "l", factor: "1" },
      { id: "m3", name: "Mét khối", symbol: "m³", factor: "1000" },
      { id: "cm3", name: "Xen-ti-mét khối", symbol: "cm³", factor: "0.001" },
      { id: "gal", name: "Gallon Mỹ", symbol: "gal", factor: "3.785411784" },
      { id: "qt", name: "Quart Mỹ", symbol: "qt", factor: "0.946352946" },
      { id: "pt", name: "Pint Mỹ", symbol: "pt", factor: "0.473176473" },
      { id: "cup", name: "Cup Mỹ", symbol: "cup", factor: "0.2365882365" },
      { id: "floz", name: "Ounce lỏng (fl oz)", symbol: "fl oz", factor: "0.0295735295625" },
      { id: "in3", name: "Inch khối", symbol: "in³", factor: "0.016387064" },
      { id: "ft3", name: "Foot khối", symbol: "ft³", factor: "28.316846592" },
    ],
  },
  {
    id: "mass",
    name: "Khối lượng",
    baseUnit: "kg",
    units: [
      { id: "mg", name: "Mi-li-gam", symbol: "mg", factor: "0.000001" },
      { id: "g", name: "Gam", symbol: "g", factor: "0.001" },
      { id: "kg", name: "Ki-lô-gam", symbol: "kg", factor: "1" },
      { id: "yen", name: "Yến", symbol: "yến", factor: "10" },
      { id: "ta", name: "Tạ", symbol: "tạ", factor: "100" },
      { id: "tan", name: "Tấn", symbol: "t", factor: "1000" },
      { id: "oz", name: "Ounce (oz)", symbol: "oz", factor: "0.028349523125" },
      { id: "lb", name: "Pound (lb)", symbol: "lb", factor: "0.45359237" },
      { id: "stone", name: "Stone", symbol: "st", factor: "6.35029318" },
      { id: "carat", name: "Ca-ra (carat)", symbol: "ct", factor: "0.0002" },
    ],
  },
  {
    id: "temperature",
    name: "Nhiệt độ",
    baseUnit: "c",
    units: [
      {
        id: "c",
        name: "Độ C (Celsius)",
        symbol: "°C",
        toBase: (d) => d,
        fromBase: (d) => d,
      },
      {
        id: "f",
        name: "Độ F (Fahrenheit)",
        symbol: "°F",
        toBase: (d) => d.minus(32).mul(5).div(9),
        fromBase: (d) => d.mul(9).div(5).plus(32),
      },
      {
        id: "k",
        name: "Kelvin",
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
