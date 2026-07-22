import { Decimal, dec } from "@/lib/math/decimal";

/**
 * Vietnamese payroll math (Gross ⇄ Net) — pure domain logic, no UI concerns.
 *
 * Pipeline for a monthly salary:
 *
 *   Gross
 *     − BHXH (8%)  on min(insuranceBase, 20 × lương cơ sở)
 *     − BHYT (1.5%) on min(insuranceBase, 20 × lương cơ sở)
 *     − BHTN (1%)  on min(insuranceBase, 20 × lương tối thiểu vùng)
 *   = Thu nhập trước thuế
 *     − Giảm trừ bản thân
 *     − Giảm trừ người phụ thuộc (n × mức/người)
 *   = Thu nhập tính thuế (floored at 0)
 *     → Thuế TNCN theo biểu lũy tiến từng phần (7 bậc)
 *   Net = Thu nhập trước thuế − Thuế TNCN
 *
 * The employer additionally pays BHXH 17.5%, BHYT 3%, BHTN 1% on the same
 * capped bases; total employer cost = gross + employer insurance.
 *
 * All arithmetic uses Decimal (never native floats).
 */

/** Lương tối thiểu vùng regions. */
export type Region = 1 | 2 | 3 | 4;

export interface TaxConfig {
  /** Human label, e.g. "2026". */
  label: string;
  /** Giảm trừ gia cảnh cho bản thân, ₫/tháng. */
  personalDeduction: Decimal;
  /** Giảm trừ cho mỗi người phụ thuộc, ₫/tháng. */
  dependentDeduction: Decimal;
  /** Lương cơ sở — trần đóng BHXH/BHYT là 20 × mức này. */
  baseSalary: Decimal;
  /** Lương tối thiểu vùng — trần đóng BHTN là 20 × mức của vùng. */
  regionalMinWage: Record<Region, Decimal>;
}

/** Lương tối thiểu vùng áp dụng từ 01/07/2024 (Nghị định 74/2024/NĐ-CP). */
const REGIONAL_MIN_WAGE_2024: Record<Region, Decimal> = {
  1: dec(4_960_000),
  2: dec(4_410_000),
  3: dec(3_860_000),
  4: dec(3_450_000),
};

/**
 * Chế độ 2026 — giảm trừ gia cảnh mới theo Nghị quyết của UBTVQH,
 * áp dụng từ kỳ tính thuế 2026: 15,5tr bản thân / 6,2tr mỗi người phụ thuộc.
 */
export const PRESET_2026: TaxConfig = {
  label: "2026",
  personalDeduction: dec(15_500_000),
  dependentDeduction: dec(6_200_000),
  baseSalary: dec(2_340_000),
  regionalMinWage: REGIONAL_MIN_WAGE_2024,
};

/** Chế độ 2025 — giảm trừ gia cảnh 11tr / 4,4tr (Nghị quyết 954/2020/UBTVQH14). */
export const PRESET_2025: TaxConfig = {
  label: "2025",
  personalDeduction: dec(11_000_000),
  dependentDeduction: dec(4_400_000),
  baseSalary: dec(2_340_000),
  regionalMinWage: REGIONAL_MIN_WAGE_2024,
};

/** Tỷ lệ bảo hiểm người lao động đóng (trừ vào lương). */
export const EMPLOYEE_INSURANCE_RATES = {
  bhxh: dec("0.08"),
  bhyt: dec("0.015"),
  bhtn: dec("0.01"),
} as const;

/** Tỷ lệ bảo hiểm người sử dụng lao động đóng (ngoài lương gross). */
export const EMPLOYER_INSURANCE_RATES = {
  bhxh: dec("0.175"),
  bhyt: dec("0.03"),
  bhtn: dec("0.01"),
} as const;

/** One slice of the progressive PIT schedule. `cap` is null for the open-ended top bracket. */
interface PitBracketDef {
  rate: Decimal;
  cap: Decimal | null;
  label: string;
}

/** Biểu thuế TNCN lũy tiến từng phần theo tháng (thu nhập tính thuế). */
export const PIT_BRACKETS: readonly PitBracketDef[] = [
  { rate: dec("0.05"), cap: dec(5_000_000), label: "Bậc 1 (5% đến 5tr)" },
  { rate: dec("0.1"), cap: dec(10_000_000), label: "Bậc 2 (10% trên 5tr đến 10tr)" },
  { rate: dec("0.15"), cap: dec(18_000_000), label: "Bậc 3 (15% trên 10tr đến 18tr)" },
  { rate: dec("0.2"), cap: dec(32_000_000), label: "Bậc 4 (20% trên 18tr đến 32tr)" },
  { rate: dec("0.25"), cap: dec(52_000_000), label: "Bậc 5 (25% trên 32tr đến 52tr)" },
  { rate: dec("0.3"), cap: dec(80_000_000), label: "Bậc 6 (30% trên 52tr đến 80tr)" },
  { rate: dec("0.35"), cap: null, label: "Bậc 7 (35% trên 80tr)" },
];

export interface TaxBracketLine {
  /** Marginal rate of this bracket (e.g. 0.05). */
  rate: Decimal;
  /** Human range label, e.g. "Bậc 1 (5% đến 5tr)". */
  range: string;
  /** Portion of taxable income that falls inside this bracket. */
  taxedIncome: Decimal;
  /** Tax due for this bracket (= taxedIncome × rate). */
  amount: Decimal;
}

export interface SalaryBreakdown {
  gross: Decimal;
  net: Decimal;
  insurance: {
    /** Employee BHXH contribution (8%). */
    bhxh: Decimal;
    /** Employee BHYT contribution (1.5%). */
    bhyt: Decimal;
    /** Employee BHTN contribution (1%). */
    bhtn: Decimal;
    total: Decimal;
    /** Base actually used for BHXH/BHYT after the 20 × lương cơ sở cap. */
    bhxhBase: Decimal;
    /** Base actually used for BHTN after the 20 × lương tối thiểu vùng cap. */
    bhtnBase: Decimal;
  };
  deductions: {
    personal: Decimal;
    dependents: Decimal;
    total: Decimal;
  };
  /** Thu nhập trước thuế = gross − employee insurance. */
  preTaxIncome: Decimal;
  /** Thu nhập tính thuế = max(preTaxIncome − deductions, 0). */
  taxableIncome: Decimal;
  /** Every bracket of the schedule (zero-amount brackets included for display filtering). */
  taxBrackets: TaxBracketLine[];
  totalTax: Decimal;
  employerCost: {
    bhxh: Decimal;
    bhyt: Decimal;
    bhtn: Decimal;
    /** Employer insurance subtotal. */
    total: Decimal;
    /** Total cost of employment = gross + employer insurance. */
    totalCost: Decimal;
  };
}

export interface GrossToNetInput {
  gross: Decimal;
  /** Số người phụ thuộc (negative/fractional values are clamped/floored). */
  dependents: number;
  region: Region;
  /** Mức lương đóng bảo hiểm; defaults to gross when omitted. */
  insuranceBase?: Decimal;
  config: TaxConfig;
}

export interface NetToGrossInput {
  net: Decimal;
  dependents: number;
  region: Region;
  insuranceBase?: Decimal;
  config: TaxConfig;
}

const ZERO = dec(0);

/** Compute the full monthly breakdown from a gross salary. */
export function grossToNet(input: GrossToNetInput): SalaryBreakdown {
  const { gross, region, config } = input;
  const dependents = Math.max(0, Math.floor(input.dependents));
  const insuranceBase = input.insuranceBase ?? gross;

  // --- Employee & employer insurance (with statutory caps) -----------------
  const bhxhCap = config.baseSalary.mul(20);
  const bhtnCap = config.regionalMinWage[region].mul(20);
  const bhxhBase = Decimal.min(insuranceBase, bhxhCap);
  const bhtnBase = Decimal.min(insuranceBase, bhtnCap);

  const bhxh = bhxhBase.mul(EMPLOYEE_INSURANCE_RATES.bhxh);
  const bhyt = bhxhBase.mul(EMPLOYEE_INSURANCE_RATES.bhyt);
  const bhtn = bhtnBase.mul(EMPLOYEE_INSURANCE_RATES.bhtn);
  const insuranceTotal = bhxh.plus(bhyt).plus(bhtn);

  const employerBhxh = bhxhBase.mul(EMPLOYER_INSURANCE_RATES.bhxh);
  const employerBhyt = bhxhBase.mul(EMPLOYER_INSURANCE_RATES.bhyt);
  const employerBhtn = bhtnBase.mul(EMPLOYER_INSURANCE_RATES.bhtn);
  const employerTotal = employerBhxh.plus(employerBhyt).plus(employerBhtn);

  // --- Taxable income ------------------------------------------------------
  const preTaxIncome = gross.minus(insuranceTotal);
  const personal = config.personalDeduction;
  const dependentsDeduction = config.dependentDeduction.mul(dependents);
  const deductionsTotal = personal.plus(dependentsDeduction);
  const taxableIncome = Decimal.max(preTaxIncome.minus(deductionsTotal), ZERO);

  // --- Progressive PIT ------------------------------------------------------
  let lower = ZERO;
  let totalTax = ZERO;
  const taxBrackets: TaxBracketLine[] = PIT_BRACKETS.map((bracket) => {
    const above = Decimal.max(taxableIncome.minus(lower), ZERO);
    const taxedIncome =
      bracket.cap === null ? above : Decimal.min(above, bracket.cap.minus(lower));
    const amount = taxedIncome.mul(bracket.rate);
    totalTax = totalTax.plus(amount);
    if (bracket.cap !== null) lower = bracket.cap;
    return { rate: bracket.rate, range: bracket.label, taxedIncome, amount };
  });

  const net = preTaxIncome.minus(totalTax);

  return {
    gross,
    net,
    insurance: { bhxh, bhyt, bhtn, total: insuranceTotal, bhxhBase, bhtnBase },
    deductions: { personal, dependents: dependentsDeduction, total: deductionsTotal },
    preTaxIncome,
    taxableIncome,
    taxBrackets,
    totalTax,
    employerCost: {
      bhxh: employerBhxh,
      bhyt: employerBhyt,
      bhtn: employerBhtn,
      total: employerTotal,
      totalCost: gross.plus(employerTotal),
    },
  };
}

/**
 * Invert {@link grossToNet}: find the gross salary that yields the given net.
 *
 * Net is strictly non-decreasing in gross, so a binary search converges.
 * Search range: [net, net × 3 + total deductions] (top marginal burden keeps
 * gross under ~1.8 × net, so the upper bound is comfortably high; it is still
 * doubled defensively if ever insufficient). Iterates until the bracket is
 * ≤ 1 ₫ wide (max 60 iterations), then snaps to the smallest whole-đồng gross
 * whose net reaches the target — exact round numbers invert exactly.
 */
export function netToGross(input: NetToGrossInput): SalaryBreakdown {
  const { net, region, config } = input;
  const dependents = Math.max(0, Math.floor(input.dependents));
  const base: Omit<GrossToNetInput, "gross"> = {
    dependents,
    region,
    insuranceBase: input.insuranceBase,
    config,
  };
  const computeNet = (gross: Decimal) => grossToNet({ ...base, gross }).net;

  const target = Decimal.max(net, ZERO);
  const deductionsTotal = config.personalDeduction.plus(
    config.dependentDeduction.mul(dependents),
  );

  let lo = target; // net ≤ gross always, so f(lo) ≤ target
  let hi = target.mul(3).plus(deductionsTotal);
  for (let i = 0; i < 8 && computeNet(hi).lt(target); i++) hi = hi.mul(2);

  for (let i = 0; i < 60 && hi.minus(lo).gt(1); i++) {
    const mid = lo.plus(hi).div(2);
    if (computeNet(mid).lt(target)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  // Snap to whole đồng: smallest integer gross with net ≥ target.
  let gross = hi.floor();
  if (computeNet(gross).lt(target)) gross = gross.plus(1);

  return grossToNet({ ...base, gross });
}
