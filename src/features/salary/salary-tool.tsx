"use client";

import { Building2, ChevronDown, Info, TriangleAlert } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Select, TextInput } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import type { Localized } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/use-lang";
import { Decimal, formatDecimalVN, parseDecimal } from "@/lib/math/decimal";
import {
  PRESET_2025,
  PRESET_2026,
  grossToNet,
  netToGross,
  type Region,
  type SalaryBreakdown,
  type TaxConfig,
} from "@/lib/salary/vn-tax";
import { cn } from "@/lib/utils";

type Direction = "gross-to-net" | "net-to-gross";
type PresetKey = "2026" | "2025";

const DIRECTION_TABS = [
  { value: "gross-to-net", label: "Gross → Net" },
  { value: "net-to-gross", label: "Net → Gross" },
] as const;

const REGION_OPTIONS: ReadonlyArray<{ value: string; label: Localized }> = [
  {
    value: "1",
    label: {
      vi: "Vùng I – Hà Nội, TP.HCM, Hải Phòng…",
      en: "Region I – Hanoi, HCMC, Hai Phong…",
    },
  },
  {
    value: "2",
    label: {
      vi: "Vùng II – Đà Nẵng, Cần Thơ, Hạ Long…",
      en: "Region II – Da Nang, Can Tho, Ha Long…",
    },
  },
  {
    value: "3",
    label: {
      vi: "Vùng III – Thành phố, thị xã thuộc tỉnh…",
      en: "Region III – Provincial cities and towns…",
    },
  },
  {
    value: "4",
    label: { vi: "Vùng IV – Các địa bàn còn lại", en: "Region IV – All remaining areas" },
  },
];

const M = {
  inputsTitle: { vi: "Thông tin thu nhập", en: "Income details" },
  inputsSubtitleG2N: { vi: "Tính lương Net từ lương Gross", en: "Calculate Net salary from Gross" },
  inputsSubtitleN2G: {
    vi: "Tính ngược lương Gross từ lương Net",
    en: "Work back Gross salary from Net",
  },
  grossAmountLabel: { vi: "Lương Gross (₫/tháng)", en: "Gross salary (₫/month)" },
  netAmountLabel: { vi: "Lương Net (₫/tháng)", en: "Net salary (₫/month)" },
  amountPlaceholder: { vi: "VD: 30.000.000", en: "e.g. 30.000.000" },
  amountEmptyHint: {
    vi: "Nhập mức lương để bắt đầu tính toán.",
    en: "Enter a salary to start calculating.",
  },
  amountInvalidHint: {
    vi: "Mức lương không hợp lệ — hãy nhập một số dương.",
    en: "Invalid salary — enter a positive number.",
  },
  dependentsLabel: { vi: "Số người phụ thuộc", en: "Number of dependents" },
  dependentsInvalidHint: {
    vi: "Giá trị không hợp lệ — dùng số nguyên ≥ 0 (tạm tính 0).",
    en: "Invalid value — use a whole number ≥ 0 (0 assumed).",
  },
  regionLabel: { vi: "Vùng lương tối thiểu", en: "Minimum wage region" },
  presetLabel: { vi: "Chế độ giảm trừ", en: "Deduction scheme" },
  preset2026: {
    vi: "Quy định 2026 (GTGC 15,5tr/6,2tr)",
    en: "2026 rules (deductions 15.5M/6.2M)",
  },
  preset2025: {
    vi: "Quy định 2025 (GTGC 11tr/4,4tr)",
    en: "2025 rules (deductions 11M/4.4M)",
  },
  customBaseToggle: {
    vi: "Đóng bảo hiểm trên mức khác",
    en: "Pay insurance on a different base",
  },
  insuranceBaseLabel: {
    vi: "Mức lương đóng bảo hiểm (₫/tháng)",
    en: "Insurance contribution base (₫/month)",
  },
  insurancePlaceholder: { vi: "VD: 10.000.000", en: "e.g. 10.000.000" },
  grossTile: { vi: "Lương Gross", en: "Gross salary" },
  grossTileNote: { vi: "Trước bảo hiểm & thuế", en: "Before insurance & tax" },
  netTile: { vi: "Lương Net", en: "Net salary" },
  netTileNote: { vi: "Thực nhận mỗi tháng", en: "Take-home pay per month" },
  employerTile: { vi: "Chi phí doanh nghiệp", en: "Employer cost" },
  employerTileNote: { vi: "Gross + bảo hiểm DN đóng", en: "Gross + employer-paid insurance" },
  negativeNetWarning: {
    vi: "Mức đóng bảo hiểm cao hơn thu nhập — lương thực nhận âm. Hãy kiểm tra lại mức lương đóng bảo hiểm.",
    en: "Insurance contributions exceed income — take-home pay is negative. Double-check the insurance contribution base.",
  },
  breakdownTitle: { vi: "Bảng diễn giải", en: "Breakdown" },
  rowGross: { vi: "Lương Gross", en: "Gross salary" },
  rowBhxh: { vi: "BHXH (8%)", en: "Social insurance (BHXH, 8%)" },
  rowBhyt: { vi: "BHYT (1,5%)", en: "Health insurance (BHYT, 1.5%)" },
  rowBhtn: { vi: "BHTN (1%)", en: "Unemployment insurance (BHTN, 1%)" },
  rowPreTax: { vi: "Thu nhập trước thuế", en: "Pre-tax income" },
  rowPersonalDeduction: { vi: "Giảm trừ bản thân", en: "Personal deduction" },
  rowDependentDeduction: { vi: "Giảm trừ người phụ thuộc", en: "Dependent deduction" },
  rowTaxable: { vi: "Thu nhập tính thuế", en: "Taxable income" },
  rowPit: { vi: "Thuế TNCN", en: "Personal income tax" },
  rowNet: { vi: "Lương Net", en: "Net salary" },
  breakdownInvalid: {
    vi: "Dữ liệu chưa hợp lệ — kiểm tra lại mức lương đã nhập.",
    en: "Invalid input — check the salary you entered.",
  },
  breakdownEmpty: {
    vi: "Nhập mức lương để xem bảng diễn giải chi tiết.",
    en: "Enter a salary to see the detailed breakdown.",
  },
  employerCardTitle: {
    vi: "Chi phí của người sử dụng lao động",
    en: "Employer cost",
  },
  employerCardSubtitle: {
    vi: "Bảo hiểm doanh nghiệp đóng ngoài lương gross",
    en: "Employer-paid insurance on top of gross salary",
  },
  employerBhxh: { vi: "BHXH (17,5%)", en: "Social insurance (BHXH, 17.5%)" },
  employerBhyt: { vi: "BHYT (3%)", en: "Health insurance (BHYT, 3%)" },
  employerBhtn: { vi: "BHTN (1%)", en: "Unemployment insurance (BHTN, 1%)" },
  employerTotal: { vi: "Tổng chi phí", en: "Total cost" },
  employerEmpty: {
    vi: "Chưa có dữ liệu để tính chi phí doanh nghiệp.",
    en: "No data yet to calculate employer cost.",
  },
  disclaimer: {
    vi: "Số liệu tính theo quy định hiện hành (lương cơ sở 2,34 triệu; lương tối thiểu vùng từ 01/07/2024; giảm trừ gia cảnh theo chế độ đã chọn). Kết quả mang tính tham khảo.",
    en: "Figures follow current regulations (statutory base salary of 2.34 million ₫; regional minimum wage effective 01/07/2024; family deductions per the selected scheme). Results are for reference only.",
  },
} satisfies Record<string, Localized>;

const PRESETS: Record<PresetKey, TaxConfig> = {
  "2026": PRESET_2026,
  "2025": PRESET_2025,
};

/** "30000000" → "30.000.000" (grouping only, salary inputs are whole ₫). */
function groupDigits(digits: string): string {
  const trimmed = digits.replace(/^0+(?=\d)/, "");
  return trimmed.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Keep only digits from user input and re-apply live thousands grouping. */
function normalizeMoneyInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 15);
  return digits ? groupDigits(digits) : "";
}

/** Parse a formatted money string ("30.000.000") into a Decimal, or null. */
function parseMoney(raw: string): Decimal | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  return parseDecimal(digits);
}

function fmtVND(value: Decimal, locale: string): string {
  return `${formatDecimalVN(value, 0, locale)} ₫`;
}

function ResultTile({
  label,
  value,
  accent,
  note,
}: {
  label: string;
  value: Decimal | null;
  accent?: boolean;
  note?: string;
}) {
  const { locale } = useI18n();
  return (
    <div
      className={cn(
        "card-surface flex flex-col gap-1 p-4",
        accent && "border-primary/50 ring-1 ring-primary/25",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {value ? <CopyButton text={value.toDecimalPlaces(0).toString()} /> : null}
      </div>
      <span
        className={cn(
          "break-all font-mono text-xl font-semibold sm:text-2xl",
          accent ? "text-primary" : "text-foreground",
        )}
      >
        {value ? fmtVND(value, locale) : "—"}
      </span>
      {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  negative,
  emphasis,
  muted,
}: {
  label: string;
  value: Decimal;
  negative?: boolean;
  emphasis?: "gross" | "net";
  muted?: boolean;
}) {
  const { locale } = useI18n();
  return (
    <tr className="border-b border-border last:border-0">
      <td
        className={cn(
          "py-2 pr-4 align-top",
          emphasis ? "font-medium text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </td>
      <td
        className={cn(
          "py-2 text-right font-mono tabular-nums",
          emphasis === "net" && "font-semibold text-success",
          emphasis === "gross" && "font-semibold text-foreground",
          !emphasis && (negative ? "text-danger" : muted ? "text-muted-foreground" : "text-foreground"),
        )}
      >
        {negative ? "−" : ""}
        {fmtVND(value, locale)}
      </td>
    </tr>
  );
}

export default function SalaryTool() {
  const uid = useId();
  const { t, locale } = useI18n();
  const [direction, setDirection] = useState<Direction>("gross-to-net");
  const [amountRaw, setAmountRaw] = useState("30.000.000");
  const [dependentsRaw, setDependentsRaw] = useState("0");
  const [regionRaw, setRegionRaw] = useState("1");
  const [presetKey, setPresetKey] = useState<PresetKey>("2026");
  const [customBase, setCustomBase] = useState(false);
  const [insuranceRaw, setInsuranceRaw] = useState("");
  const [showBrackets, setShowBrackets] = useState(false);

  const config = PRESETS[presetKey];
  const region = Number(regionRaw) as Region;

  const amount = useMemo(() => parseMoney(amountRaw), [amountRaw]);
  const insuranceAmount = useMemo(() => parseMoney(insuranceRaw), [insuranceRaw]);

  const dependentsNum = Number(dependentsRaw);
  const dependentsValid =
    dependentsRaw.trim() !== "" && Number.isInteger(dependentsNum) && dependentsNum >= 0;
  const dependents = dependentsValid ? dependentsNum : 0;

  const amountEmpty = amountRaw.trim() === "";
  const amountInvalid = !amountEmpty && (!amount || amount.lte(0));

  const result: SalaryBreakdown | null = useMemo(() => {
    if (!amount || amount.lte(0)) return null;
    const insuranceBase =
      customBase && insuranceAmount && insuranceAmount.gt(0) ? insuranceAmount : undefined;
    try {
      if (direction === "gross-to-net") {
        return grossToNet({ gross: amount, dependents, region, insuranceBase, config });
      }
      return netToGross({ net: amount, dependents, region, insuranceBase, config });
    } catch {
      return null;
    }
  }, [amount, dependents, region, customBase, insuranceAmount, direction, config]);

  const nonZeroBrackets = result
    ? result.taxBrackets.filter((bracket) => bracket.amount.gt(0))
    : [];
  const netNegative = result !== null && result.net.lt(0);

  const bhxhCap = config.baseSalary.mul(20);
  const bhtnCap = config.regionalMinWage[region].mul(20);

  const amountLabel =
    direction === "gross-to-net" ? t(M.grossAmountLabel) : t(M.netAmountLabel);
  const amountHint = amountEmpty
    ? t(M.amountEmptyHint)
    : amountInvalid
      ? t(M.amountInvalidHint)
      : undefined;

  const dependentDeductionStr = formatDecimalVN(config.dependentDeduction, 0, locale);
  const regionNumeral = ["I", "II", "III", "IV"][region - 1];

  return (
    <div className="space-y-4">
      <Tabs
        items={DIRECTION_TABS}
        value={direction}
        onChange={(value) => setDirection(value)}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {/* ---- Inputs ---- */}
        <Card className="self-start">
          <CardHeader
            title={t(M.inputsTitle)}
            subtitle={
              direction === "gross-to-net" ? t(M.inputsSubtitleG2N) : t(M.inputsSubtitleN2G)
            }
          />
          <CardBody className="space-y-4">
            <Field label={amountLabel} htmlFor={`${uid}-amount`} hint={amountHint}>
              <TextInput
                id={`${uid}-amount`}
                inputMode="numeric"
                autoComplete="off"
                placeholder={t(M.amountPlaceholder)}
                value={amountRaw}
                onChange={(event) => setAmountRaw(normalizeMoneyInput(event.target.value))}
                className={cn("font-mono", amountInvalid && "border-danger/60")}
                aria-invalid={amountInvalid || undefined}
              />
            </Field>

            <Field
              label={t(M.dependentsLabel)}
              htmlFor={`${uid}-dependents`}
              hint={
                !dependentsValid && dependentsRaw.trim() !== ""
                  ? t(M.dependentsInvalidHint)
                  : t({
                      vi: `Giảm trừ ${dependentDeductionStr} ₫/người/tháng.`,
                      en: `Deduction of ${dependentDeductionStr} ₫ per dependent per month.`,
                    })
              }
            >
              <TextInput
                id={`${uid}-dependents`}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={dependentsRaw}
                onChange={(event) => setDependentsRaw(event.target.value)}
                className="font-mono"
              />
            </Field>

            <Field label={t(M.regionLabel)} htmlFor={`${uid}-region`}>
              <Select
                id={`${uid}-region`}
                value={regionRaw}
                onChange={(event) => setRegionRaw(event.target.value)}
              >
                {REGION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.label)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t(M.presetLabel)} htmlFor={`${uid}-preset`}>
              <Select
                id={`${uid}-preset`}
                value={presetKey}
                onChange={(event) => setPresetKey(event.target.value as PresetKey)}
              >
                <option value="2026">{t(M.preset2026)}</option>
                <option value="2025">{t(M.preset2025)}</option>
              </Select>
            </Field>

            <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
              <label
                htmlFor={`${uid}-custom-base`}
                className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
              >
                <input
                  id={`${uid}-custom-base`}
                  type="checkbox"
                  checked={customBase}
                  onChange={(event) => setCustomBase(event.target.checked)}
                  className="h-4 w-4 shrink-0 cursor-pointer rounded border-border accent-(--primary)"
                />
                {t(M.customBaseToggle)}
              </label>
              {customBase ? (
                <Field
                  label={t(M.insuranceBaseLabel)}
                  htmlFor={`${uid}-insurance`}
                  hint={t({
                    vi: `Bỏ trống = đóng trên lương gross. Trần BHXH/BHYT ${formatDecimalVN(bhxhCap, 0, locale)} ₫ · trần BHTN ${formatDecimalVN(bhtnCap, 0, locale)} ₫.`,
                    en: `Leave blank to contribute on gross salary. BHXH/BHYT cap ${formatDecimalVN(bhxhCap, 0, locale)} ₫ · BHTN cap ${formatDecimalVN(bhtnCap, 0, locale)} ₫.`,
                  })}
                >
                  <TextInput
                    id={`${uid}-insurance`}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder={t(M.insurancePlaceholder)}
                    value={insuranceRaw}
                    onChange={(event) => setInsuranceRaw(normalizeMoneyInput(event.target.value))}
                    className="font-mono"
                  />
                </Field>
              ) : null}
            </div>
          </CardBody>
        </Card>

        {/* ---- Results ---- */}
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <ResultTile
              label={t(M.grossTile)}
              value={result ? result.gross : null}
              accent={direction === "net-to-gross"}
              note={t(M.grossTileNote)}
            />
            <ResultTile
              label={t(M.netTile)}
              value={result ? result.net : null}
              accent={direction === "gross-to-net"}
              note={t(M.netTileNote)}
            />
            <ResultTile
              label={t(M.employerTile)}
              value={result ? result.employerCost.totalCost : null}
              note={t(M.employerTileNote)}
            />
          </div>

          {netNegative ? (
            <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{t(M.negativeNetWarning)}</span>
            </div>
          ) : null}

          <Card>
            <CardHeader
              title={t(M.breakdownTitle)}
              subtitle={t({
                vi: `Chế độ ${config.label.vi} · ${dependents} người phụ thuộc · Vùng ${regionNumeral}`,
                en: `${config.label.en} scheme · ${dependents} ${dependents === 1 ? "dependent" : "dependents"} · Region ${regionNumeral}`,
              })}
            />
            <CardBody className="p-0">
              {result ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[320px] text-sm">
                    <tbody className="[&_td]:px-5">
                      <BreakdownRow label={t(M.rowGross)} value={result.gross} emphasis="gross" />
                      <BreakdownRow label={t(M.rowBhxh)} value={result.insurance.bhxh} negative />
                      <BreakdownRow label={t(M.rowBhyt)} value={result.insurance.bhyt} negative />
                      <BreakdownRow label={t(M.rowBhtn)} value={result.insurance.bhtn} negative />
                      <BreakdownRow label={t(M.rowPreTax)} value={result.preTaxIncome} />
                      <BreakdownRow
                        label={t(M.rowPersonalDeduction)}
                        value={result.deductions.personal}
                        muted
                      />
                      <BreakdownRow
                        label={t(M.rowDependentDeduction)}
                        value={result.deductions.dependents}
                        muted
                      />
                      <BreakdownRow label={t(M.rowTaxable)} value={result.taxableIncome} />
                      <tr className="border-b border-border">
                        <td className="py-2 pr-4 align-top text-muted-foreground">
                          {nonZeroBrackets.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setShowBrackets((open) => !open)}
                              aria-expanded={showBrackets}
                              className="inline-flex items-center gap-1 rounded transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                            >
                              <ChevronDown
                                className={cn(
                                  "h-3.5 w-3.5 transition-transform",
                                  !showBrackets && "-rotate-90",
                                )}
                                aria-hidden
                              />
                              {t(M.rowPit)}
                            </button>
                          ) : (
                            t(M.rowPit)
                          )}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-danger">
                          −{fmtVND(result.totalTax, locale)}
                        </td>
                      </tr>
                      {showBrackets
                        ? nonZeroBrackets.map((bracket) => (
                            <tr
                              key={bracket.range.vi}
                              className="border-b border-border bg-muted/40"
                            >
                              <td className="py-1.5 pr-4 !pl-10 text-xs text-muted-foreground">
                                {t(bracket.range)}
                              </td>
                              <td className="py-1.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                                {fmtVND(bracket.amount, locale)}
                              </td>
                            </tr>
                          ))
                        : null}
                      <BreakdownRow label={t(M.rowNet)} value={result.net} emphasis="net" />
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                  {amountInvalid ? t(M.breakdownInvalid) : t(M.breakdownEmpty)}
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={t(M.employerCardTitle)}
              subtitle={t(M.employerCardSubtitle)}
              actions={<Building2 className="h-4 w-4 text-muted-foreground" aria-hidden />}
            />
            <CardBody>
              {result ? (
                <dl className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">{t(M.rowGross)}</dt>
                    <dd className="font-mono tabular-nums">{fmtVND(result.gross, locale)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">{t(M.employerBhxh)}</dt>
                    <dd className="font-mono tabular-nums">
                      {fmtVND(result.employerCost.bhxh, locale)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">{t(M.employerBhyt)}</dt>
                    <dd className="font-mono tabular-nums">
                      {fmtVND(result.employerCost.bhyt, locale)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">{t(M.employerBhtn)}</dt>
                    <dd className="font-mono tabular-nums">
                      {fmtVND(result.employerCost.bhtn, locale)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-border pt-2">
                    <dt className="font-medium text-foreground">{t(M.employerTotal)}</dt>
                    <dd className="font-mono font-semibold tabular-nums text-accent">
                      {fmtVND(result.employerCost.totalCost, locale)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="py-2 text-center text-sm text-muted-foreground">
                  {t(M.employerEmpty)}
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{t(M.disclaimer)}</span>
      </p>
    </div>
  );
}
