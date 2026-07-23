/**
 * Pure helpers for the cron visual builder: tokenizing a cron expression,
 * best-effort mapping of each field token to a builder mode, and composing
 * an expression back from builder state.
 */

export type FieldKey = "minute" | "hour" | "dayOfMonth" | "month" | "dayOfWeek";

export const FIELD_ORDER: readonly FieldKey[] = [
  "minute",
  "hour",
  "dayOfMonth",
  "month",
  "dayOfWeek",
];

export const FIELD_RANGE: Record<FieldKey, { min: number; max: number }> = {
  minute: { min: 0, max: 59 },
  hour: { min: 0, max: 23 },
  dayOfMonth: { min: 1, max: 31 },
  month: { min: 1, max: 12 },
  dayOfWeek: { min: 0, max: 6 },
};

export type FieldMode = "every" | "specific" | "range" | "step" | "custom";

export interface FieldState {
  mode: FieldMode;
  /** Comma-separated numbers, e.g. "0,15,30". */
  specific: string;
  rangeFrom: string;
  rangeTo: string;
  step: string;
  /** Raw token preserved when the field cannot be mapped to a simple mode. */
  customToken: string;
}

export type BuilderState = Record<FieldKey, FieldState>;

export function defaultFieldState(): FieldState {
  return { mode: "every", specific: "", rangeFrom: "", rangeTo: "", step: "", customToken: "*" };
}

export function splitTokens(expr: string): string[] {
  return expr.trim().split(/\s+/).filter(Boolean);
}

/** Best-effort: map one field token to a builder mode; unknown syntax → custom. */
export function parseFieldToken(token: string, prev?: FieldState): FieldState {
  const base: FieldState = { ...(prev ?? defaultFieldState()), customToken: token };
  if (token === "*") return { ...base, mode: "every" };
  const step = /^\*\/(\d+)$/.exec(token);
  if (step) return { ...base, mode: "step", step: step[1] };
  const range = /^(\d+)-(\d+)$/.exec(token);
  if (range) return { ...base, mode: "range", rangeFrom: range[1], rangeTo: range[2] };
  if (/^\d+(,\d+)*$/.test(token)) return { ...base, mode: "specific", specific: token };
  return { ...base, mode: "custom" };
}

/** Compose one field token from builder state; incomplete inputs fall back to "*". */
export function composeFieldToken(state: FieldState): string {
  switch (state.mode) {
    case "every":
      return "*";
    case "step": {
      const n = state.step.trim();
      return n === "" ? "*" : `*/${n}`;
    }
    case "range": {
      const from = state.rangeFrom.trim();
      const to = state.rangeTo.trim();
      return from === "" || to === "" ? "*" : `${from}-${to}`;
    }
    case "specific": {
      const cleaned = state.specific
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .join(",");
      return cleaned === "" ? "*" : cleaned;
    }
    case "custom":
      return state.customToken.trim() === "" ? "*" : state.customToken.trim();
  }
}

/** Map exactly five tokens onto builder state; returns null on any other count. */
export function builderFromTokens(tokens: string[], prev?: BuilderState): BuilderState | null {
  if (tokens.length !== FIELD_ORDER.length) return null;
  const next = {} as BuilderState;
  FIELD_ORDER.forEach((key, index) => {
    next[key] = parseFieldToken(tokens[index], prev?.[key]);
  });
  return next;
}

export function defaultBuilderState(): BuilderState {
  const next = {} as BuilderState;
  for (const key of FIELD_ORDER) next[key] = defaultFieldState();
  return next;
}

/** Compose a full expression; when secondsToken is given a 6-field expression is produced. */
export function composeExpression(state: BuilderState, secondsToken: string | null): string {
  const tokens = FIELD_ORDER.map((key) => composeFieldToken(state[key]));
  return (secondsToken !== null ? [secondsToken, ...tokens] : tokens).join(" ");
}

/** Validate a "specific" comma list against the field's numeric range. */
export function specificListValid(text: string, key: FieldKey): boolean {
  const trimmed = text.trim();
  if (trimmed === "") return true; // treated as "*" while typing
  if (!/^\d+(\s*,\s*\d+)*$/.test(trimmed)) return false;
  const { min, max } = FIELD_RANGE[key];
  return trimmed
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .every((value) => value >= min && value <= max);
}
