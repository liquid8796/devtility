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
import { Decimal, parseDecimal } from "@/lib/math/decimal";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a converted Decimal for display (vi-VN style: "." thousands, ","
 * decimal) plus a plain machine-friendly string for the clipboard.
 * Very large/small magnitudes fall back to exponent notation.
 */
function formatUnitValue(d: Decimal): { display: string; copy: string } {
  const sig = d.toSignificantDigits(12);
  const copy = sig.toString();
  if (copy.includes("e") || copy.includes("E")) {
    return { display: copy, copy };
  }
  const negative = copy.startsWith("-");
  const abs = negative ? copy.slice(1) : copy;
  const dot = abs.indexOf(".");
  const int = dot === -1 ? abs : abs.slice(0, dot);
  const frac = dot === -1 ? "" : abs.slice(dot + 1);
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return {
    display: (negative ? "-" : "") + grouped + (frac ? "," + frac : ""),
    copy,
  };
}

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

const CATEGORY_TABS = UNIT_CATEGORIES.map((c) => ({ value: c.id, label: c.name }));

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

  const inputValue = parsed ? formatUnitValue(parsed) : null;
  const resultValue = result ? formatUnitValue(result) : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Chuyển đổi đơn vị"
          subtitle="Chiều dài, diện tích, thể tích, khối lượng và nhiệt độ — độ chính xác cao"
        />
        <CardBody className="space-y-4">
          <Tabs items={CATEGORY_TABS} value={categoryId} onChange={setCategoryId} />

          <Field
            label="Giá trị"
            htmlFor="unit-value"
            hint={!hasInput ? "Nhập một số để chuyển đổi, ví dụ: 1.234,56 hoặc -40" : undefined}
          >
            <TextInput
              id="unit-value"
              inputMode="decimal"
              value={valueStr}
              onChange={(e) => setValueStr(e.target.value)}
              placeholder="Ví dụ: 100"
              className="font-mono"
              autoComplete="off"
            />
          </Field>
          {invalid ? (
            <p className="text-sm text-danger">
              Giá trị không hợp lệ. Vui lòng nhập một số, ví dụ: 12,5 hoặc 1000.
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <Field label="Từ" htmlFor="unit-from">
              <Select id="unit-from" value={fromUnit.id} onChange={(e) => setFrom(e.target.value)}>
                {category.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.symbol})
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              variant="outline"
              size="icon"
              onClick={swap}
              aria-label="Đổi chiều chuyển đổi"
              title="Đổi chiều chuyển đổi"
              className="justify-self-center sm:mb-0.5"
            >
              <ArrowLeftRight className="h-4 w-4 rotate-90 sm:rotate-0" />
            </Button>
            <Field label="Sang" htmlFor="unit-to">
              <Select id="unit-to" value={toUnit.id} onChange={(e) => setTo(e.target.value)}>
                {category.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.symbol})
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
                  {fromUnit.name}) =
                </p>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="break-all font-mono text-2xl font-semibold text-primary">
                    {resultValue.display}
                  </span>
                  <span className="text-sm text-muted-foreground">{toUnit.symbol}</span>
                  <CopyButton text={resultValue.copy} />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {invalid
                  ? "Không thể chuyển đổi vì giá trị nhập vào không hợp lệ."
                  : "Nhập giá trị ở trên để xem kết quả chuyển đổi."}
              </p>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Tất cả đơn vị"
          subtitle={`Quy đổi giá trị sang mọi đơn vị ${category.name.toLowerCase()}`}
        />
        <CardBody>
          {parsed ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {category.units.map((u) => {
                const v = formatUnitValue(convertUnit(parsed, fromUnit, u));
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
                        {u.name}{" "}
                        <span className="text-muted-foreground/70">({u.symbol})</span>
                        {isSource ? <span className="ml-1.5 text-primary">• nguồn</span> : null}
                      </p>
                      <CopyButton text={v.copy} className="shrink-0" />
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
              {invalid
                ? "Giá trị không hợp lệ — sửa lại ô nhập ở trên để xem bảng quy đổi."
                : "Nhập giá trị ở trên để xem bảng quy đổi đầy đủ."}
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
