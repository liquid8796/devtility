"use client";

import { Building2, ChevronDown, Info, TriangleAlert } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Select, TextInput } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
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

const REGION_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "1", label: "Vùng I – Hà Nội, TP.HCM, Hải Phòng…" },
  { value: "2", label: "Vùng II – Đà Nẵng, Cần Thơ, Hạ Long…" },
  { value: "3", label: "Vùng III – Thành phố, thị xã thuộc tỉnh…" },
  { value: "4", label: "Vùng IV – Các địa bàn còn lại" },
];

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

function fmtVND(value: Decimal): string {
  return `${formatDecimalVN(value, 0)} ₫`;
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
        {value ? fmtVND(value) : "—"}
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
        {fmtVND(value)}
      </td>
    </tr>
  );
}

export default function SalaryTool() {
  const uid = useId();
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
    direction === "gross-to-net" ? "Lương Gross (₫/tháng)" : "Lương Net (₫/tháng)";
  const amountHint = amountEmpty
    ? "Nhập mức lương để bắt đầu tính toán."
    : amountInvalid
      ? "Mức lương không hợp lệ — hãy nhập một số dương."
      : undefined;

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
            title="Thông tin thu nhập"
            subtitle={
              direction === "gross-to-net"
                ? "Tính lương Net từ lương Gross"
                : "Tính ngược lương Gross từ lương Net"
            }
          />
          <CardBody className="space-y-4">
            <Field label={amountLabel} htmlFor={`${uid}-amount`} hint={amountHint}>
              <TextInput
                id={`${uid}-amount`}
                inputMode="numeric"
                autoComplete="off"
                placeholder="VD: 30.000.000"
                value={amountRaw}
                onChange={(event) => setAmountRaw(normalizeMoneyInput(event.target.value))}
                className={cn("font-mono", amountInvalid && "border-danger/60")}
                aria-invalid={amountInvalid || undefined}
              />
            </Field>

            <Field
              label="Số người phụ thuộc"
              htmlFor={`${uid}-dependents`}
              hint={
                !dependentsValid && dependentsRaw.trim() !== ""
                  ? "Giá trị không hợp lệ — dùng số nguyên ≥ 0 (tạm tính 0)."
                  : `Giảm trừ ${formatDecimalVN(config.dependentDeduction, 0)} ₫/người/tháng.`
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

            <Field label="Vùng lương tối thiểu" htmlFor={`${uid}-region`}>
              <Select
                id={`${uid}-region`}
                value={regionRaw}
                onChange={(event) => setRegionRaw(event.target.value)}
              >
                {REGION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Chế độ giảm trừ" htmlFor={`${uid}-preset`}>
              <Select
                id={`${uid}-preset`}
                value={presetKey}
                onChange={(event) => setPresetKey(event.target.value as PresetKey)}
              >
                <option value="2026">Quy định 2026 (GTGC 15,5tr/6,2tr)</option>
                <option value="2025">Quy định 2025 (GTGC 11tr/4,4tr)</option>
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
                Đóng bảo hiểm trên mức khác
              </label>
              {customBase ? (
                <Field
                  label="Mức lương đóng bảo hiểm (₫/tháng)"
                  htmlFor={`${uid}-insurance`}
                  hint={`Bỏ trống = đóng trên lương gross. Trần BHXH/BHYT ${formatDecimalVN(bhxhCap, 0)} ₫ · trần BHTN ${formatDecimalVN(bhtnCap, 0)} ₫.`}
                >
                  <TextInput
                    id={`${uid}-insurance`}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="VD: 10.000.000"
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
              label="Lương Gross"
              value={result ? result.gross : null}
              accent={direction === "net-to-gross"}
              note="Trước bảo hiểm & thuế"
            />
            <ResultTile
              label="Lương Net"
              value={result ? result.net : null}
              accent={direction === "gross-to-net"}
              note="Thực nhận mỗi tháng"
            />
            <ResultTile
              label="Chi phí doanh nghiệp"
              value={result ? result.employerCost.totalCost : null}
              note="Gross + bảo hiểm DN đóng"
            />
          </div>

          {netNegative ? (
            <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                Mức đóng bảo hiểm cao hơn thu nhập — lương thực nhận âm. Hãy kiểm tra lại mức
                lương đóng bảo hiểm.
              </span>
            </div>
          ) : null}

          <Card>
            <CardHeader
              title="Bảng diễn giải"
              subtitle={`Chế độ ${config.label} · ${dependents} người phụ thuộc · Vùng ${["I", "II", "III", "IV"][region - 1]}`}
            />
            <CardBody className="p-0">
              {result ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[320px] text-sm">
                    <tbody className="[&_td]:px-5">
                      <BreakdownRow label="Lương Gross" value={result.gross} emphasis="gross" />
                      <BreakdownRow label="BHXH (8%)" value={result.insurance.bhxh} negative />
                      <BreakdownRow label="BHYT (1,5%)" value={result.insurance.bhyt} negative />
                      <BreakdownRow label="BHTN (1%)" value={result.insurance.bhtn} negative />
                      <BreakdownRow label="Thu nhập trước thuế" value={result.preTaxIncome} />
                      <BreakdownRow
                        label="Giảm trừ bản thân"
                        value={result.deductions.personal}
                        muted
                      />
                      <BreakdownRow
                        label="Giảm trừ người phụ thuộc"
                        value={result.deductions.dependents}
                        muted
                      />
                      <BreakdownRow label="Thu nhập tính thuế" value={result.taxableIncome} />
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
                              Thuế TNCN
                            </button>
                          ) : (
                            "Thuế TNCN"
                          )}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-danger">
                          −{fmtVND(result.totalTax)}
                        </td>
                      </tr>
                      {showBrackets
                        ? nonZeroBrackets.map((bracket) => (
                            <tr key={bracket.range} className="border-b border-border bg-muted/40">
                              <td className="py-1.5 pr-4 !pl-10 text-xs text-muted-foreground">
                                {bracket.range}
                              </td>
                              <td className="py-1.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                                {fmtVND(bracket.amount)}
                              </td>
                            </tr>
                          ))
                        : null}
                      <BreakdownRow label="Lương Net" value={result.net} emphasis="net" />
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                  {amountInvalid
                    ? "Dữ liệu chưa hợp lệ — kiểm tra lại mức lương đã nhập."
                    : "Nhập mức lương để xem bảng diễn giải chi tiết."}
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Chi phí của người sử dụng lao động"
              subtitle="Bảo hiểm doanh nghiệp đóng ngoài lương gross"
              actions={<Building2 className="h-4 w-4 text-muted-foreground" aria-hidden />}
            />
            <CardBody>
              {result ? (
                <dl className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">Lương Gross</dt>
                    <dd className="font-mono tabular-nums">{fmtVND(result.gross)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">BHXH (17,5%)</dt>
                    <dd className="font-mono tabular-nums">{fmtVND(result.employerCost.bhxh)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">BHYT (3%)</dt>
                    <dd className="font-mono tabular-nums">{fmtVND(result.employerCost.bhyt)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">BHTN (1%)</dt>
                    <dd className="font-mono tabular-nums">{fmtVND(result.employerCost.bhtn)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-border pt-2">
                    <dt className="font-medium text-foreground">Tổng chi phí</dt>
                    <dd className="font-mono font-semibold tabular-nums text-accent">
                      {fmtVND(result.employerCost.totalCost)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="py-2 text-center text-sm text-muted-foreground">
                  Chưa có dữ liệu để tính chi phí doanh nghiệp.
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          Số liệu tính theo quy định hiện hành (lương cơ sở 2,34 triệu; lương tối thiểu vùng từ
          01/07/2024; giảm trừ gia cảnh theo chế độ đã chọn). Kết quả mang tính tham khảo.
        </span>
      </p>
    </div>
  );
}
