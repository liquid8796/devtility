"use client";

import { useState, type ReactNode } from "react";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Tabs } from "@/components/ui/tabs";
import type { Localized } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/use-lang";
import { cn } from "@/lib/utils";

import { formatRaw, useCalculator, type MemoryOp } from "./use-calculator";

type CalcMode = "basic" | "scientific";

const M = {
  tabBasic: { vi: "Cơ bản", en: "Basic" },
  tabScientific: { vi: "Khoa học", en: "Scientific" },
  title: { vi: "Máy tính", en: "Calculator" },
  subtitle: {
    vi: "Cơ bản & Khoa học — độ chính xác thập phân tuyệt đối",
    en: "Basic & Scientific — exact decimal precision",
  },
  angleToggleTitle: {
    vi: "Chuyển đổi độ / radian (áp dụng cho hàm lượng giác)",
    en: "Toggle degrees / radians (applies to trigonometric functions)",
  },
  angleToggleAria: { vi: "Chuyển đổi độ / radian", en: "Toggle degrees / radians" },
  memClear: { vi: "Xóa bộ nhớ", en: "Clear memory" },
  memRecall: { vi: "Gọi lại bộ nhớ", en: "Recall memory" },
  memSubtract: { vi: "Trừ khỏi bộ nhớ", en: "Subtract from memory" },
  memAdd: { vi: "Cộng vào bộ nhớ", en: "Add to memory" },
  memStore: { vi: "Lưu vào bộ nhớ", en: "Store in memory" },
  expAria: { vi: "Nhân 10 mũ n", en: "Multiply by 10 to the power of n" },
  ansAria: { vi: "Kết quả gần nhất", en: "Most recent result" },
  acAria: { vi: "Xóa tất cả", en: "Clear all" },
  backspaceAria: { vi: "Xóa lùi", en: "Backspace" },
  minusAria: { vi: "Trừ", en: "Subtract" },
  plusMinusAria: { vi: "Đổi dấu", en: "Toggle sign" },
  dotAria: { vi: "Dấu thập phân", en: "Decimal point" },
  equalsAria: { vi: "Tính kết quả", en: "Calculate result" },
  keyboardHint: {
    vi: "Hỗ trợ bàn phím: 0–9 · + − × ÷ ^ % ! ( ) · Enter = · Backspace ⌫ · Esc AC",
    en: "Keyboard support: 0–9 · + − × ÷ ^ % ! ( ) · Enter = · Backspace ⌫ · Esc AC",
  },
  historyTitle: { vi: "Lịch sử", en: "History" },
  historySubtitle: { vi: "Nhấn vào một kết quả để dùng lại", en: "Click a result to reuse it" },
  clearHistoryTitle: { vi: "Xóa toàn bộ lịch sử", en: "Clear the entire history" },
  clearHistory: { vi: "Xóa lịch sử", en: "Clear history" },
  memoryPanelLabel: { vi: "Bộ nhớ (M)", en: "Memory (M)" },
  emptyHistory: { vi: "Chưa có phép tính nào.", en: "No calculations yet." },
  emptyPressBefore: { vi: "Nhấn", en: "Press" },
  emptyPressAfter: { vi: "để lưu kết quả vào đây.", en: "to save a result here." },
  useResultTitle: { vi: "Dùng kết quả này làm số mới", en: "Use this result as a new number" },
} satisfies Record<string, Localized>;

type KeyVariant = "digit" | "op" | "action" | "danger" | "equals" | "fn";

const KEY_VARIANTS: Record<KeyVariant, string> = {
  digit: "border border-border bg-card text-foreground hover:bg-muted",
  op: "bg-primary/10 text-primary hover:bg-primary/20",
  action: "bg-muted text-muted-foreground hover:text-foreground",
  danger: "bg-danger/10 text-danger hover:bg-danger/20",
  equals: "bg-primary text-primary-foreground shadow-sm hover:opacity-90",
  fn: "border border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-primary",
};

function Key({
  label,
  onClick,
  variant = "digit",
  className,
  ariaLabel,
  active = false,
  disabled = false,
}: {
  label: ReactNode;
  onClick: () => void;
  variant?: KeyVariant;
  className?: string;
  ariaLabel?: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn(
        "flex select-none items-center justify-center rounded-lg font-medium transition-all active:scale-[0.96]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
        "disabled:pointer-events-none disabled:opacity-40",
        KEY_VARIANTS[variant],
        active && "border-primary/60 bg-primary/10 text-primary",
        className,
      )}
    >
      {label}
    </button>
  );
}

function displaySizeClass(text: string): string {
  const len = text.length;
  if (len <= 12) return "text-4xl";
  if (len <= 20) return "text-3xl";
  if (len <= 30) return "text-2xl";
  return "text-lg leading-snug";
}

export default function CalculatorTool() {
  const { t } = useI18n();
  const [mode, setMode] = useState<CalcMode>("basic");
  const calc = useCalculator();

  const modeTabs = [
    { value: "basic" as const, label: t(M.tabBasic) },
    { value: "scientific" as const, label: t(M.tabScientific) },
  ];

  const memoryDisplay = calc.memory !== null ? formatRaw(calc.memory) : null;
  const memoryVisible = memoryDisplay !== null && memoryDisplay !== "0";

  const memoryButtons: Array<{ op: MemoryOp; label: string; title: string; disabled?: boolean }> = [
    { op: "MC", label: "MC", title: t(M.memClear), disabled: calc.memory === null },
    { op: "MR", label: "MR", title: t(M.memRecall), disabled: calc.memory === null },
    { op: "M-", label: "M−", title: t(M.memSubtract) },
    { op: "M+", label: "M+", title: t(M.memAdd) },
    { op: "MS", label: "MS", title: t(M.memStore) },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* ── Main calculator ─────────────────────────────────────────── */}
      <Card className="lg:col-span-2">
        <CardHeader
          title={t(M.title)}
          subtitle={t(M.subtitle)}
          actions={<Tabs items={modeTabs} value={mode} onChange={setMode} size="sm" />}
        />
        <CardBody className="space-y-3">
          {/* Display */}
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <button
                type="button"
                onClick={calc.toggleAngleMode}
                title={t(M.angleToggleTitle)}
                className="rounded bg-primary/10 px-1.5 py-0.5 font-semibold text-primary transition-colors hover:bg-primary/20"
              >
                {calc.angleMode === "deg" ? "DEG" : "RAD"}
              </button>
              {memoryVisible ? (
                <span className="rounded bg-accent/10 px-1.5 py-0.5 font-semibold text-accent" title={`M = ${memoryDisplay}`}>
                  M
                </span>
              ) : null}
              <span className="ml-auto min-h-4 truncate font-mono" dir="ltr">
                {calc.expressionLine || " "}
              </span>
            </div>
            <div
              className={cn(
                "mt-1 min-h-11 select-text break-all text-right font-mono font-semibold tabular-nums text-foreground",
                calc.hasError ? "text-xl text-danger" : displaySizeClass(calc.displayValue),
              )}
              role="status"
              aria-live="polite"
            >
              {calc.displayValue}
            </div>
          </div>

          {/* Memory row */}
          <div className="grid grid-cols-5 gap-2">
            {memoryButtons.map((b) => (
              <Key
                key={b.op}
                label={b.label}
                ariaLabel={b.title}
                variant="action"
                className="h-8 text-xs"
                disabled={b.disabled}
                onClick={() => calc.memoryOp(b.op)}
              />
            ))}
          </div>
          {memoryVisible ? (
            <p className="text-xs text-muted-foreground">
              M = <span className="break-all font-mono text-foreground">{memoryDisplay}</span>
            </p>
          ) : null}

          {/* Scientific pad */}
          {mode === "scientific" ? (
            <div className="grid grid-cols-4 gap-2">
              <Key
                label={calc.angleMode === "deg" ? "DEG" : "RAD"}
                ariaLabel={t(M.angleToggleAria)}
                variant="fn"
                active
                className="h-9 text-xs"
                onClick={calc.toggleAngleMode}
              />
              <Key label="(" variant="fn" className="h-9 text-xs" onClick={calc.pressLparen} />
              <Key label=")" variant="fn" className="h-9 text-xs" onClick={calc.pressRparen} />
              <Key label="n!" variant="fn" className="h-9 text-xs" onClick={() => calc.pressPostfix("!")} />

              <Key label="sin" variant="fn" className="h-9 text-xs" onClick={() => calc.pressFunc("sin(")} />
              <Key label="cos" variant="fn" className="h-9 text-xs" onClick={() => calc.pressFunc("cos(")} />
              <Key label="tan" variant="fn" className="h-9 text-xs" onClick={() => calc.pressFunc("tan(")} />
              <Key label="π" variant="fn" className="h-9 text-xs" onClick={() => calc.pressConstant("π")} />

              <Key label="asin" variant="fn" className="h-9 text-xs" onClick={() => calc.pressFunc("asin(")} />
              <Key label="acos" variant="fn" className="h-9 text-xs" onClick={() => calc.pressFunc("acos(")} />
              <Key label="atan" variant="fn" className="h-9 text-xs" onClick={() => calc.pressFunc("atan(")} />
              <Key label="e" variant="fn" className="h-9 text-xs" onClick={() => calc.pressConstant("e")} />

              <Key label="ln" variant="fn" className="h-9 text-xs" onClick={() => calc.pressFunc("ln(")} />
              <Key label="log" variant="fn" className="h-9 text-xs" onClick={() => calc.pressFunc("log(")} />
              <Key label="√" variant="fn" className="h-9 text-xs" onClick={() => calc.pressFunc("√(")} />
              <Key label="x²" variant="fn" className="h-9 text-xs" onClick={() => calc.pressPostfix("²")} />

              <Key label="xʸ" variant="fn" className="h-9 text-xs" onClick={() => calc.pressOperator("^")} />
              <Key label="1/x" variant="fn" className="h-9 text-xs" onClick={() => calc.pressPostfix("⁻¹")} />
              <Key label="EXP" ariaLabel={t(M.expAria)} variant="fn" className="h-9 text-xs" onClick={calc.pressExp10} />
              <Key label="Ans" ariaLabel={t(M.ansAria)} variant="fn" className="h-9 text-xs" onClick={() => calc.pressConstant("Ans")} />
            </div>
          ) : null}

          {/* Basic pad */}
          <div className="grid grid-cols-4 gap-2">
            <Key label="AC" ariaLabel={t(M.acAria)} variant="danger" className="h-12 text-base" onClick={calc.allClear} />
            <Key label="⌫" ariaLabel={t(M.backspaceAria)} variant="action" className="h-12 text-base" onClick={calc.backspace} />
            <Key label="%" variant="op" className="h-12 text-base" onClick={() => calc.pressPostfix("%")} />
            <Key label="÷" variant="op" className="h-12 text-lg" onClick={() => calc.pressOperator("÷")} />

            <Key label="7" className="h-12 text-base" onClick={() => calc.pressDigit("7")} />
            <Key label="8" className="h-12 text-base" onClick={() => calc.pressDigit("8")} />
            <Key label="9" className="h-12 text-base" onClick={() => calc.pressDigit("9")} />
            <Key label="×" variant="op" className="h-12 text-lg" onClick={() => calc.pressOperator("×")} />

            <Key label="4" className="h-12 text-base" onClick={() => calc.pressDigit("4")} />
            <Key label="5" className="h-12 text-base" onClick={() => calc.pressDigit("5")} />
            <Key label="6" className="h-12 text-base" onClick={() => calc.pressDigit("6")} />
            <Key label="−" ariaLabel={t(M.minusAria)} variant="op" className="h-12 text-lg" onClick={() => calc.pressOperator("-")} />

            <Key label="1" className="h-12 text-base" onClick={() => calc.pressDigit("1")} />
            <Key label="2" className="h-12 text-base" onClick={() => calc.pressDigit("2")} />
            <Key label="3" className="h-12 text-base" onClick={() => calc.pressDigit("3")} />
            <Key label="+" variant="op" className="h-12 text-lg" onClick={() => calc.pressOperator("+")} />

            <Key label="±" ariaLabel={t(M.plusMinusAria)} variant="action" className="h-12 text-base" onClick={calc.pressPlusMinus} />
            <Key label="0" className="h-12 text-base" onClick={() => calc.pressDigit("0")} />
            <Key label="." ariaLabel={t(M.dotAria)} className="h-12 text-base" onClick={calc.pressDot} />
            <Key label="=" ariaLabel={t(M.equalsAria)} variant="equals" className="h-12 text-lg" onClick={calc.equals} />
          </div>

          <p className="text-center text-[11px] text-muted-foreground">{t(M.keyboardHint)}</p>
        </CardBody>
      </Card>

      {/* ── History / memory ────────────────────────────────────────── */}
      <Card className="self-start">
        <CardHeader
          title={t(M.historyTitle)}
          subtitle={t(M.historySubtitle)}
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={calc.clearHistory}
              disabled={calc.history.length === 0}
              title={t(M.clearHistoryTitle)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t(M.clearHistory)}
            </Button>
          }
        />
        <CardBody>
          {memoryVisible ? (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2">
              <span className="text-xs font-medium text-accent">{t(M.memoryPanelLabel)}</span>
              <span className="min-w-0 truncate font-mono text-sm text-foreground" title={memoryDisplay ?? undefined}>
                {memoryDisplay}
              </span>
            </div>
          ) : null}
          {calc.history.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t(M.emptyHistory)}
              <br />
              {t(M.emptyPressBefore)} <span className="font-mono">=</span> {t(M.emptyPressAfter)}
            </p>
          ) : (
            <ul className="-mx-2 max-h-[420px] space-y-0.5 overflow-y-auto px-2">
              {calc.history.map((item, idx) => (
                <li
                  key={`${item.at}-${idx}`}
                  className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted"
                >
                  <button
                    type="button"
                    onClick={() => calc.loadValue(item.raw)}
                    className="min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                    title={t(M.useResultTitle)}
                  >
                    <span className="block truncate font-mono text-xs text-muted-foreground">{item.expression} =</span>
                    <span className="block truncate font-mono text-sm font-semibold text-foreground">{item.result}</span>
                  </button>
                  <CopyButton text={item.result} className="shrink-0" />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
