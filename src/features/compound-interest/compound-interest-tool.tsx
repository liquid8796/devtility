"use client";

import { useId, useMemo, useState } from "react";

import { PiggyBank } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Select, TextInput } from "@/components/ui/field";
import type { Localized } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/use-lang";
import { Decimal, dec, formatDecimalVN, parseDecimal } from "@/lib/math/decimal";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────────
 * Simulation — all arithmetic on Decimal (no binary floating point).
 *
 * Month-by-month loop: the extra contribution is deposited at the END of
 * each month; interest is credited at the end of every compounding period
 * (rate per period = annual rate / periods per year). Months that have not
 * completed a full compounding period earn no interest — matching how term
 * savings accounts credit interest.
 * ──────────────────────────────────────────────────────────────────── */

interface YearRow {
  year: number;
  monthsInYear: number;
  contribCum: Decimal;
  interestYear: Decimal;
  interestCum: Decimal;
  balance: Decimal;
}

interface SimulationResult {
  rows: YearRow[];
  balance: Decimal;
  totalContrib: Decimal;
  totalInterest: Decimal;
}

function simulate(
  principal: Decimal,
  monthly: Decimal,
  annualRatePct: Decimal,
  totalMonths: number,
  periodsPerYear: number,
): SimulationResult {
  const monthsPerPeriod = 12 / periodsPerYear; // 1 | 3 | 6 | 12
  const ratePerPeriod = annualRatePct.div(100).div(periodsPerYear);

  let balance = principal;
  let contrib = principal;
  let totalInterest = dec(0);
  let yearInterest = dec(0);
  const rows: YearRow[] = [];

  for (let m = 1; m <= totalMonths; m += 1) {
    if (!monthly.isZero()) {
      balance = balance.add(monthly);
      contrib = contrib.add(monthly);
    }
    if (m % monthsPerPeriod === 0 && !ratePerPeriod.isZero()) {
      const interest = balance.mul(ratePerPeriod);
      balance = balance.add(interest);
      totalInterest = totalInterest.add(interest);
      yearInterest = yearInterest.add(interest);
    }
    if (m % 12 === 0 || m === totalMonths) {
      rows.push({
        year: Math.ceil(m / 12),
        monthsInYear: m % 12 === 0 ? 12 : m % 12,
        contribCum: contrib,
        interestYear: yearInterest,
        interestCum: totalInterest,
        balance,
      });
      yearInterest = dec(0);
    }
  }

  return { rows, balance, totalContrib: contrib, totalInterest };
}

/* ── Input helpers ──────────────────────────────────────────────────── */

function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function MoneyInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (digits: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <TextInput
        id={id}
        inputMode="numeric"
        autoComplete="off"
        className="pr-8 text-right font-mono"
        value={value ? groupDigits(value) : ""}
        placeholder={placeholder ?? "0"}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 15);
          onChange(digits);
        }}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₫</span>
    </div>
  );
}

function IntInput({
  id,
  value,
  onChange,
  suffix,
  max,
  ariaLabel,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  suffix: string;
  max: number;
  ariaLabel: string;
}) {
  return (
    <div className="relative">
      <TextInput
        id={id}
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        className="pr-14 text-right font-mono"
        value={value}
        placeholder="0"
        onChange={(e) => {
          let digits = e.target.value.replace(/\D/g, "").slice(0, 4);
          if (digits) digits = String(Math.min(parseInt(digits, 10), max));
          onChange(digits);
        }}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
        {suffix}
      </span>
    </div>
  );
}

const FREQ_LABELS: Record<string, Localized> = {
  "12": { vi: "hàng tháng", en: "monthly" },
  "4": { vi: "hàng quý", en: "quarterly" },
  "2": { vi: "6 tháng một lần", en: "every 6 months" },
  "1": { vi: "hàng năm", en: "yearly" },
};

const M = {
  inputsTitle: { vi: "Thông tin gửi tiền", en: "Deposit details" },
  inputsSubtitle: { vi: "Tính lãi kép cho khoản tiết kiệm của bạn", en: "Calculate compound interest on your savings" },
  principalLabel: { vi: "Số tiền gửi ban đầu", en: "Initial deposit" },
  monthlyLabel: { vi: "Gửi thêm hàng tháng", en: "Monthly contribution" },
  monthlyHint: {
    vi: "Không bắt buộc — khoản gửi thêm được cộng vào cuối mỗi tháng",
    en: "Optional — contributions are added at the end of each month",
  },
  rateLabel: { vi: "Lãi suất", en: "Interest rate" },
  rateError: {
    vi: "Lãi suất không hợp lệ — nhập số không âm, ví dụ 6,5",
    en: "Invalid interest rate — enter a non-negative number, e.g. 6.5",
  },
  ratePlaceholder: { vi: "6,5", en: "6.5" },
  rateSuffix: { vi: "%/năm", en: "%/year" },
  termLabel: { vi: "Thời gian gửi", en: "Deposit term" },
  yearsSuffix: { vi: "năm", en: "years" },
  monthsSuffix: { vi: "tháng", en: "months" },
  yearsAria: { vi: "Số năm gửi", en: "Number of years" },
  monthsAria: { vi: "Số tháng gửi thêm", en: "Number of additional months" },
  freqLabel: { vi: "Tần suất ghép lãi", en: "Compounding frequency" },
  freqMonthly: { vi: "Hàng tháng", en: "Monthly" },
  freqQuarterly: { vi: "Hàng quý", en: "Quarterly" },
  freqSemiannual: { vi: "6 tháng", en: "Every 6 months" },
  freqYearly: { vi: "Hàng năm", en: "Yearly" },
  resultsTitle: { vi: "Kết quả", en: "Results" },
  resultsPlaceholder: { vi: "Kết quả sẽ hiển thị tại đây", en: "Results will appear here" },
  copyFinalBalance: { vi: "Sao chép tổng tiền cuối kỳ", en: "Copy the final balance" },
  finalBalance: { vi: "Tổng tiền cuối kỳ", en: "Final balance" },
  totalContrib: { vi: "Tổng gốc đã gửi", en: "Total principal deposited" },
  totalInterest: { vi: "Tổng lãi nhận được", en: "Total interest earned" },
  vsPrincipal: { vi: "so với vốn gốc", en: "compared to principal" },
  legendPrincipal: { vi: "Gốc", en: "Principal" },
  legendInterest: { vi: "Lãi", en: "Interest" },
  creditNote: {
    vi: "Lãi được ghi nhận vào cuối mỗi kỳ ghép lãi; các tháng chưa tròn kỳ chưa được tính lãi. Kết quả chỉ mang tính tham khảo.",
    en: "Interest is credited at the end of each compounding period; months that have not completed a full period earn no interest yet. Results are for reference only.",
  },
  emptyInvalidRate: {
    vi: "Vui lòng kiểm tra lại lãi suất để xem kết quả.",
    en: "Please check the interest rate to see the results.",
  },
  emptyPrompt: {
    vi: "Nhập số tiền gửi (hoặc khoản gửi thêm hàng tháng) và thời gian gửi để xem kết quả lãi kép.",
    en: "Enter an initial deposit (or a monthly contribution) and a deposit term to see the compound interest results.",
  },
  tableTitle: { vi: "Bảng chi tiết theo năm", en: "Year-by-year breakdown" },
  tableSubtitle: { vi: "Đơn vị: đồng (₫)", en: "Unit: Vietnamese dong (₫)" },
  colYear: { vi: "Năm", en: "Year" },
  colContribCum: { vi: "Gốc lũy kế", en: "Cumulative principal" },
  colInterestYear: { vi: "Lãi trong năm", en: "Interest for the year" },
  colInterestCum: { vi: "Lãi lũy kế", en: "Cumulative interest" },
  colBalance: { vi: "Số dư cuối năm", en: "Year-end balance" },
} satisfies Record<string, Localized>;

function money(d: Decimal, locale: string): string {
  return `${formatDecimalVN(d, 0, locale)} ₫`;
}

/* ── Component ──────────────────────────────────────────────────────── */

export default function CompoundInterestTool() {
  const { t, locale } = useI18n();
  const uid = useId();
  const ids = {
    principal: `${uid}-principal`,
    monthly: `${uid}-monthly`,
    rate: `${uid}-rate`,
    years: `${uid}-years`,
    months: `${uid}-months`,
    freq: `${uid}-freq`,
  };

  const [principal, setPrincipal] = useState("100000000");
  const [monthly, setMonthly] = useState("");
  const [rate, setRate] = useState("6");
  const [years, setYears] = useState("5");
  const [months, setMonths] = useState("");
  const [freq, setFreq] = useState("12");

  const computed = useMemo(() => {
    const principalD = principal ? parseDecimal(principal) ?? dec(0) : dec(0);
    const monthlyD = monthly ? parseDecimal(monthly) ?? dec(0) : dec(0);
    const rateD = rate.trim() ? parseDecimal(rate) : dec(0);
    const rateInvalid = rateD === null || rateD.isNegative() || rateD.gt(1000);
    const yearsN = years ? parseInt(years, 10) : 0;
    const monthsN = months ? parseInt(months, 10) : 0;
    const totalMonths = Math.min(yearsN * 12 + monthsN, 1220);
    const periodsPerYear = parseInt(freq, 10);

    const ready = !rateInvalid && totalMonths > 0 && (principalD.gt(0) || monthlyD.gt(0));
    const result = ready
      ? simulate(principalD, monthlyD, rateD ?? dec(0), totalMonths, periodsPerYear)
      : null;

    const growthPct =
      result && result.totalContrib.gt(0) ? result.totalInterest.div(result.totalContrib).mul(100) : null;

    return { rateInvalid, totalMonths, yearsN, monthsN, result, growthPct };
  }, [principal, monthly, rate, years, months, freq]);

  const { rateInvalid, result, growthPct, yearsN, monthsN } = computed;

  const durationLabel = [
    yearsN > 0 ? t({ vi: `${yearsN} năm`, en: yearsN === 1 ? "1 year" : `${yearsN} years` }) : null,
    monthsN > 0 ? t({ vi: `${monthsN} tháng`, en: monthsN === 1 ? "1 month" : `${monthsN} months` }) : null,
  ]
    .filter(Boolean)
    .join(" ");

  const barPrincipalPct =
    result && result.balance.gt(0)
      ? Math.min(100, Math.max(0, result.totalContrib.div(result.balance).mul(100).toNumber()))
      : 0;
  const barInterestPct = result ? Math.max(0, 100 - barPrincipalPct) : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-5">
        {/* ── Inputs ─────────────────────────────────────────────── */}
        <Card className="lg:col-span-2">
          <CardHeader title={t(M.inputsTitle)} subtitle={t(M.inputsSubtitle)} />
          <CardBody className="space-y-4">
            <Field label={t(M.principalLabel)} htmlFor={ids.principal}>
              <MoneyInput id={ids.principal} value={principal} onChange={setPrincipal} placeholder="100.000.000" />
            </Field>

            <Field
              label={t(M.monthlyLabel)}
              htmlFor={ids.monthly}
              hint={t(M.monthlyHint)}
            >
              <MoneyInput id={ids.monthly} value={monthly} onChange={setMonthly} placeholder="0" />
            </Field>

            <Field
              label={t(M.rateLabel)}
              htmlFor={ids.rate}
              hint={
                rateInvalid && rate.trim() ? (
                  <span className="text-danger">{t(M.rateError)}</span>
                ) : undefined
              }
            >
              <div className="relative">
                <TextInput
                  id={ids.rate}
                  inputMode="decimal"
                  autoComplete="off"
                  className="pr-16 text-right font-mono"
                  value={rate}
                  placeholder={t(M.ratePlaceholder)}
                  onChange={(e) => setRate(e.target.value.replace(/[^0-9.,]/g, "").slice(0, 10))}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {t(M.rateSuffix)}
                </span>
              </div>
            </Field>

            <Field label={t(M.termLabel)}>
              <div className="grid grid-cols-2 gap-2">
                <IntInput id={ids.years} value={years} onChange={setYears} suffix={t(M.yearsSuffix)} max={100} ariaLabel={t(M.yearsAria)} />
                <IntInput id={ids.months} value={months} onChange={setMonths} suffix={t(M.monthsSuffix)} max={11} ariaLabel={t(M.monthsAria)} />
              </div>
            </Field>

            <Field label={t(M.freqLabel)} htmlFor={ids.freq}>
              <Select id={ids.freq} value={freq} onChange={(e) => setFreq(e.target.value)}>
                <option value="12">{t(M.freqMonthly)}</option>
                <option value="4">{t(M.freqQuarterly)}</option>
                <option value="2">{t(M.freqSemiannual)}</option>
                <option value="1">{t(M.freqYearly)}</option>
              </Select>
            </Field>
          </CardBody>
        </Card>

        {/* ── Results ────────────────────────────────────────────── */}
        <Card className="lg:col-span-3">
          <CardHeader
            title={t(M.resultsTitle)}
            subtitle={
              result
                ? t({
                    vi: `Gửi ${durationLabel || "—"} · ghép lãi ${FREQ_LABELS[freq]?.vi ?? ""}`,
                    en: `Deposit for ${durationLabel || "—"} · compounded ${FREQ_LABELS[freq]?.en ?? ""}`,
                  })
                : t(M.resultsPlaceholder)
            }
            actions={result ? <CopyButton text={money(result.balance, locale)} label={t(M.copyFinalBalance)} /> : undefined}
          />
          <CardBody>
            {result ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-accent/30 bg-accent/10 p-4 sm:col-span-3 lg:col-span-1">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">{t(M.finalBalance)}</p>
                    <p className="mt-1 break-all font-mono text-2xl font-bold text-accent">{money(result.balance, locale)}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/40 p-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">{t(M.totalContrib)}</p>
                    <p className="mt-1 break-all font-mono text-lg font-semibold text-foreground">
                      {money(result.totalContrib, locale)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/40 p-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">{t(M.totalInterest)}</p>
                    <p className="mt-1 break-all font-mono text-lg font-semibold text-success">
                      {money(result.totalInterest, locale)}
                    </p>
                    {growthPct ? (
                      <p className="mt-0.5 text-xs text-success">+{formatDecimalVN(growthPct, 2, locale)}% {t(M.vsPrincipal)}</p>
                    ) : null}
                  </div>
                </div>

                {/* Stacked principal-vs-interest bar */}
                <div>
                  <div
                    className="flex h-4 w-full overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={t({
                      vi: `Tỷ lệ gốc ${barPrincipalPct.toFixed(1)}%, lãi ${barInterestPct.toFixed(1)}%`,
                      en: `Principal ${barPrincipalPct.toFixed(1)}%, interest ${barInterestPct.toFixed(1)}%`,
                    })}
                  >
                    <div className="h-full bg-primary transition-all" style={{ width: `${barPrincipalPct}%` }} />
                    <div className="h-full bg-success transition-all" style={{ width: `${barInterestPct}%` }} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                      {t(M.legendPrincipal)} · {barPrincipalPct.toFixed(1)}%
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-success" />
                      {t(M.legendInterest)} · {barInterestPct.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">{t(M.creditNote)}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                <PiggyBank className="h-9 w-9 text-muted-foreground/50" aria-hidden />
                <p className="max-w-sm text-sm text-muted-foreground">
                  {rateInvalid && rate.trim() ? t(M.emptyInvalidRate) : t(M.emptyPrompt)}
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ── Year-by-year table ─────────────────────────────────────── */}
      {result && result.rows.length > 0 ? (
        <Card>
          <CardHeader title={t(M.tableTitle)} subtitle={t(M.tableSubtitle)} />
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      {t(M.colYear)}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">
                      {t(M.colContribCum)}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">
                      {t(M.colInterestYear)}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">
                      {t(M.colInterestCum)}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">
                      {t(M.colBalance)}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, idx) => (
                    <tr
                      key={row.year}
                      className={cn(
                        "border-b border-border/60 last:border-0",
                        idx === result.rows.length - 1 && "bg-primary/5 font-medium",
                      )}
                    >
                      <td className="whitespace-nowrap px-4 py-2 text-foreground">
                        {t({ vi: `Năm ${row.year}`, en: `Year ${row.year}` })}
                        {row.monthsInYear < 12 ? (
                          <span className="text-xs text-muted-foreground">
                            {" "}
                            (
                            {t({
                              vi: `${row.monthsInYear} tháng`,
                              en: row.monthsInYear === 1 ? "1 month" : `${row.monthsInYear} months`,
                            })}
                            )
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-foreground">
                        {formatDecimalVN(row.contribCum, 0, locale)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-success">
                        {formatDecimalVN(row.interestYear, 0, locale)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-success">
                        {formatDecimalVN(row.interestCum, 0, locale)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-semibold text-foreground">
                        {formatDecimalVN(row.balance, 0, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
              {t({
                vi: `Khoản gửi thêm được cộng vào cuối mỗi tháng; lãi ghi nhận ${FREQ_LABELS[freq]?.vi ?? ""} theo tần suất ghép lãi đã chọn.`,
                en: `Contributions are added at the end of each month; interest is credited ${FREQ_LABELS[freq]?.en ?? ""} according to the selected compounding frequency.`,
              })}
            </p>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
