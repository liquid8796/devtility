"use client";

import {
  decodeJwt,
  decodeProtectedHeader,
  errors,
  importJWK,
  jwtVerify,
  SignJWT,
  type JWK,
  type JWTPayload,
  type ProtectedHeaderParameters,
} from "jose";
import { ArrowDownToLine, Loader2, ShieldCheck, ShieldX, TriangleAlert } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import type { Lang, Localized } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/use-lang";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "devtility.jwt";

/**
 * Sample HS256 token, precomputed offline with the secret "devtility-secret".
 * Header  : {"alg":"HS256","typ":"JWT"}
 * Payload : {"sub":"1234567890","name":"DevTility Demo","iat":1516239022}
 */
const SAMPLE_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkRldlRpbGl0eSBEZW1vIiwiaWF0IjoxNTE2MjM5MDIyfQ.FHuAGKrJO48yTzg48OjWa6RzcbBsgsZOfnWFRdlMVD4";

const M = {
  decoderTitle: { vi: "Giải mã JWT", en: "JWT decoder" },
  decoderSubtitle: {
    vi: "Dán token để xem header, payload và chữ ký — xử lý hoàn toàn trong trình duyệt",
    en: "Paste a token to inspect header, payload and signature — processed entirely in your browser",
  },
  tokenLabel: { vi: "Chuỗi JWT", en: "JWT string" },
  tokenPlaceholder: { vi: "Dán JWT vào đây…", en: "Paste your JWT here…" },
  sampleBtn: { vi: "Token mẫu", en: "Sample token" },
  sampleHint: {
    vi: "Token mẫu được ký với secret “devtility-secret”.",
    en: "The sample token is signed with the secret “devtility-secret”.",
  },
  emptyToken: {
    vi: "Nhập một JWT để bắt đầu giải mã.",
    en: "Enter a JWT to start decoding.",
  },
  malformed: {
    vi: "Token không hợp lệ — JWT cần 3 phần header.payload.signature mã hoá Base64URL, header và payload phải là JSON.",
    en: "Malformed token — a JWT needs 3 Base64URL parts (header.payload.signature) with JSON header and payload.",
  },
  segHeader: { vi: "Header", en: "Header" },
  segPayload: { vi: "Payload", en: "Payload" },
  segSignature: { vi: "Chữ ký", en: "Signature" },
  headerTitle: { vi: "Header", en: "Header" },
  headerSubtitle: { vi: "Thuật toán & loại token", en: "Algorithm & token type" },
  payloadTitle: { vi: "Payload", en: "Payload" },
  payloadSubtitle: { vi: "Các claim chứa trong token", en: "Claims carried by the token" },
  claimsTitle: { vi: "Kiểm tra claim", en: "Claim inspection" },
  claimsSubtitle: { vi: "Thời hạn và định danh", en: "Timing and identity" },
  statusExpired: { vi: "Đã hết hạn", en: "Expired" },
  statusNotYet: { vi: "Chưa hiệu lực", en: "Not yet valid" },
  statusValid: { vi: "Còn hiệu lực", en: "Valid" },
  claimExp: { vi: "Hết hạn (exp)", en: "Expires (exp)" },
  claimNbf: { vi: "Hiệu lực từ (nbf)", en: "Not before (nbf)" },
  claimIat: { vi: "Phát hành (iat)", en: "Issued at (iat)" },
  claimIss: { vi: "Nhà phát hành (iss)", en: "Issuer (iss)" },
  claimSub: { vi: "Chủ thể (sub)", en: "Subject (sub)" },
  claimAud: { vi: "Đối tượng (aud)", en: "Audience (aud)" },
  claimJti: { vi: "Mã token (jti)", en: "Token ID (jti)" },
  noTimeClaims: {
    vi: "Token không có claim thời gian (exp, nbf, iat).",
    en: "The token carries no time claims (exp, nbf, iat).",
  },
  verifyTitle: { vi: "Xác minh chữ ký", en: "Verify signature" },
  verifySubtitle: {
    vi: "Kiểm tra token trong ô giải mã bằng secret hoặc khoá công khai",
    en: "Check the token above against a secret or a public key",
  },
  jwkTab: { vi: "JWK / Khoá công khai", en: "JWK / Public key" },
  secretLabel: { vi: "Secret", en: "Secret" },
  secretPlaceholder: { vi: "ví dụ: devtility-secret", en: "e.g. devtility-secret" },
  secretIsB64: { vi: "Secret là Base64", en: "Secret is Base64" },
  jwkLabel: { vi: "JWK hoặc JWKS (JSON)", en: "JWK or JWKS (JSON)" },
  jwkPlaceholder: {
    vi: '{"kty":"RSA","n":"…","e":"AQAB"} hoặc {"keys":[…]}',
    en: '{"kty":"RSA","n":"…","e":"AQAB"} or {"keys":[…]}',
  },
  verifyBtn: { vi: "Xác minh", en: "Verify" },
  verified: { vi: "Chữ ký hợp lệ", en: "Signature verified" },
  verifiedExpired: {
    vi: "Chữ ký hợp lệ nhưng token ĐÃ HẾT HẠN",
    en: "Signature valid but the token has EXPIRED",
  },
  claimFailed: {
    vi: "Chữ ký hợp lệ nhưng claim không đạt kiểm tra",
    en: "Signature valid but a claim check failed",
  },
  invalidSig: { vi: "Chữ ký KHÔNG hợp lệ", en: "Signature INVALID" },
  errNoToken: {
    vi: "Chưa có token trong ô giải mã phía trên.",
    en: "There is no token in the decoder box above.",
  },
  errEmptySecret: { vi: "Vui lòng nhập secret.", en: "Please enter a secret." },
  errBadB64: {
    vi: "Secret không phải chuỗi Base64 hợp lệ.",
    en: "The secret is not valid Base64.",
  },
  errBadJwk: {
    vi: 'JWK không hợp lệ — cần JSON của một khoá hoặc {"keys":[…]}.',
    en: 'Invalid JWK — expected a single key object or {"keys":[…]}.',
  },
  errNoKeys: { vi: "JWKS không chứa khoá nào.", en: "The JWKS contains no keys." },
  errVerifyGeneric: { vi: "Không thể xác minh", en: "Could not verify" },
  encTitle: { vi: "Tạo JWT", en: "Create JWT" },
  encSubtitle: {
    vi: "Ký token HS256/HS384/HS512 ngay trong trình duyệt",
    en: "Sign an HS256/HS384/HS512 token right in your browser",
  },
  algLabel: { vi: "Thuật toán", en: "Algorithm" },
  payloadLabel: { vi: "Payload (JSON)", en: "Payload (JSON)" },
  addExp: { vi: "Thêm exp", en: "Add exp" },
  generateBtn: { vi: "Tạo token", en: "Generate" },
  outputLabel: { vi: "Token đã ký", en: "Signed token" },
  loadIntoDecoder: { vi: "Đưa vào decoder", en: "Load into decoder" },
  errBadJson: {
    vi: "Payload không phải JSON hợp lệ.",
    en: "The payload is not valid JSON.",
  },
  errNotObject: {
    vi: "Payload phải là một object JSON.",
    en: "The payload must be a JSON object.",
  },
  errSignFailed: { vi: "Không thể ký token", en: "Could not sign the token" },
} satisfies Record<string, Localized>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Decode standard or URL-safe Base64 into raw bytes. Throws on invalid input. */
function base64ToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
  if (normalized === "" || /[^A-Za-z0-9+/=]/.test(normalized)) {
    throw new Error("invalid base64");
  }
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const DURATION_UNITS = [
  { s: 31536000, vi: "năm", en: "year" },
  { s: 2592000, vi: "tháng", en: "month" },
  { s: 86400, vi: "ngày", en: "day" },
  { s: 3600, vi: "giờ", en: "hour" },
  { s: 60, vi: "phút", en: "minute" },
  { s: 1, vi: "giây", en: "second" },
] as const;

/** "2 giờ" / "2 hours" — largest fitting unit of an absolute duration. */
function humanDuration(seconds: number, lang: Lang): string {
  const abs = Math.max(1, Math.floor(Math.abs(seconds)));
  const unit = DURATION_UNITS.find((u) => abs >= u.s) ?? DURATION_UNITS[5];
  const n = Math.floor(abs / unit.s);
  if (lang === "vi") return `${n} ${unit.vi}`;
  return `${n} ${unit.en}${n === 1 ? "" : "s"}`;
}

type TimeClaimKey = "exp" | "nbf" | "iat";

function relativeForClaim(key: TimeClaimKey, value: number, nowSec: number, lang: Lang): string {
  const diff = value - nowSec;
  const dur = humanDuration(diff, lang);
  if (key === "exp") {
    if (diff >= 0) return lang === "vi" ? `còn ${dur}` : `in ${dur}`;
    return lang === "vi" ? `đã hết hạn ${dur} trước` : `expired ${dur} ago`;
  }
  if (key === "nbf") {
    if (diff >= 0) return lang === "vi" ? `hiệu lực sau ${dur}` : `becomes valid in ${dur}`;
    return lang === "vi" ? `đã hiệu lực từ ${dur} trước` : `active since ${dur} ago`;
  }
  if (diff >= 0) return lang === "vi" ? `sau ${dur}` : `in ${dur}`;
  return lang === "vi" ? `${dur} trước` : `${dur} ago`;
}

type Tone = "success" | "warning" | "danger";

const TONE_BADGE: Record<Tone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
};

function StatusBadge({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        TONE_BADGE[tone],
      )}
    >
      {label}
    </span>
  );
}

interface DecodedToken {
  parts: [string, string, string];
  header: ProtectedHeaderParameters;
  payload: JWTPayload;
  headerJson: string;
  payloadJson: string;
}

type DecodeState = null | { error: true } | DecodedToken;

function decodeToken(raw: string): DecodeState {
  const token = raw.trim();
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return { error: true };
  try {
    const header = decodeProtectedHeader(token);
    const payload = decodeJwt(token);
    return {
      parts: parts as [string, string, string],
      header,
      payload,
      headerJson: JSON.stringify(header, null, 2),
      payloadJson: JSON.stringify(payload, null, 2),
    };
  } catch {
    return { error: true };
  }
}

/** Pick a JWK from a pasted JWK / JWKS JSON text, preferring the header `kid`. */
function pickJwk(text: string, kid: string | undefined): { jwk: JWK } | { error: Localized } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: M.errBadJwk };
  }
  if (isRecord(parsed) && Array.isArray(parsed.keys)) {
    const keys = parsed.keys.filter(isRecord);
    if (keys.length === 0) return { error: M.errNoKeys };
    const match = (kid ? keys.find((k) => k.kid === kid) : undefined) ?? keys[0];
    return { jwk: match as JWK };
  }
  if (isRecord(parsed) && typeof parsed.kty === "string") {
    return { jwk: parsed as JWK };
  }
  return { error: M.errBadJwk };
}

type VerifyResult =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "valid" }
  | { kind: "expired"; detail: string }
  | { kind: "claim"; detail: string }
  | { kind: "invalid" }
  | { kind: "error"; message: Localized; detail?: string };

const HS_ALGS = ["HS256", "HS384", "HS512"];
const PUBLIC_ALGS = ["RS256", "RS384", "RS512", "ES256", "ES384", "PS256"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function JwtTool() {
  const { lang, t, locale } = useI18n();
  const uid = useId();

  // ---- Decoder ------------------------------------------------------------
  const [token, setToken] = useState<string>(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) ?? SAMPLE_TOKEN;
    } catch {
      return SAMPLE_TOKEN;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, token);
    } catch {
      // private mode — nothing to persist
    }
  }, [token]);

  const decoded = useMemo(() => decodeToken(token), [token]);

  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 30000);
    return () => clearInterval(id);
  }, []);

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "medium" }),
    [locale],
  );

  // ---- Verify -------------------------------------------------------------
  const [verifyMode, setVerifyMode] = useState<"secret" | "jwk">("secret");
  const [secret, setSecret] = useState("devtility-secret");
  const [secretIsB64, setSecretIsB64] = useState(false);
  const [jwkText, setJwkText] = useState("");
  const [verifyResult, setVerifyResult] = useState<VerifyResult>({ kind: "idle" });

  async function runVerify() {
    setVerifyResult({ kind: "busy" });
    try {
      const raw = token.trim();
      if (!raw) {
        setVerifyResult({ kind: "error", message: M.errNoToken });
        return;
      }
      if (verifyMode === "secret") {
        if (!secret) {
          setVerifyResult({ kind: "error", message: M.errEmptySecret });
          return;
        }
        let key: Uint8Array;
        if (secretIsB64) {
          try {
            key = base64ToBytes(secret);
          } catch {
            setVerifyResult({ kind: "error", message: M.errBadB64 });
            return;
          }
        } else {
          key = new TextEncoder().encode(secret);
        }
        await jwtVerify(raw, key, { algorithms: HS_ALGS });
      } else {
        const picked = pickJwk(jwkText, decoded && !("error" in decoded) ? decoded.header.kid : undefined);
        if ("error" in picked) {
          setVerifyResult({ kind: "error", message: picked.error });
          return;
        }
        const alg =
          picked.jwk.alg ?? (decoded && !("error" in decoded) ? decoded.header.alg : undefined);
        const key = await importJWK(picked.jwk, alg);
        await jwtVerify(raw, key, { algorithms: PUBLIC_ALGS });
      }
      setVerifyResult({ kind: "valid" });
    } catch (err) {
      if (err instanceof errors.JWTExpired) {
        setVerifyResult({ kind: "expired", detail: err.message });
      } else if (err instanceof errors.JWTClaimValidationFailed) {
        setVerifyResult({ kind: "claim", detail: err.message });
      } else if (err instanceof errors.JWSSignatureVerificationFailed) {
        setVerifyResult({ kind: "invalid" });
      } else {
        setVerifyResult({
          kind: "error",
          message: M.errVerifyGeneric,
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // ---- Encoder ------------------------------------------------------------
  const [encAlg, setEncAlg] = useState<"HS256" | "HS384" | "HS512">("HS256");
  const [encPayload, setEncPayload] = useState(() =>
    JSON.stringify(
      { sub: "1234567890", name: "Nam Trần", iat: Math.floor(Date.now() / 1000) },
      null,
      2,
    ),
  );
  const [encSecret, setEncSecret] = useState("devtility-secret");
  const [encOut, setEncOut] = useState("");
  const [encError, setEncError] = useState<{ message: Localized; detail?: string } | null>(null);
  const [encBusy, setEncBusy] = useState(false);

  function addExp(deltaSeconds: number) {
    try {
      const parsed: unknown = JSON.parse(encPayload);
      if (!isRecord(parsed)) {
        setEncError({ message: M.errNotObject });
        return;
      }
      parsed.exp = Math.floor(Date.now() / 1000) + deltaSeconds;
      setEncPayload(JSON.stringify(parsed, null, 2));
      setEncError(null);
    } catch {
      setEncError({ message: M.errBadJson });
    }
  }

  async function generateToken() {
    setEncBusy(true);
    setEncError(null);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(encPayload);
      } catch {
        setEncError({ message: M.errBadJson });
        return;
      }
      if (!isRecord(parsed)) {
        setEncError({ message: M.errNotObject });
        return;
      }
      if (!encSecret) {
        setEncError({ message: M.errEmptySecret });
        return;
      }
      const signed = await new SignJWT(parsed as JWTPayload)
        .setProtectedHeader({ alg: encAlg, typ: "JWT" })
        .sign(new TextEncoder().encode(encSecret));
      setEncOut(signed);
    } catch (err) {
      setEncError({
        message: M.errSignFailed,
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setEncBusy(false);
    }
  }

  // ---- Derived claim data -------------------------------------------------
  const ok = decoded !== null && !("error" in decoded) ? decoded : null;

  const timeClaims: Array<{ key: TimeClaimKey; label: Localized; value: number }> = [];
  if (ok) {
    (["exp", "nbf", "iat"] as const).forEach((key) => {
      const value = ok.payload[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        const label = key === "exp" ? M.claimExp : key === "nbf" ? M.claimNbf : M.claimIat;
        timeClaims.push({ key, label, value });
      }
    });
  }

  const overallStatus: { tone: Tone; label: Localized } | null = ok
    ? typeof ok.payload.exp === "number" && ok.payload.exp <= nowSec
      ? { tone: "danger", label: M.statusExpired }
      : typeof ok.payload.nbf === "number" && ok.payload.nbf > nowSec
        ? { tone: "warning", label: M.statusNotYet }
        : { tone: "success", label: M.statusValid }
    : null;

  const identityClaims: Array<{ label: Localized; value: string }> = [];
  if (ok) {
    const { iss, sub, aud, jti } = ok.payload;
    if (typeof iss === "string") identityClaims.push({ label: M.claimIss, value: iss });
    if (typeof sub === "string") identityClaims.push({ label: M.claimSub, value: sub });
    if (typeof aud === "string") identityClaims.push({ label: M.claimAud, value: aud });
    else if (Array.isArray(aud)) identityClaims.push({ label: M.claimAud, value: aud.join(", ") });
    if (typeof jti === "string") identityClaims.push({ label: M.claimJti, value: jti });
  }

  const verifyTabs = [
    { value: "secret" as const, label: "Secret (HS*)" },
    { value: "jwk" as const, label: t(M.jwkTab) },
  ];

  return (
    <div className="space-y-4">
      {/* ---- Decoder ---- */}
      <Card className="animate-fade-up">
        <CardHeader
          title={t(M.decoderTitle)}
          subtitle={t(M.decoderSubtitle)}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setToken(SAMPLE_TOKEN);
                setVerifyResult({ kind: "idle" });
              }}
            >
              {t(M.sampleBtn)}
            </Button>
          }
        />
        <CardBody className="space-y-4">
          <Field label={t(M.tokenLabel)} htmlFor={`${uid}-token`} hint={t(M.sampleHint)}>
            <TextArea
              id={`${uid}-token`}
              rows={4}
              spellCheck={false}
              autoComplete="off"
              placeholder={t(M.tokenPlaceholder)}
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                setVerifyResult({ kind: "idle" });
              }}
            />
          </Field>

          {decoded === null ? (
            <p className="rounded-lg bg-muted px-4 py-4 text-center text-sm text-muted-foreground">
              {t(M.emptyToken)}
            </p>
          ) : "error" in decoded ? (
            <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">{t(M.malformed)}</p>
          ) : (
            <div className="space-y-2">
              <div className="break-all rounded-xl bg-muted p-4 font-mono text-xs leading-relaxed sm:text-sm">
                <span className="text-accent">{decoded.parts[0]}</span>
                <span className="text-muted-foreground">.</span>
                <span className="text-primary">{decoded.parts[1]}</span>
                <span className="text-muted-foreground">.</span>
                <span className="text-success">{decoded.parts[2]}</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span className="font-medium text-accent">● {t(M.segHeader)}</span>
                <span className="font-medium text-primary">● {t(M.segPayload)}</span>
                <span className="font-medium text-success">● {t(M.segSignature)}</span>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {ok ? (
        <>
          {/* ---- Header / Payload ---- */}
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Card className="animate-fade-up">
              <CardHeader
                title={t(M.headerTitle)}
                subtitle={t(M.headerSubtitle)}
                actions={<CopyButton text={ok.headerJson} />}
              />
              <CardBody>
                <pre className="max-h-72 overflow-auto rounded-xl bg-muted p-4 font-mono text-xs leading-relaxed text-accent sm:text-sm">
                  {ok.headerJson}
                </pre>
              </CardBody>
            </Card>
            <Card className="animate-fade-up">
              <CardHeader
                title={t(M.payloadTitle)}
                subtitle={t(M.payloadSubtitle)}
                actions={<CopyButton text={ok.payloadJson} />}
              />
              <CardBody>
                <pre className="max-h-72 overflow-auto rounded-xl bg-muted p-4 font-mono text-xs leading-relaxed text-primary sm:text-sm">
                  {ok.payloadJson}
                </pre>
              </CardBody>
            </Card>
          </div>

          {/* ---- Claims ---- */}
          <Card className="animate-fade-up">
            <CardHeader
              title={t(M.claimsTitle)}
              subtitle={t(M.claimsSubtitle)}
              actions={
                overallStatus ? (
                  <StatusBadge tone={overallStatus.tone} label={t(overallStatus.label)} />
                ) : undefined
              }
            />
            <CardBody className="space-y-3">
              {timeClaims.length === 0 ? (
                <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                  {t(M.noTimeClaims)}
                </p>
              ) : (
                <div className="divide-y divide-border rounded-xl border border-border">
                  {timeClaims.map(({ key, label, value }) => {
                    const badge =
                      key === "exp"
                        ? value <= nowSec
                          ? { tone: "danger" as Tone, label: M.statusExpired }
                          : { tone: "success" as Tone, label: M.statusValid }
                        : key === "nbf"
                          ? value > nowSec
                            ? { tone: "warning" as Tone, label: M.statusNotYet }
                            : { tone: "success" as Tone, label: M.statusValid }
                          : null;
                    return (
                      <div
                        key={key}
                        className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-3"
                      >
                        <span className="w-36 shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          {t(label)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="break-all font-mono text-sm">
                            {value}
                            <span className="text-muted-foreground"> · </span>
                            {dateFmt.format(new Date(value * 1000))}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {relativeForClaim(key, value, nowSec, lang)}
                          </p>
                        </div>
                        {badge ? <StatusBadge tone={badge.tone} label={t(badge.label)} /> : null}
                      </div>
                    );
                  })}
                </div>
              )}

              {identityClaims.length > 0 ? (
                <div className="divide-y divide-border rounded-xl border border-border">
                  {identityClaims.map(({ label, value }) => (
                    <div
                      key={t(label)}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5"
                    >
                      <span className="w-36 shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {t(label)}
                      </span>
                      <span className="min-w-0 flex-1 break-all font-mono text-sm">{value}</span>
                      <CopyButton text={value} />
                    </div>
                  ))}
                </div>
              ) : null}
            </CardBody>
          </Card>
        </>
      ) : null}

      <div className="grid items-start gap-4 xl:grid-cols-2">
        {/* ---- Verify ---- */}
        <Card className="animate-fade-up">
          <CardHeader title={t(M.verifyTitle)} subtitle={t(M.verifySubtitle)} />
          <CardBody className="space-y-4">
            <Tabs
              items={verifyTabs}
              value={verifyMode}
              onChange={(mode) => {
                setVerifyMode(mode);
                setVerifyResult({ kind: "idle" });
              }}
              size="sm"
            />

            {verifyMode === "secret" ? (
              <div className="space-y-3">
                <Field label={t(M.secretLabel)} htmlFor={`${uid}-verify-secret`}>
                  <TextInput
                    id={`${uid}-verify-secret`}
                    className="font-mono"
                    spellCheck={false}
                    autoComplete="off"
                    placeholder={t(M.secretPlaceholder)}
                    value={secret}
                    onChange={(e) => {
                      setSecret(e.target.value);
                      setVerifyResult({ kind: "idle" });
                    }}
                  />
                </Field>
                <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={secretIsB64}
                    onChange={(e) => {
                      setSecretIsB64(e.target.checked);
                      setVerifyResult({ kind: "idle" });
                    }}
                    className="h-4 w-4 shrink-0 cursor-pointer rounded border-border accent-(--primary)"
                  />
                  {t(M.secretIsB64)}
                </label>
              </div>
            ) : (
              <Field label={t(M.jwkLabel)} htmlFor={`${uid}-verify-jwk`}>
                <TextArea
                  id={`${uid}-verify-jwk`}
                  rows={6}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder={t(M.jwkPlaceholder)}
                  value={jwkText}
                  onChange={(e) => {
                    setJwkText(e.target.value);
                    setVerifyResult({ kind: "idle" });
                  }}
                />
              </Field>
            )}

            <Button onClick={() => void runVerify()} disabled={verifyResult.kind === "busy"}>
              {verifyResult.kind === "busy" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <ShieldCheck className="h-4 w-4" aria-hidden />
              )}
              {t(M.verifyBtn)}
            </Button>

            {verifyResult.kind === "valid" ? (
              <div className="flex items-center gap-3 rounded-xl bg-success/10 px-4 py-3.5 text-sm font-semibold text-success">
                <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden />
                {t(M.verified)}
              </div>
            ) : verifyResult.kind === "expired" || verifyResult.kind === "claim" ? (
              <div className="rounded-xl bg-warning/10 px-4 py-3.5 text-warning">
                <p className="flex items-center gap-3 text-sm font-semibold">
                  <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden />
                  {t(verifyResult.kind === "expired" ? M.verifiedExpired : M.claimFailed)}
                </p>
                <p className="mt-1 break-words pl-8 font-mono text-xs opacity-80">
                  {verifyResult.detail}
                </p>
              </div>
            ) : verifyResult.kind === "invalid" ? (
              <div className="flex items-center gap-3 rounded-xl bg-danger/10 px-4 py-3.5 text-sm font-semibold text-danger">
                <ShieldX className="h-5 w-5 shrink-0" aria-hidden />
                {t(M.invalidSig)}
              </div>
            ) : verifyResult.kind === "error" ? (
              <div className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
                <p>{t(verifyResult.message)}</p>
                {verifyResult.detail ? (
                  <p className="mt-1 break-words font-mono text-xs opacity-80">{verifyResult.detail}</p>
                ) : null}
              </div>
            ) : null}
          </CardBody>
        </Card>

        {/* ---- Encoder ---- */}
        <Card className="animate-fade-up">
          <CardHeader title={t(M.encTitle)} subtitle={t(M.encSubtitle)} />
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t(M.algLabel)} htmlFor={`${uid}-enc-alg`}>
                <Select
                  id={`${uid}-enc-alg`}
                  value={encAlg}
                  onChange={(e) => setEncAlg(e.target.value as "HS256" | "HS384" | "HS512")}
                >
                  <option value="HS256">HS256</option>
                  <option value="HS384">HS384</option>
                  <option value="HS512">HS512</option>
                </Select>
              </Field>
              <Field label={t(M.secretLabel)} htmlFor={`${uid}-enc-secret`}>
                <TextInput
                  id={`${uid}-enc-secret`}
                  className="font-mono"
                  spellCheck={false}
                  autoComplete="off"
                  placeholder={t(M.secretPlaceholder)}
                  value={encSecret}
                  onChange={(e) => setEncSecret(e.target.value)}
                />
              </Field>
            </div>

            <Field label={t(M.payloadLabel)} htmlFor={`${uid}-enc-payload`}>
              <TextArea
                id={`${uid}-enc-payload`}
                rows={6}
                spellCheck={false}
                autoComplete="off"
                value={encPayload}
                onChange={(e) => setEncPayload(e.target.value)}
              />
            </Field>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t(M.addExp)}:
              </span>
              <Button variant="outline" size="sm" onClick={() => addExp(3600)}>
                +1h
              </Button>
              <Button variant="outline" size="sm" onClick={() => addExp(86400)}>
                +1d
              </Button>
              <Button variant="outline" size="sm" onClick={() => addExp(30 * 86400)}>
                +30d
              </Button>
            </div>

            <Button onClick={() => void generateToken()} disabled={encBusy}>
              {encBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {t(M.generateBtn)}
            </Button>

            {encError ? (
              <div className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
                <p>{t(encError.message)}</p>
                {encError.detail ? (
                  <p className="mt-1 break-words font-mono text-xs opacity-80">{encError.detail}</p>
                ) : null}
              </div>
            ) : null}

            {encOut ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t(M.outputLabel)}
                </p>
                <div className="break-all rounded-xl bg-muted p-4 font-mono text-xs leading-relaxed sm:text-sm">
                  {encOut}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <CopyButton text={encOut} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setToken(encOut);
                      setVerifyResult({ kind: "idle" });
                    }}
                  >
                    <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden />
                    {t(M.loadIntoDecoder)}
                  </Button>
                </div>
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
