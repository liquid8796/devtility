"use client";

import { ArrowLeftRight, FileText, Trash2, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Select, TextArea } from "@/components/ui/field";
import type { Localized } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/use-lang";

import { convert, FORMAT_LABELS, FORMATS, SAMPLES, type Format } from "./convert";

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

const M = {
  from: { vi: "Từ", en: "From" },
  to: { vi: "Sang", en: "To" },
  swap: { vi: "Đổi chiều chuyển đổi", en: "Swap conversion direction" },
  sample: { vi: "Dữ liệu mẫu", en: "Sample" },
  clear: { vi: "Xóa", en: "Clear" },
  inputTitle: { vi: "Đầu vào", en: "Input" },
  outputTitle: { vi: "Kết quả", en: "Output" },
  inputPlaceholder: {
    vi: "Dán dữ liệu nguồn vào đây…",
    en: "Paste your source data here…",
  },
  outputPlaceholder: {
    vi: "Kết quả chuyển đổi sẽ hiển thị ở đây…",
    en: "The converted result will appear here…",
  },
  warningsTitle: { vi: "Cảnh báo", en: "Warnings" },
  lossyNote: {
    vi: "Lưu ý: XML và CSV không giữ đủ thông tin kiểu/cấu trúc — chuyển đổi hai chiều có thể không giống hệt bản gốc.",
    en: "Note: XML and CSV cannot preserve full type/structure information — round-tripping may not match the original exactly.",
  },
  copy: { vi: "Sao chép kết quả", en: "Copy output" },
} satisfies Record<string, Localized>;

function inputSubtitle(from: Format): Localized {
  return {
    vi: `Định dạng nguồn: ${FORMAT_LABELS[from]}`,
    en: `Source format: ${FORMAT_LABELS[from]}`,
  };
}

function outputSubtitle(to: Format): Localized {
  return {
    vi: `Định dạng đích: ${FORMAT_LABELS[to]}`,
    en: `Target format: ${FORMAT_LABELS[to]}`,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function JsonConverterTool() {
  const { t } = useI18n();
  const [from, setFrom] = useState<Format>("json");
  const [to, setTo] = useState<Format>("yaml");
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");

  // Debounced live conversion (setState only inside the timeout callback).
  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(input);
    }, 300);
    return () => clearTimeout(id);
  }, [input]);

  const result = useMemo(() => {
    if (debounced.trim() === "") return null;
    return convert(debounced, from, to);
  }, [debounced, from, to]);

  const output = result?.ok ? result.output : "";
  const lossy = from === "xml" || to === "xml" || from === "csv" || to === "csv";

  const handleSwap = () => {
    setFrom(to);
    setTo(from);
    if (result?.ok && result.output.trim() !== "") {
      setInput(result.output);
      setDebounced(result.output);
    }
  };

  const handleSample = () => {
    setInput(SAMPLES[from]);
    setDebounced(SAMPLES[from]);
  };

  const handleClear = () => {
    setInput("");
    setDebounced("");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="flex flex-wrap items-end gap-3">
          <Field label={t(M.from)} htmlFor="jc-from" className="w-32 max-[400px]:w-full">
            <Select id="jc-from" value={from} onChange={(e) => setFrom(e.target.value as Format)}>
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {FORMAT_LABELS[f]}
                </option>
              ))}
            </Select>
          </Field>
          <Button variant="outline" size="icon" onClick={handleSwap} aria-label={t(M.swap)} title={t(M.swap)}>
            <ArrowLeftRight className="h-4 w-4" />
          </Button>
          <Field label={t(M.to)} htmlFor="jc-to" className="w-32 max-[400px]:w-full">
            <Select id="jc-to" value={to} onChange={(e) => setTo(e.target.value as Format)}>
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {FORMAT_LABELS[f]}
                </option>
              ))}
            </Select>
          </Field>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleSample}>
              <FileText className="h-3.5 w-3.5" />
              {t(M.sample)} ({FORMAT_LABELS[from]})
            </Button>
            <Button size="sm" variant="ghost" onClick={handleClear}>
              <Trash2 className="h-3.5 w-3.5" />
              {t(M.clear)}
            </Button>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t(M.inputTitle)} subtitle={t(inputSubtitle(from))} />
          <CardBody>
            <TextArea
              rows={18}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t(M.inputPlaceholder)}
              spellCheck={false}
              className="min-h-[24rem]"
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={t(M.outputTitle)}
            subtitle={t(outputSubtitle(to))}
            actions={<CopyButton text={output} label={t(M.copy)} />}
          />
          <CardBody className="space-y-3">
            <TextArea
              readOnly
              rows={18}
              value={output}
              placeholder={t(M.outputPlaceholder)}
              spellCheck={false}
              className="min-h-[24rem] bg-muted/30"
            />

            {result && !result.ok ? (
              <p className="break-words text-sm text-danger">{t(result.error)}</p>
            ) : null}

            {result?.ok && result.warnings.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-warning">
                  {t(M.warningsTitle)}
                </p>
                <ul className="space-y-1 text-xs text-warning">
                  {result.warnings.map((warning, index) => (
                    <li key={index} className="flex gap-1.5">
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{t(warning)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {lossy ? <p className="text-xs text-muted-foreground">{t(M.lossyNote)}</p> : null}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
