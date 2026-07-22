"use client";

import { ArrowLeftRight } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Select, TextInput } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import {
  UNIT_CATEGORIES,
  convertUnit,
  type Unit,
  type UnitCategoryId,
} from "@/lib/convert/units";
import type { Lang, Localized } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/use-lang";
import { Decimal, parseDecimal } from "@/lib/math/decimal";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

const M = {
  copy: { vi: "Sao chép", en: "Copy" },
  cardTitle: { vi: "Chuyển đổi đơn vị", en: "Unit converter" },
  cardSubtitle: {
    vi: "Chiều dài, diện tích, thể tích, khối lượng và nhiệt độ — độ chính xác cao",
    en: "Length, area, volume, mass and temperature — high precision",
  },
  value: { vi: "Giá trị", en: "Value" },
  valueHint: {
    vi: "Nhập một số để chuyển đổi, ví dụ: 1.234,56 hoặc -40",
    en: "Enter a number to convert, e.g. 1,234.56 or -40",
  },
  valuePlaceholder: { vi: "Ví dụ: 100", en: "e.g. 100" },
  invalidValue: {
    vi: "Giá trị không hợp lệ. Vui lòng nhập một số, ví dụ: 12,5 hoặc 1000.",
    en: "Invalid value. Please enter a number, e.g. 12.5 or 1000.",
  },
  from: { vi: "Từ", en: "From" },
  to: { vi: "Sang", en: "To" },
  swap: { vi: "Đổi chiều chuyển đổi", en: "Swap conversion direction" },
  cannotConvert: {
    vi: "Không thể chuyển đổi vì giá trị nhập vào không hợp lệ.",
    en: "Cannot convert because the entered value is invalid.",
  },
  enterValueForResult: {
    vi: "Nhập giá trị ở trên để xem kết quả chuyển đổi.",
    en: "Enter a value above to see the conversion result.",
  },
  allUnitsTitle: { vi: "Tất cả đơn vị", en: "All units" },
  source: { vi: "• nguồn", en: "• source" },
  invalidValueTable: {
    vi: "Giá trị không hợp lệ — sửa lại ô nhập ở trên để xem bảng quy đổi.",
    en: "Invalid value — fix the input above to see the conversion table.",
  },
  enterValueForTable: {
    vi: "Nhập giá trị ở trên để xem bảng quy đổi đầy đủ.",
    en: "Enter a value above to see the full conversion table.",
  },
} satisfies Record<string, Localized>;

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a converted Decimal for display with language-matched digit grouping
 * (vi: "." thousands + "," decimal; en: "," thousands + "." decimal) plus a
 * plain machine-friendly string for the clipboard.
 * Very large/small magnitudes fall back to exponent notation.
 */
function formatUnitValue(d: Decimal, lang: Lang): { display: string; copy: string } {
  const sig = d.toSignificantDigits(12);
  const copy = sig.toString();
  if (copy.includes("e") || copy.includes("E")) {
    return { display: copy, copy };
  }
  const groupSep = lang === "vi" ? "." : ",";
  const decimalSep = lang === "vi" ? "," : ".";
  const negative = copy.startsWith("-");
  const abs = negative ? copy.slice(1) : copy;
  const dot = abs.indexOf(".");
  const int = dot === -1 ? abs : abs.slice(0, dot);
  const frac = dot === -1 ? "" : abs.slice(dot + 1);
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, groupSep);
  return {
    display: (negative ? "-" : "") + grouped + (frac ? decimalSep + frac : ""),
    copy,
  };
}

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

/** Sensible default from/to pair per category. */
const DEFAULT_SELECTION: Record<UnitCategoryId, { from: string; to: string }> = {
  length: { from: "m", to: "ft" },
  area: { from: "m2", to: "ha" },
  volume: { from: "l", to: "gal" },
  mass: { from: "kg", to: "lb" },
  temperature: { from: "c", to: "f" },
};

// ---------------------------------------------------------------------------

export default function UnitsTool() {
  const { lang, t } = useI18n();
  const [categoryId, setCategoryId] = useState<UnitCategoryId>("length");
  const [valueStr, setValueStr] = useState("1");
  const [selection, setSelection] = useState(DEFAULT_SELECTION);

  const category = UNIT_CATEGORIES.find((c) => c.id === categoryId) ?? UNIT_CATEGORIES[0];
  const { from: fromId, to: toId } = selection[categoryId];
  const fromUnit: Unit = category.units.find((u) => u.id === fromId) ?? category.units[0];
  const toUnit: Unit = category.units.find((u) => u.id === toId) ?? category.units[0];

  const parsed = useMemo(() => parseDecimal(valueStr), [valueStr]);
  const hasInput = valueStr.trim().length > 0;
  const invalid = hasInput && parsed === null;

  // Cheap enough to recompute every render — manual memoization here conflicts
  // with React Compiler (unit objects can't be proven immutable).
  const result = parsed ? convertUnit(parsed, fromUnit, toUnit) : null;

  const setFrom = (id: string) =>
    setSelection((prev) => ({ ...prev, [categoryId]: { ...prev[categoryId], from: id } }));
  const setTo = (id: string) =>
    setSelection((prev) => ({ ...prev, [categoryId]: { ...prev[categoryId], to: id } }));
  const swap = () =>
    setSelection((prev) => ({
      ...prev,
      [categoryId]: { from: prev[categoryId].to, to: prev[categoryId].from },
    }));

  const inputValue = parsed ? formatUnitValue(parsed, lang) : null;
  const resultValue = result ? formatUnitValue(result, lang) : null;

  const categoryTabs = UNIT_CATEGORIES.map((c) => ({ value: c.id, label: t(c.name) }));

  const allUnitsSubtitle = t({
    vi: `Quy đổi giá trị sang mọi đơn vị ${category.name.vi.toLowerCase()}`,
    en: `Convert the value into every ${category.name.en.toLowerCase()} unit`,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={t(M.cardTitle)} subtitle={t(M.cardSubtitle)} />
        <CardBody className="space-y-4">
          <Tabs items={categoryTabs} value={categoryId} onChange={setCategoryId} />

          <Field
            label={t(M.value)}
            htmlFor="unit-value"
            hint={!hasInput ? t(M.valueHint) : undefined}
          >
            <TextInput
              id="unit-value"
              inputMode="decimal"
              value={valueStr}
              onChange={(e) => setValueStr(e.target.value)}
              placeholder={t(M.valuePlaceholder)}
              className="font-mono"
              autoComplete="off"
            />
          </Field>
          {invalid ? <p className="text-sm text-danger">{t(M.invalidValue)}</p> : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <Field label={t(M.from)} htmlFor="unit-from">
              <Select id="unit-from" value={fromUnit.id} onChange={(e) => setFrom(e.target.value)}>
                {category.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {t(u.name)} ({u.symbol})
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              variant="outline"
              size="icon"
              onClick={swap}
              aria-label={t(M.swap)}
              title={t(M.swap)}
              className="justify-self-center sm:mb-0.5"
            >
              <ArrowLeftRight className="h-4 w-4 rotate-90 sm:rotate-0" />
            </Button>
            <Field label={t(M.to)} htmlFor="unit-to">
              <Select id="unit-to" value={toUnit.id} onChange={(e) => setTo(e.target.value)}>
                {category.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {t(u.name)} ({u.symbol})
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="rounded-xl border border-border bg-muted/50 p-4">
            {resultValue && inputValue ? (
              <>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">{inputValue.display}</span> {fromUnit.symbol} (
                  {t(fromUnit.name)}) =
                </p>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="break-all font-mono text-2xl font-semibold text-primary">
                    {resultValue.display}
                  </span>
                  <span className="text-sm text-muted-foreground">{toUnit.symbol}</span>
                  <CopyButton text={resultValue.copy} label={t(M.copy)} />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {invalid ? t(M.cannotConvert) : t(M.enterValueForResult)}
              </p>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t(M.allUnitsTitle)} subtitle={allUnitsSubtitle} />
        <CardBody>
          {parsed ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {category.units.map((u) => {
                const v = formatUnitValue(convertUnit(parsed, fromUnit, u), lang);
                const isSource = u.id === fromUnit.id;
                return (
                  <div
                    key={u.id}
                    className={cn(
                      "rounded-xl border p-3 transition-colors",
                      isSource ? "border-primary/60 bg-primary/10" : "border-border bg-card card-hover",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-xs font-medium text-muted-foreground">
                        {t(u.name)}{" "}
                        <span className="text-muted-foreground/70">({u.symbol})</span>
                        {isSource ? <span className="ml-1.5 text-primary">{t(M.source)}</span> : null}
                      </p>
                      <CopyButton text={v.copy} label={t(M.copy)} className="shrink-0" />
                    </div>
                    <p className="mt-1.5 break-all font-mono text-sm text-foreground">
                      {v.display} <span className="text-xs text-muted-foreground">{u.symbol}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {invalid ? t(M.invalidValueTable) : t(M.enterValueForTable)}
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
