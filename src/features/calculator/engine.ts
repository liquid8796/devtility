import type { Localized } from "@/lib/i18n";
import { Decimal, dec } from "@/lib/math/decimal";

/**
 * Expression engine for the calculator tool.
 *
 * Pipeline: tokenizer → shunting-yard → RPN evaluation, everything running on
 * Decimal (decimal.js, precision 40) so 0.1 + 0.2 === 0.3 exactly.
 *
 * Trigonometric / logarithmic functions use decimal.js' native
 * arbitrary-precision implementations (no binary-float fallback needed);
 * results are rounded to 30 significant digits and values below 1e-30 are
 * snapped to 0 so e.g. sin(180°) displays as 0 instead of 1.2e-40.
 */

export type AngleMode = "deg" | "rad";

export type EvalResult = { ok: true; value: Decimal } | { ok: false; error: Localized };

export const CALC_ERRORS = {
  divideByZero: { vi: "Không thể chia cho 0", en: "Cannot divide by 0" },
  invalid: { vi: "Biểu thức không hợp lệ", en: "Invalid expression" },
  domain: { vi: "Ngoài miền xác định", en: "Out of domain" },
  overflow: { vi: "Giá trị quá lớn", en: "Value too large" },
} as const satisfies Record<string, Localized>;

class CalcError extends Error {
  readonly localized: Localized;

  constructor(localized: Localized) {
    super(localized.vi);
    this.localized = localized;
  }
}

/** π and e at the configured 40-digit precision. */
export const PI = Decimal.acos(-1);
export const EULER = dec(1).exp();

type BinOp = "+" | "-" | "*" | "/" | "^";
type PostfixOp = "%" | "!" | "square" | "recip";
type FuncName =
  | "sin"
  | "cos"
  | "tan"
  | "asin"
  | "acos"
  | "atan"
  | "ln"
  | "log"
  | "sqrt"
  | "abs"
  | "exp";
type ConstName = "pi" | "e" | "ans";

type Token =
  | { type: "num"; value: Decimal }
  | { type: "op"; op: BinOp }
  | { type: "neg" }
  | { type: "postfix"; op: PostfixOp }
  | { type: "func"; name: FuncName }
  | { type: "const"; name: ConstName }
  | { type: "lparen" }
  | { type: "rparen" };

const PREC: Record<BinOp, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 4 };
const RIGHT_ASSOC: Record<BinOp, boolean> = { "+": false, "-": false, "*": false, "/": false, "^": true };
/** Unary minus: below ^ so -2^2 = -4, above +−×÷ so -2×3 = (-2)×3. */
const NEG_PREC = 3;

/** Function display tokens, longest first so "asin" matches before "sin". */
const FUNC_MATCHES: ReadonlyArray<readonly [string, FuncName]> = [
  ["asin", "asin"],
  ["acos", "acos"],
  ["atan", "atan"],
  ["sqrt", "sqrt"],
  ["sin", "sin"],
  ["cos", "cos"],
  ["tan", "tan"],
  ["exp", "exp"],
  ["abs", "abs"],
  ["ln", "ln"],
  ["log", "log"],
  ["√", "sqrt"],
];

const NUMBER_RE = /^(\d+(?:\.\d*)?|\.\d+)(?:E[+-]?\d+)?/;

function isValueEnd(t: Token | undefined): boolean {
  return !!t && (t.type === "num" || t.type === "const" || t.type === "rparen" || t.type === "postfix");
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  const prevIsValue = () => isValueEnd(tokens[tokens.length - 1]);
  /** Insert implicit multiplication: 2π, 2(3), (2)(3), 5sin(30), 10%2 … */
  const beforeValue = () => {
    if (prevIsValue()) tokens.push({ type: "op", op: "*" });
  };

  while (i < input.length) {
    const ch = input[i];

    if (ch === " ") {
      i += 1;
      continue;
    }

    // ── Numbers (with optional scientific exponent "E") ────────────────
    if ((ch >= "0" && ch <= "9") || ch === ".") {
      const m = NUMBER_RE.exec(input.slice(i));
      if (!m) throw new CalcError(CALC_ERRORS.invalid);
      i += m[0].length;
      if (input[i] === ".") throw new CalcError(CALC_ERRORS.invalid); // "1.2.3"
      beforeValue();
      tokens.push({ type: "num", value: new Decimal(m[0]) });
      continue;
    }

    // ── Operators / punctuation ────────────────────────────────────────
    if (ch === "+" ) {
      if (prevIsValue()) tokens.push({ type: "op", op: "+" });
      // prefix "+" is a no-op
      i += 1;
      continue;
    }
    if (ch === "-" || ch === "−") {
      tokens.push(prevIsValue() ? { type: "op", op: "-" } : { type: "neg" });
      i += 1;
      continue;
    }
    if (ch === "*" || ch === "×" || ch === "·") {
      if (!prevIsValue()) throw new CalcError(CALC_ERRORS.invalid);
      tokens.push({ type: "op", op: "*" });
      i += 1;
      continue;
    }
    if (ch === "/" || ch === "÷") {
      if (!prevIsValue()) throw new CalcError(CALC_ERRORS.invalid);
      tokens.push({ type: "op", op: "/" });
      i += 1;
      continue;
    }
    if (ch === "^") {
      if (!prevIsValue()) throw new CalcError(CALC_ERRORS.invalid);
      tokens.push({ type: "op", op: "^" });
      i += 1;
      continue;
    }
    if (ch === "%" || ch === "!") {
      if (!prevIsValue()) throw new CalcError(CALC_ERRORS.invalid);
      tokens.push({ type: "postfix", op: ch === "%" ? "%" : "!" });
      i += 1;
      continue;
    }
    if (ch === "²") {
      if (!prevIsValue()) throw new CalcError(CALC_ERRORS.invalid);
      tokens.push({ type: "postfix", op: "square" });
      i += 1;
      continue;
    }
    if (ch === "⁻") {
      if (!prevIsValue() || input[i + 1] !== "¹") throw new CalcError(CALC_ERRORS.invalid);
      tokens.push({ type: "postfix", op: "recip" });
      i += 2;
      continue;
    }
    if (ch === "(") {
      beforeValue();
      tokens.push({ type: "lparen" });
      i += 1;
      continue;
    }
    if (ch === ")") {
      if (!prevIsValue()) throw new CalcError(CALC_ERRORS.invalid); // catches "()" and "(+"
      tokens.push({ type: "rparen" });
      i += 1;
      continue;
    }

    // ── Constants ──────────────────────────────────────────────────────
    if (ch === "π") {
      beforeValue();
      tokens.push({ type: "const", name: "pi" });
      i += 1;
      continue;
    }
    if (input.startsWith("pi", i)) {
      beforeValue();
      tokens.push({ type: "const", name: "pi" });
      i += 2;
      continue;
    }
    if (input.startsWith("Ans", i)) {
      beforeValue();
      tokens.push({ type: "const", name: "ans" });
      i += 3;
      continue;
    }

    // ── Functions (must be followed by "(") ────────────────────────────
    const func = FUNC_MATCHES.find(([text]) => input.startsWith(text, i));
    if (func) {
      beforeValue();
      tokens.push({ type: "func", name: func[1] });
      i += func[0].length;
      while (input[i] === " ") i += 1;
      if (input[i] !== "(") throw new CalcError(CALC_ERRORS.invalid);
      continue;
    }

    // Euler constant — checked after functions so "exp(" wins over "e".
    if (ch === "e") {
      beforeValue();
      tokens.push({ type: "const", name: "e" });
      i += 1;
      continue;
    }

    throw new CalcError(CALC_ERRORS.invalid);
  }

  return tokens;
}

/** Shunting-yard: infix tokens → RPN. Unclosed "(" are auto-closed. */
function toRPN(tokens: Token[]): Token[] {
  const out: Token[] = [];
  const stack: Token[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case "num":
      case "const":
        out.push(token);
        break;
      case "func":
      case "neg":
        // Prefix operators never pop anything on push.
        stack.push(token);
        break;
      case "postfix":
        // Postfix binds tightest → applies directly to the last value.
        out.push(token);
        break;
      case "op": {
        const p = PREC[token.op];
        while (stack.length > 0) {
          const top = stack[stack.length - 1];
          if (top.type === "op" && (PREC[top.op] > p || (PREC[top.op] === p && !RIGHT_ASSOC[token.op]))) {
            out.push(stack.pop() as Token);
          } else if (top.type === "neg" && NEG_PREC > p) {
            out.push(stack.pop() as Token);
          } else {
            break;
          }
        }
        stack.push(token);
        break;
      }
      case "lparen":
        stack.push(token);
        break;
      case "rparen": {
        let matched = false;
        while (stack.length > 0) {
          const top = stack.pop() as Token;
          if (top.type === "lparen") {
            matched = true;
            break;
          }
          out.push(top);
        }
        if (!matched) throw new CalcError(CALC_ERRORS.invalid);
        const top = stack[stack.length - 1];
        if (top && top.type === "func") out.push(stack.pop() as Token);
        break;
      }
    }
  }

  while (stack.length > 0) {
    const top = stack.pop() as Token;
    if (top.type === "lparen") continue; // auto-close "sin(30" etc.
    out.push(top);
  }

  return out;
}

/** Snap sub-1e-30 residues to 0 and trim to 30 significant digits. */
function cleanTranscendental(v: Decimal): Decimal {
  if (v.isNaN()) throw new CalcError(CALC_ERRORS.domain);
  if (!v.isFinite()) throw new CalcError(CALC_ERRORS.overflow);
  if (!v.isZero() && v.abs().lt("1e-30")) return dec(0);
  return v.toSignificantDigits(30);
}

function factorial(x: Decimal): Decimal {
  if (!x.isInteger() || x.isNegative()) throw new CalcError(CALC_ERRORS.domain);
  if (x.gt(170)) throw new CalcError(CALC_ERRORS.overflow);
  let result = dec(1);
  const n = x.toNumber();
  for (let k = 2; k <= n; k += 1) result = result.mul(k);
  return result;
}

function applyBinary(op: BinOp, a: Decimal, b: Decimal): Decimal {
  switch (op) {
    case "+":
      return a.add(b);
    case "-":
      return a.sub(b);
    case "*":
      return a.mul(b);
    case "/":
      if (b.isZero()) throw new CalcError(CALC_ERRORS.divideByZero);
      return a.div(b);
    case "^": {
      if (a.isZero() && b.isNegative()) throw new CalcError(CALC_ERRORS.divideByZero);
      const r = a.pow(b);
      if (r.isNaN()) throw new CalcError(CALC_ERRORS.domain); // (-2)^0.5 …
      if (!r.isFinite()) throw new CalcError(CALC_ERRORS.overflow);
      return r;
    }
  }
}

function applyFunc(name: FuncName, x: Decimal, mode: AngleMode): Decimal {
  switch (name) {
    case "sin":
    case "cos":
    case "tan": {
      // Angles beyond ±1e10 lose all meaning after argument reduction.
      if (x.abs().gt("1e10")) throw new CalcError(CALC_ERRORS.domain);
      if (name === "tan" && mode === "deg" && x.mod(180).abs().eq(90)) {
        throw new CalcError(CALC_ERRORS.domain); // tan(90°), tan(270°) …
      }
      const rad = mode === "deg" ? x.mul(PI).div(180) : x;
      const r = name === "sin" ? Decimal.sin(rad) : name === "cos" ? Decimal.cos(rad) : Decimal.tan(rad);
      return cleanTranscendental(r);
    }
    case "asin":
    case "acos": {
      if (x.abs().gt(1)) throw new CalcError(CALC_ERRORS.domain);
      let r = name === "asin" ? Decimal.asin(x) : Decimal.acos(x);
      if (mode === "deg") r = r.mul(180).div(PI);
      return cleanTranscendental(r);
    }
    case "atan": {
      let r = Decimal.atan(x);
      if (mode === "deg") r = r.mul(180).div(PI);
      return cleanTranscendental(r);
    }
    case "ln":
      if (x.lte(0)) throw new CalcError(CALC_ERRORS.domain);
      return cleanTranscendental(x.ln());
    case "log":
      if (x.lte(0)) throw new CalcError(CALC_ERRORS.domain);
      return cleanTranscendental(x.log(10));
    case "sqrt":
      if (x.isNegative()) throw new CalcError(CALC_ERRORS.domain);
      return x.sqrt();
    case "abs":
      return x.abs();
    case "exp": {
      const r = x.exp();
      if (!r.isFinite()) throw new CalcError(CALC_ERRORS.overflow);
      return cleanTranscendental(r);
    }
  }
}

function evalRPN(rpn: Token[], mode: AngleMode, ans: Decimal): Decimal {
  const stack: Decimal[] = [];
  const pop = (): Decimal => {
    const v = stack.pop();
    if (v === undefined) throw new CalcError(CALC_ERRORS.invalid);
    return v;
  };

  for (let i = 0; i < rpn.length; i += 1) {
    const t = rpn[i];
    switch (t.type) {
      case "num":
        stack.push(t.value);
        break;
      case "const":
        stack.push(t.name === "pi" ? PI : t.name === "e" ? EULER : ans);
        break;
      case "neg":
        stack.push(pop().neg());
        break;
      case "op": {
        const b = pop();
        const a = pop();
        stack.push(applyBinary(t.op, a, b));
        break;
      }
      case "func":
        stack.push(applyFunc(t.name, pop(), mode));
        break;
      case "postfix": {
        const x = pop();
        if (t.op === "%") {
          // Standard calculator percent: when % feeds directly into + or −
          // (in RPN the consuming operator immediately follows), it means
          // "percent of the left operand": 200+10% → 220. Otherwise x/100.
          const next = rpn[i + 1];
          const left = stack[stack.length - 1];
          if (next && next.type === "op" && (next.op === "+" || next.op === "-") && left !== undefined) {
            stack.push(left.mul(x).div(100));
          } else {
            stack.push(x.div(100));
          }
        } else if (t.op === "!") {
          stack.push(factorial(x));
        } else if (t.op === "square") {
          stack.push(x.mul(x));
        } else {
          if (x.isZero()) throw new CalcError(CALC_ERRORS.divideByZero);
          stack.push(dec(1).div(x));
        }
        break;
      }
      default:
        throw new CalcError(CALC_ERRORS.invalid);
    }
  }

  if (stack.length !== 1) throw new CalcError(CALC_ERRORS.invalid);
  const value = stack[0];
  if (value.isNaN()) throw new CalcError(CALC_ERRORS.invalid);
  if (!value.isFinite()) throw new CalcError(CALC_ERRORS.overflow);
  return value;
}

/**
 * Evaluate a calculator expression.
 * @param expr display-form expression: digits . E, + - × ÷ ^ % ! ² ⁻¹ ( ) π e √( sin( … Ans
 * @param mode angle mode for trig functions (default "deg")
 * @param ans  value of the "Ans" token (defaults to 0)
 */
export function evaluateExpression(expr: string, mode: AngleMode = "deg", ans?: Decimal): EvalResult {
  try {
    const trimmed = expr.trim();
    if (!trimmed || trimmed.length > 1000) return { ok: false, error: CALC_ERRORS.invalid };
    const tokens = tokenize(trimmed);
    if (tokens.length === 0 || !isValueEnd(tokens[tokens.length - 1])) {
      return { ok: false, error: CALC_ERRORS.invalid };
    }
    const value = evalRPN(toRPN(tokens), mode, ans ?? dec(0));
    return { ok: true, value };
  } catch (err) {
    return { ok: false, error: err instanceof CalcError ? err.localized : CALC_ERRORS.invalid };
  }
}
