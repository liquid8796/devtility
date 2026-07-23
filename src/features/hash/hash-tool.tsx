"use client";

import * as bcrypt from "bcryptjs";
import { FileDigit, Loader2, ShieldCheck, ShieldX, TriangleAlert, Upload } from "lucide-react";
import SparkMD5 from "spark-md5";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Select, TextArea, TextInput } from "@/components/ui/field";
import type { Localized } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/use-lang";
import { cn } from "@/lib/utils";

const M = {
  textTitle: { vi: "Băm văn bản", en: "Text hashing" },
  textSubtitle: {
    vi: "MD5, SHA-1, SHA-256, SHA-512 — tính trực tiếp khi bạn gõ",
    en: "MD5, SHA-1, SHA-256, SHA-512 — computed live as you type",
  },
  textLabel: { vi: "Văn bản", en: "Text" },
  textPlaceholder: { vi: "Nhập văn bản cần băm…", en: "Type the text to hash…" },
  uppercase: { vi: "CHỮ HOA", en: "UPPERCASE" },
  webCryptoError: {
    vi: "Web Crypto không khả dụng trong ngữ cảnh này (cần HTTPS hoặc localhost).",
    en: "Web Crypto is unavailable in this context (HTTPS or localhost required).",
  },
  hmacTitle: { vi: "HMAC", en: "HMAC" },
  hmacSubtitle: {
    vi: "Ký message bằng secret qua Web Crypto",
    en: "Sign a message with a secret via Web Crypto",
  },
  messageLabel: { vi: "Message", en: "Message" },
  messagePlaceholder: { vi: "Nội dung cần ký…", en: "Content to sign…" },
  secretLabel: { vi: "Secret", en: "Secret" },
  secretPlaceholder: { vi: "Khoá bí mật…", en: "Secret key…" },
  algoLabel: { vi: "Thuật toán", en: "Algorithm" },
  hmacEmpty: {
    vi: "Nhập message và secret để tính HMAC.",
    en: "Enter a message and a secret to compute the HMAC.",
  },
  fileTitle: { vi: "Checksum tệp", en: "File checksum" },
  fileSubtitle: {
    vi: "MD5 & SHA-256 cho tệp trên máy bạn",
    en: "MD5 & SHA-256 for files on your machine",
  },
  chooseFile: { vi: "Chọn file…", en: "Choose file…" },
  privacyNote: {
    vi: "Không có file nào rời khỏi trình duyệt.",
    en: "Files never leave your browser.",
  },
  computing: { vi: "Đang tính", en: "Computing" },
  bigFileWarning: {
    vi: "File lớn (trên 256 MB) — quá trình băm có thể chậm và tốn bộ nhớ.",
    en: "Large file (over 256 MB) — hashing may be slow and memory-intensive.",
  },
  shaSkipped: {
    vi: "File quá lớn (trên 512 MB) — bỏ qua SHA-256, chỉ tính MD5.",
    en: "File too large (over 512 MB) — SHA-256 skipped, MD5 only.",
  },
  fileError: {
    vi: "Không thể đọc file. Vui lòng thử lại.",
    en: "Could not read the file. Please try again.",
  },
  bcryptTitle: { vi: "bcrypt", en: "bcrypt" },
  bcryptSubtitle: {
    vi: "Kiểm tra và tạo hash mật khẩu",
    en: "Verify and generate password hashes",
  },
  verifySection: { vi: "Kiểm tra hash", en: "Verify a hash" },
  genSection: { vi: "Tạo hash", en: "Generate a hash" },
  plainLabel: { vi: "Mật khẩu (plaintext)", en: "Password (plaintext)" },
  hashLabel: { vi: "Hash bcrypt", en: "bcrypt hash" },
  costLabel: { vi: "Cost (số vòng)", en: "Cost (rounds)" },
  compareBtn: { vi: "So khớp", en: "Compare" },
  generateBtn: { vi: "Tạo hash", en: "Generate" },
  match: { vi: "Khớp — mật khẩu đúng với hash", en: "Match — the password fits the hash" },
  noMatch: { vi: "KHÔNG khớp", en: "NO match" },
  compareError: {
    vi: "Hash không hợp lệ hoặc không thể so khớp.",
    en: "Invalid hash or the comparison failed.",
  },
  needPlainAndHash: {
    vi: "Nhập mật khẩu và hash để so khớp.",
    en: "Enter a password and a hash to compare.",
  },
  needPlain: { vi: "Nhập mật khẩu để tạo hash.", en: "Enter a password to hash." },
  genError: { vi: "Không thể tạo hash.", en: "Could not generate the hash." },
  costHint: {
    vi: "bcryptjs là JavaScript thuần — cost 12 có thể mất một lúc.",
    en: "bcryptjs is pure JavaScript — cost 12 can take a moment.",
  },
} satisfies Record<string, Localized>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function formatBytes(bytes: number, locale: string): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"] as const;
  let value = bytes;
  let i = -1;
  do {
    value /= 1024;
    i++;
  } while (value >= 1024 && i < units.length - 1);
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)} ${units[i]}`;
}

const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB
const WARN_SIZE = 256 * 1024 * 1024; // ~256 MB → warn, still try
const SHA_LIMIT = 512 * 1024 * 1024; // > 512 MB → MD5 only

function HashRow({
  label,
  value,
  uppercase,
}: {
  label: string;
  value: string | null;
  uppercase?: boolean;
}) {
  const shown = value === null ? null : uppercase ? value.toUpperCase() : value;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
      <span className="w-24 shrink-0 font-mono text-xs font-semibold text-muted-foreground">
        {label}
      </span>
      {shown === null ? (
        <span className="font-mono text-sm text-muted-foreground">—</span>
      ) : (
        <>
          <span className="min-w-0 flex-1 break-all font-mono text-sm">{shown}</span>
          <CopyButton text={shown} />
        </>
      )}
    </div>
  );
}

interface TextHashes {
  md5: string;
  sha1: string;
  sha256: string;
  sha512: string;
}

type HmacAlgo = "SHA-256" | "SHA-512" | "SHA-1";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HashTool() {
  const { t, locale } = useI18n();
  const uid = useId();

  // ---- Card 1: text hashes ------------------------------------------------
  const [text, setText] = useState("");
  const [textHashes, setTextHashes] = useState<TextHashes | null>(null);
  const [textFailed, setTextFailed] = useState(false);
  const [uppercase, setUppercase] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(async () => {
      if (text === "") {
        if (!cancelled) setTextHashes(null);
        return;
      }
      try {
        const data = new TextEncoder().encode(text);
        const [sha1, sha256, sha512] = await Promise.all([
          crypto.subtle.digest("SHA-1", data),
          crypto.subtle.digest("SHA-256", data),
          crypto.subtle.digest("SHA-512", data),
        ]);
        if (cancelled) return;
        setTextHashes({
          md5: SparkMD5.hash(text),
          sha1: toHex(sha1),
          sha256: toHex(sha256),
          sha512: toHex(sha512),
        });
        setTextFailed(false);
      } catch {
        if (!cancelled) {
          setTextHashes(null);
          setTextFailed(true);
        }
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [text]);

  const shownText = text === "" ? null : textHashes;

  // ---- Card 2: HMAC -------------------------------------------------------
  const [hmacMessage, setHmacMessage] = useState("");
  const [hmacSecret, setHmacSecret] = useState("");
  const [hmacAlgo, setHmacAlgo] = useState<HmacAlgo>("SHA-256");
  const [hmacOut, setHmacOut] = useState<{ hex: string; b64: string } | null>(null);
  const [hmacFailed, setHmacFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(async () => {
      if (hmacMessage === "" || hmacSecret === "") {
        if (!cancelled) setHmacOut(null);
        return;
      }
      try {
        const enc = new TextEncoder();
        const key = await crypto.subtle.importKey(
          "raw",
          enc.encode(hmacSecret),
          { name: "HMAC", hash: hmacAlgo },
          false,
          ["sign"],
        );
        const signature = await crypto.subtle.sign("HMAC", key, enc.encode(hmacMessage));
        if (cancelled) return;
        setHmacOut({ hex: toHex(signature), b64: toBase64(signature) });
        setHmacFailed(false);
      } catch {
        if (!cancelled) {
          setHmacOut(null);
          setHmacFailed(true);
        }
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [hmacMessage, hmacSecret, hmacAlgo]);

  const hmacReady = hmacMessage !== "" && hmacSecret !== "";
  const shownHmac = hmacReady ? hmacOut : null;

  // ---- Card 3: file checksum ----------------------------------------------
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null);
  const [fileState, setFileState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [fileProgress, setFileProgress] = useState(0);
  const [fileHashes, setFileHashes] = useState<{ md5: string; sha256: string | null } | null>(null);
  const fileJobRef = useRef(0);

  async function hashFile(file: File) {
    const job = ++fileJobRef.current;
    setFileInfo({ name: file.name, size: file.size });
    setFileState("working");
    setFileProgress(0);
    setFileHashes(null);
    try {
      const wantSha = file.size <= SHA_LIMIT;
      const spark = new SparkMD5.ArrayBuffer();
      const full = wantSha ? new Uint8Array(file.size) : null;
      let offset = 0;
      while (offset < file.size) {
        const chunk = await file.slice(offset, offset + CHUNK_SIZE).arrayBuffer();
        if (fileJobRef.current !== job) return;
        spark.append(chunk);
        if (full) full.set(new Uint8Array(chunk), offset);
        offset += chunk.byteLength;
        setFileProgress(Math.min(100, Math.round((offset / file.size) * 100)));
      }
      const md5 = spark.end();
      let sha256: string | null = null;
      if (full) {
        sha256 = toHex(await crypto.subtle.digest("SHA-256", full));
      }
      if (fileJobRef.current !== job) return;
      setFileProgress(100);
      setFileHashes({ md5, sha256 });
      setFileState("done");
    } catch {
      if (fileJobRef.current === job) setFileState("error");
    }
  }

  // ---- Card 4: bcrypt -----------------------------------------------------
  const [bcPlain, setBcPlain] = useState("");
  const [bcHash, setBcHash] = useState("");
  const [bcVerify, setBcVerify] = useState<
    "idle" | "busy" | "match" | "nomatch" | "error" | "need-input"
  >("idle");

  const [genPlain, setGenPlain] = useState("");
  const [genCost, setGenCost] = useState(10);
  const [genState, setGenState] = useState<"idle" | "busy" | "error" | "need-input">("idle");
  const [genOut, setGenOut] = useState("");

  async function runCompare() {
    if (bcPlain === "" || bcHash.trim() === "") {
      setBcVerify("need-input");
      return;
    }
    setBcVerify("busy");
    try {
      const ok = await bcrypt.compare(bcPlain, bcHash.trim());
      setBcVerify(ok ? "match" : "nomatch");
    } catch {
      setBcVerify("error");
    }
  }

  async function runGenerate() {
    if (genPlain === "") {
      setGenState("need-input");
      return;
    }
    setGenState("busy");
    setGenOut("");
    try {
      const hashed = await bcrypt.hash(genPlain, genCost);
      setGenOut(hashed);
      setGenState("idle");
    } catch {
      setGenState("error");
    }
  }

  return (
    <div className="space-y-4">
      {/* ---- Card 1: text hashes ---- */}
      <Card className="animate-fade-up">
        <CardHeader
          title={t(M.textTitle)}
          subtitle={t(M.textSubtitle)}
          actions={
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={uppercase}
                onChange={(e) => setUppercase(e.target.checked)}
                className="h-4 w-4 shrink-0 cursor-pointer rounded border-border accent-(--primary)"
              />
              {t(M.uppercase)}
            </label>
          }
        />
        <CardBody className="space-y-4">
          <Field label={t(M.textLabel)} htmlFor={`${uid}-text`}>
            <TextArea
              id={`${uid}-text`}
              rows={4}
              spellCheck={false}
              placeholder={t(M.textPlaceholder)}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </Field>
          {textFailed && text !== "" ? (
            <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
              {t(M.webCryptoError)}
            </p>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border">
              <HashRow label="MD5" value={shownText ? shownText.md5 : null} uppercase={uppercase} />
              <HashRow label="SHA-1" value={shownText ? shownText.sha1 : null} uppercase={uppercase} />
              <HashRow
                label="SHA-256"
                value={shownText ? shownText.sha256 : null}
                uppercase={uppercase}
              />
              <HashRow
                label="SHA-512"
                value={shownText ? shownText.sha512 : null}
                uppercase={uppercase}
              />
            </div>
          )}
        </CardBody>
      </Card>

      {/* ---- Card 2: HMAC ---- */}
      <Card className="animate-fade-up">
        <CardHeader title={t(M.hmacTitle)} subtitle={t(M.hmacSubtitle)} />
        <CardBody className="space-y-4">
          <Field label={t(M.messageLabel)} htmlFor={`${uid}-hmac-msg`}>
            <TextArea
              id={`${uid}-hmac-msg`}
              rows={3}
              spellCheck={false}
              placeholder={t(M.messagePlaceholder)}
              value={hmacMessage}
              onChange={(e) => setHmacMessage(e.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t(M.secretLabel)} htmlFor={`${uid}-hmac-secret`}>
              <TextInput
                id={`${uid}-hmac-secret`}
                className="font-mono"
                spellCheck={false}
                autoComplete="off"
                placeholder={t(M.secretPlaceholder)}
                value={hmacSecret}
                onChange={(e) => setHmacSecret(e.target.value)}
              />
            </Field>
            <Field label={t(M.algoLabel)} htmlFor={`${uid}-hmac-algo`}>
              <Select
                id={`${uid}-hmac-algo`}
                value={hmacAlgo}
                onChange={(e) => setHmacAlgo(e.target.value as HmacAlgo)}
              >
                <option value="SHA-256">HMAC-SHA-256</option>
                <option value="SHA-512">HMAC-SHA-512</option>
                <option value="SHA-1">HMAC-SHA-1</option>
              </Select>
            </Field>
          </div>
          {hmacFailed && hmacReady ? (
            <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
              {t(M.webCryptoError)}
            </p>
          ) : hmacReady ? (
            <div className="divide-y divide-border rounded-xl border border-border">
              <HashRow label="Hex" value={shownHmac ? shownHmac.hex : null} />
              <HashRow label="Base64" value={shownHmac ? shownHmac.b64 : null} />
            </div>
          ) : (
            <p className="rounded-lg bg-muted px-4 py-4 text-center text-sm text-muted-foreground">
              {t(M.hmacEmpty)}
            </p>
          )}
        </CardBody>
      </Card>

      {/* ---- Card 3: file checksum ---- */}
      <Card className="animate-fade-up">
        <CardHeader title={t(M.fileTitle)} subtitle={t(M.fileSubtitle)} />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label
              className={cn(
                "inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium transition-all",
                "hover:border-primary/50 hover:text-primary",
              )}
            >
              <Upload className="h-4 w-4" aria-hidden />
              {t(M.chooseFile)}
              <input
                type="file"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void hashFile(file);
                  e.target.value = "";
                }}
              />
            </label>
            <p className="text-xs text-muted-foreground">{t(M.privacyNote)}</p>
          </div>

          {fileInfo ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <FileDigit className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="break-all font-medium">{fileInfo.name}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {formatBytes(fileInfo.size, locale)}
              </span>
            </div>
          ) : null}

          {fileInfo && fileInfo.size > WARN_SIZE && fileInfo.size <= SHA_LIMIT ? (
            <p className="flex items-start gap-2 rounded-lg bg-warning/10 px-4 py-3 text-sm text-warning">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {t(M.bigFileWarning)}
            </p>
          ) : null}
          {fileInfo && fileInfo.size > SHA_LIMIT ? (
            <p className="flex items-start gap-2 rounded-lg bg-warning/10 px-4 py-3 text-sm text-warning">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {t(M.shaSkipped)}
            </p>
          ) : null}

          {fileState === "working" ? (
            <div className="space-y-1.5">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${fileProgress}%` }}
                />
              </div>
              <p className="text-xs tabular-nums text-muted-foreground">
                {t(M.computing)}… {fileProgress}%
              </p>
            </div>
          ) : null}

          {fileState === "error" ? (
            <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">{t(M.fileError)}</p>
          ) : null}

          {fileState === "done" && fileHashes ? (
            <div className="divide-y divide-border rounded-xl border border-border">
              <HashRow label="MD5" value={fileHashes.md5} />
              <HashRow label="SHA-256" value={fileHashes.sha256} />
            </div>
          ) : null}
        </CardBody>
      </Card>

      {/* ---- Card 4: bcrypt ---- */}
      <Card className="animate-fade-up">
        <CardHeader title={t(M.bcryptTitle)} subtitle={t(M.bcryptSubtitle)} />
        <CardBody>
          <div className="grid items-start gap-6 lg:grid-cols-2">
            {/* Verify */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t(M.verifySection)}
              </h4>
              <Field label={t(M.plainLabel)} htmlFor={`${uid}-bc-plain`}>
                <TextInput
                  id={`${uid}-bc-plain`}
                  spellCheck={false}
                  autoComplete="off"
                  value={bcPlain}
                  onChange={(e) => {
                    setBcPlain(e.target.value);
                    setBcVerify("idle");
                  }}
                />
              </Field>
              <Field label={t(M.hashLabel)} htmlFor={`${uid}-bc-hash`}>
                <TextInput
                  id={`${uid}-bc-hash`}
                  className="font-mono"
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="$2b$10$…"
                  value={bcHash}
                  onChange={(e) => {
                    setBcHash(e.target.value);
                    setBcVerify("idle");
                  }}
                />
              </Field>
              <Button onClick={() => void runCompare()} disabled={bcVerify === "busy"}>
                {bcVerify === "busy" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                )}
                {t(M.compareBtn)}
              </Button>
              {bcVerify === "match" ? (
                <div className="flex items-center gap-3 rounded-xl bg-success/10 px-4 py-3 text-sm font-semibold text-success">
                  <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden />
                  {t(M.match)}
                </div>
              ) : bcVerify === "nomatch" ? (
                <div className="flex items-center gap-3 rounded-xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
                  <ShieldX className="h-5 w-5 shrink-0" aria-hidden />
                  {t(M.noMatch)}
                </div>
              ) : bcVerify === "error" ? (
                <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
                  {t(M.compareError)}
                </p>
              ) : bcVerify === "need-input" ? (
                <p className="rounded-lg bg-warning/10 px-4 py-3 text-sm text-warning">
                  {t(M.needPlainAndHash)}
                </p>
              ) : null}
            </div>

            {/* Generate */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t(M.genSection)}
              </h4>
              <Field label={t(M.plainLabel)} htmlFor={`${uid}-gen-plain`}>
                <TextInput
                  id={`${uid}-gen-plain`}
                  spellCheck={false}
                  autoComplete="off"
                  value={genPlain}
                  onChange={(e) => {
                    setGenPlain(e.target.value);
                    if (genState !== "busy") setGenState("idle");
                  }}
                />
              </Field>
              <Field label={t(M.costLabel)} htmlFor={`${uid}-gen-cost`} hint={t(M.costHint)}>
                <Select
                  id={`${uid}-gen-cost`}
                  value={String(genCost)}
                  onChange={(e) => setGenCost(Number(e.target.value))}
                >
                  <option value="8">8</option>
                  <option value="10">10</option>
                  <option value="12">12</option>
                </Select>
              </Field>
              <Button onClick={() => void runGenerate()} disabled={genState === "busy"}>
                {genState === "busy" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                {t(M.generateBtn)}
              </Button>
              {genState === "error" ? (
                <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
                  {t(M.genError)}
                </p>
              ) : genState === "need-input" ? (
                <p className="rounded-lg bg-warning/10 px-4 py-3 text-sm text-warning">
                  {t(M.needPlain)}
                </p>
              ) : null}
              {genOut ? (
                <div className="space-y-2">
                  <div className="break-all rounded-xl bg-muted p-4 font-mono text-xs leading-relaxed sm:text-sm">
                    {genOut}
                  </div>
                  <CopyButton text={genOut} />
                </div>
              ) : null}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
