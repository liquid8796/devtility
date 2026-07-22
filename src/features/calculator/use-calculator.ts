"use client";

import { useCallback, useEffect, useReducer } from "react";

import { Decimal, dec, formatDecimal } from "@/lib/math/decimal";

import { evaluateExpression, type AngleMode } from "./engine";

const HISTORY_KEY = "devtility.calc.history";
const MEMORY_KEY = "devtility.calc.memory";
const MAX_HISTORY = 50;

export interface HistoryItem {
  expression: string;
  result: string; // display-formatted result
  raw: string; // full-precision Decimal string
  at: number;
}

export type OperatorToken = "+" | "-" | "×" | "÷" | "^";
export type PostfixToken = "%" | "!" | "²" | "⁻¹";
export type ConstantToken = "π" | "e" | "Ans";
export type MemoryOp = "MC" | "MR" | "M+" | "M-" | "MS";

interface CalcState {
  /** Committed part of the expression (display form). */
  expr: string;
  /** Number currently being typed. */
  entry: string;
  error: string | null;
  /** Raw Decimal string of the last "=" result. */
  result: string | null;
  /** Expression that produced `result` (shown as "… =" after evaluating). */
  lastExpression: string | null;
  justEvaluated: boolean;
  angleMode: AngleMode;
  ans: string | null;
  memory: string | null;
  history: HistoryItem[];
  hydrated: boolean;
}

type Action =
  | { type: "digit"; digit: string }
  | { type: "dot" }
  | { type: "operator"; op: OperatorToken }
  | { type: "postfix"; token: PostfixToken }
  | { type: "func"; token: string }
  | { type: "constant"; token: ConstantToken }
  | { type: "lparen" }
  | { type: "rparen" }
  | { type: "plusMinus" }
  | { type: "exp10" }
  | { type: "backspace" }
  | { type: "allClear" }
  | { type: "equals" }
  | { type: "toggleAngleMode" }
  | { type: "memory"; op: MemoryOp }
  | { type: "loadValue"; raw: string }
  | { type: "clearHistory" }
  | { type: "hydrate"; history: HistoryItem[]; memory: string | null };

const OP_CHARS: readonly string[] = ["+", "-", "×", "÷", "^"];

/** Multi-character display tokens removed as a unit by backspace. */
const MULTI_TOKENS = [
  "asin(",
  "acos(",
  "atan(",
  "sqrt(",
  "sin(",
  "cos(",
  "tan(",
  "exp(",
  "abs(",
  "ln(",
  "log(",
  "√(",
  "⁻¹",
  "Ans",
] as const;

const initialState: CalcState = {
  expr: "",
  entry: "",
  error: null,
  result: null,
  lastExpression: null,
  justEvaluated: false,
  angleMode: "deg",
  ans: null,
  memory: null,
  history: [],
  hydrated: false,
};

function normalizeSci(s: string): string {
  return s.replace("e", "E");
}

function safeDec(raw: string): Decimal {
  try {
    const d = new Decimal(raw);
    return d.isFinite() ? d : dec(0);
  } catch {
    return dec(0);
  }
}

/** Drop dangling "E", "E-", "." so the entry is a valid number literal. */
function sanitizeEntry(entry: string): string {
  let s = entry.replace(/E[+-]?$/, "").replace(/\.$/, "");
  if (s === "" || s === "-") s = "";
  return s;
}

/** Append the typed entry to the committed expression (negatives get parens). */
function commitEntry(expr: string, entry: string): string {
  const s = sanitizeEntry(entry);
  if (!s) return expr;
  return expr + (s.startsWith("-") ? `(${s})` : s);
}

function wrapValue(raw: string): string {
  return raw.startsWith("-") ? `(${raw})` : raw;
}

function endsWithValue(expr: string): boolean {
  if (!expr) return false;
  return /[0-9)%!²¹πes]$/.test(expr);
}

function removeLastToken(expr: string): string {
  for (const t of MULTI_TOKENS) {
    if (expr.endsWith(t)) return expr.slice(0, -t.length);
  }
  return expr.slice(0, -1);
}

function clearedCore(s: CalcState): CalcState {
  return { ...s, expr: "", entry: "", error: null, result: null, lastExpression: null, justEvaluated: false };
}

const INPUT_ACTIONS: ReadonlySet<Action["type"]> = new Set([
  "digit",
  "dot",
  "operator",
  "postfix",
  "func",
  "constant",
  "lparen",
  "rparen",
  "plusMinus",
  "exp10",
]);

function reducer(state: CalcState, action: Action): CalcState {
  // Any new input after an error starts a fresh expression.
  let s = state.error && INPUT_ACTIONS.has(action.type) ? clearedCore(state) : state;

  switch (action.type) {
    case "hydrate":
      return { ...s, history: action.history, memory: action.memory, hydrated: true };

    case "clearHistory":
      return { ...s, history: [] };

    case "toggleAngleMode":
      return { ...s, angleMode: s.angleMode === "deg" ? "rad" : "deg" };

    case "allClear":
      return clearedCore(s);

    case "loadValue":
      return { ...clearedCore(s), entry: normalizeSci(action.raw) };

    case "digit": {
      if (s.justEvaluated) s = clearedCore(s);
      const d = action.digit;
      let entry = s.entry;
      if (entry.replace(/[^0-9]/g, "").length >= 30) return s;
      if (entry === "0") entry = d === "0" ? "0" : d;
      else if (entry === "-0") entry = d === "0" ? "-0" : `-${d}`;
      else entry += d;
      return { ...s, entry };
    }

    case "dot": {
      if (s.justEvaluated) s = clearedCore(s);
      const entry = s.entry;
      if (entry.includes(".") || entry.includes("E")) return s;
      return { ...s, entry: entry === "" ? "0." : entry === "-" ? "-0." : `${entry}.` };
    }

    case "operator": {
      const op = action.op;
      if (s.justEvaluated && s.result !== null) {
        return { ...clearedCore(s), expr: wrapValue(s.result) + op };
      }
      if (s.entry) {
        return { ...s, expr: commitEntry(s.expr, s.entry) + op, entry: "" };
      }
      const expr = s.expr;
      if (expr === "") {
        if (op === "-") return { ...s, expr: "-" };
        return { ...s, expr: (s.ans !== null ? "Ans" : "0") + op };
      }
      const last = expr[expr.length - 1];
      if (last === "(") {
        return op === "-" ? { ...s, expr: `${expr}-` } : s;
      }
      if (OP_CHARS.includes(last)) {
        // "5×" then "−" → allow unary minus; otherwise replace the operator.
        if (op === "-" && last !== "-" && last !== "+") return { ...s, expr: `${expr}-` };
        let base = expr;
        while (base && OP_CHARS.includes(base[base.length - 1])) base = base.slice(0, -1);
        if (base === "" || base.endsWith("(")) {
          return op === "-" ? { ...s, expr: `${base}-` } : { ...s, expr: base };
        }
        return { ...s, expr: base + op };
      }
      return { ...s, expr: expr + op };
    }

    case "postfix": {
      const tok = action.token;
      if (s.justEvaluated && s.result !== null) {
        return { ...clearedCore(s), expr: wrapValue(s.result) + tok };
      }
      if (s.entry) {
        const committed = commitEntry(s.expr, s.entry);
        if (committed === s.expr) return s;
        return { ...s, expr: committed + tok, entry: "" };
      }
      if (endsWithValue(s.expr)) return { ...s, expr: s.expr + tok };
      return s;
    }

    case "func": {
      if (s.justEvaluated) s = clearedCore(s);
      return { ...s, expr: commitEntry(s.expr, s.entry) + action.token, entry: "" };
    }

    case "constant": {
      if (s.justEvaluated) s = clearedCore(s);
      return { ...s, expr: commitEntry(s.expr, s.entry) + action.token, entry: "" };
    }

    case "lparen": {
      if (s.justEvaluated) s = clearedCore(s);
      return { ...s, expr: `${commitEntry(s.expr, s.entry)}(`, entry: "" };
    }

    case "rparen": {
      if (s.justEvaluated) return s;
      const expr = commitEntry(s.expr, s.entry);
      const opens = (expr.match(/\(/g) ?? []).length - (expr.match(/\)/g) ?? []).length;
      if (opens <= 0 || !endsWithValue(expr)) return s;
      return { ...s, expr: `${expr})`, entry: "" };
    }

    case "plusMinus": {
      if (s.justEvaluated && s.result !== null) {
        const negated = s.result.startsWith("-") ? s.result.slice(1) : `-${s.result}`;
        return { ...clearedCore(s), entry: normalizeSci(negated) };
      }
      const entry = s.entry;
      const eIdx = entry.indexOf("E");
      if (eIdx >= 0) {
        const mant = entry.slice(0, eIdx);
        let ex = entry.slice(eIdx + 1);
        ex = ex.startsWith("-") ? ex.slice(1) : ex.startsWith("+") ? `-${ex.slice(1)}` : `-${ex}`;
        return { ...s, entry: `${mant}E${ex}` };
      }
      if (entry) {
        return { ...s, entry: entry.startsWith("-") ? entry.slice(1) : `-${entry}` };
      }
      return { ...s, entry: "-" };
    }

    case "exp10": {
      if (s.justEvaluated) s = clearedCore(s);
      let entry = s.entry;
      if (entry.includes("E")) return s;
      if (entry === "" || entry === "-") entry += "1";
      if (entry.endsWith(".")) entry = entry.slice(0, -1);
      return { ...s, entry: `${entry}E` };
    }

    case "backspace": {
      if (s.error) return { ...s, error: null };
      if (s.justEvaluated) return clearedCore(s);
      if (s.entry) return { ...s, entry: s.entry.slice(0, -1) };
      if (s.expr) return { ...s, expr: removeLastToken(s.expr) };
      return s;
    }

    case "equals": {
      if (s.error) return { ...s, error: null };
      if (s.justEvaluated) return s;
      let full = commitEntry(s.expr, s.entry);
      while (full && OP_CHARS.includes(full[full.length - 1])) full = full.slice(0, -1);
      if (!full) return s;
      const res = evaluateExpression(full, s.angleMode, s.ans !== null ? safeDec(s.ans) : undefined);
      if (!res.ok) {
        return { ...s, expr: full, entry: "", error: res.error };
      }
      const raw = normalizeSci(res.value.toString());
      const item: HistoryItem = {
        expression: full,
        result: formatResult(res.value),
        raw,
        at: Date.now(),
      };
      return {
        ...s,
        expr: "",
        entry: "",
        error: null,
        result: raw,
        lastExpression: full,
        justEvaluated: true,
        ans: raw,
        history: [item, ...s.history].slice(0, MAX_HISTORY),
      };
    }

    case "memory": {
      if (s.error) return s;
      const currentValue = (): Decimal => {
        if (s.entry) return safeDec(sanitizeEntry(s.entry) || "0");
        if (s.justEvaluated && s.result !== null) return safeDec(s.result);
        return dec(0);
      };
      switch (action.op) {
        case "MC":
          return { ...s, memory: null };
        case "MR": {
          if (s.memory === null) return s;
          const next = s.justEvaluated ? clearedCore(s) : s;
          return { ...next, entry: normalizeSci(s.memory) };
        }
        case "MS":
          return { ...s, memory: normalizeSci(currentValue().toString()) };
        case "M+":
          return { ...s, memory: normalizeSci(safeDec(s.memory ?? "0").add(currentValue()).toString()) };
        case "M-":
          return { ...s, memory: normalizeSci(safeDec(s.memory ?? "0").sub(currentValue()).toString()) };
      }
      return s;
    }

    default:
      return s;
  }
}

function parseStoredHistory(json: string | null): HistoryItem[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    const items: HistoryItem[] = [];
    for (const v of parsed) {
      if (typeof v !== "object" || v === null) continue;
      const o = v as Record<string, unknown>;
      if (typeof o.expression !== "string" || typeof o.result !== "string") continue;
      items.push({
        expression: o.expression,
        result: o.result,
        raw: typeof o.raw === "string" ? o.raw : o.result,
        at: typeof o.at === "number" ? o.at : 0,
      });
      if (items.length >= MAX_HISTORY) break;
    }
    return items;
  } catch {
    return [];
  }
}

/** Calculator display format: ≤16 significant digits, ≤16 decimal places. */
function formatResult(value: Decimal): string {
  return formatDecimal(value.toSignificantDigits(16), 16);
}

/** Format a raw Decimal string for on-screen display. */
export function formatRaw(raw: string): string {
  try {
    return formatResult(new Decimal(raw));
  } catch {
    return raw;
  }
}

/** Cosmetic: last value in the committed expression, shown while entry is empty. */
function lastValueHint(expr: string): string {
  if (!expr) return "0";
  let s = expr;
  while (s && (OP_CHARS.includes(s[s.length - 1]) || s.endsWith("("))) {
    s = s.slice(0, -1);
    for (const f of ["asin", "acos", "atan", "sqrt", "sin", "cos", "tan", "exp", "abs", "ln", "log", "√"]) {
      if (s.endsWith(f)) {
        s = s.slice(0, -f.length);
        break;
      }
    }
  }
  const m = /(\d+(?:\.\d+)?(?:E[+-]?\d+)?|π|e|Ans)(?:[%!²]|⁻¹)*$/.exec(s);
  return m ? m[0] : "0";
}

export function useCalculator() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Hydrate history + memory from localStorage (client only, after mount).
  useEffect(() => {
    let history: HistoryItem[] = [];
    let memory: string | null = null;
    try {
      history = parseStoredHistory(window.localStorage.getItem(HISTORY_KEY));
    } catch {
      history = [];
    }
    try {
      const raw = window.localStorage.getItem(MEMORY_KEY);
      if (raw) {
        const d = new Decimal(raw);
        if (d.isFinite()) memory = raw;
      }
    } catch {
      memory = null;
    }
    dispatch({ type: "hydrate", history, memory });
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
    } catch {
      // storage full / unavailable — non-fatal
    }
  }, [state.hydrated, state.history]);

  useEffect(() => {
    if (!state.hydrated) return;
    try {
      if (state.memory === null) window.localStorage.removeItem(MEMORY_KEY);
      else window.localStorage.setItem(MEMORY_KEY, state.memory);
    } catch {
      // non-fatal
    }
  }, [state.hydrated, state.memory]);

  // Global keyboard support.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return;
      }
      const k = e.key;
      let handled = true;
      if (k >= "0" && k <= "9") dispatch({ type: "digit", digit: k });
      else if (k === "." || k === ",") dispatch({ type: "dot" });
      else if (k === "+") dispatch({ type: "operator", op: "+" });
      else if (k === "-") dispatch({ type: "operator", op: "-" });
      else if (k === "*") dispatch({ type: "operator", op: "×" });
      else if (k === "/") dispatch({ type: "operator", op: "÷" });
      else if (k === "^") dispatch({ type: "operator", op: "^" });
      else if (k === "%") dispatch({ type: "postfix", token: "%" });
      else if (k === "!") dispatch({ type: "postfix", token: "!" });
      else if (k === "(") dispatch({ type: "lparen" });
      else if (k === ")") dispatch({ type: "rparen" });
      else if (k === "Enter" || k === "=") dispatch({ type: "equals" });
      else if (k === "Backspace") dispatch({ type: "backspace" });
      else if (k === "Escape" || k === "Delete") dispatch({ type: "allClear" });
      else handled = false;
      if (handled) e.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const displayValue = state.error
    ? state.error
    : state.justEvaluated && state.result !== null
      ? formatRaw(state.result)
      : state.entry || lastValueHint(state.expr);

  const expressionLine =
    state.justEvaluated && state.lastExpression !== null ? `${state.lastExpression} =` : state.expr + state.entry;

  const pressDigit = useCallback((digit: string) => dispatch({ type: "digit", digit }), []);
  const pressDot = useCallback(() => dispatch({ type: "dot" }), []);
  const pressOperator = useCallback((op: OperatorToken) => dispatch({ type: "operator", op }), []);
  const pressPostfix = useCallback((token: PostfixToken) => dispatch({ type: "postfix", token }), []);
  const pressFunc = useCallback((token: string) => dispatch({ type: "func", token }), []);
  const pressConstant = useCallback((token: ConstantToken) => dispatch({ type: "constant", token }), []);
  const pressLparen = useCallback(() => dispatch({ type: "lparen" }), []);
  const pressRparen = useCallback(() => dispatch({ type: "rparen" }), []);
  const pressPlusMinus = useCallback(() => dispatch({ type: "plusMinus" }), []);
  const pressExp10 = useCallback(() => dispatch({ type: "exp10" }), []);
  const backspace = useCallback(() => dispatch({ type: "backspace" }), []);
  const allClear = useCallback(() => dispatch({ type: "allClear" }), []);
  const equals = useCallback(() => dispatch({ type: "equals" }), []);
  const toggleAngleMode = useCallback(() => dispatch({ type: "toggleAngleMode" }), []);
  const memoryOp = useCallback((op: MemoryOp) => dispatch({ type: "memory", op }), []);
  const loadValue = useCallback((raw: string) => dispatch({ type: "loadValue", raw }), []);
  const clearHistory = useCallback(() => dispatch({ type: "clearHistory" }), []);

  return {
    angleMode: state.angleMode,
    memory: state.memory,
    history: state.history,
    hasError: state.error !== null,
    displayValue,
    expressionLine,
    pressDigit,
    pressDot,
    pressOperator,
    pressPostfix,
    pressFunc,
    pressConstant,
    pressLparen,
    pressRparen,
    pressPlusMinus,
    pressExp10,
    backspace,
    allClear,
    equals,
    toggleAngleMode,
    memoryOp,
    loadValue,
    clearHistory,
  };
}
