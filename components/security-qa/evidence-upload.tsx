"use client";

import { useCallback, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { QA_BUCKETS, QA_ALLOWED_EXTENSIONS, QA_MAX_FILE_SIZE_BYTES } from "@/lib/security-qa/config";
import { UploadCloud, FileCheck2, XCircle, Loader2 } from "lucide-react";

export interface UploadedEvidence {
  /** Caminho do objeto dentro do bucket qa-temp-evidences. */
  storagePath: string;
  fileName: string;
  sizeBytes: number;
}

interface EvidenceUploadProps {
  onUploaded: (evidence: UploadedEvidence) => void;
  onCleared: () => void;
  disabled?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function EvidenceUpload({ onUploaded, onCleared, disabled }: EvidenceUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<UploadedEvidence | null>(null);

  const reset = useCallback(() => {
    setError(null);
    setUploaded(null);
    onCleared();
    if (inputRef.current) inputRef.current.value = "";
  }, [onCleared]);

  const handleFile = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return;
      setError(null);

      // Validação estrita NO CLIENTE: extensão permitida.
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!(QA_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
        setError(`Extensão "${ext}" não permitida. Aceito apenas: ${QA_ALLOWED_EXTENSIONS.join(", ")}.`);
        return;
      }

      // Validação estrita NO CLIENTE: tamanho máximo de 5 MB.
      if (file.size > QA_MAX_FILE_SIZE_BYTES) {
        setError(`Arquivo de ${formatBytes(file.size)} excede o limite de 5 MB.`);
        return;
      }

      setUploading(true);
      setUploaded(null);
      onCleared();

      try {
        // Upload DIRETO do frontend para o bucket temporário qa-temp-evidences.
        const client = createClient();
        const storagePath = `ingest/${Date.now()}-${crypto.randomUUID()}-${file.name}`;
        const { error: uploadError } = await client.storage
          .from(QA_BUCKETS.temp)
          .upload(storagePath, file, {
            contentType: file.type || "application/octet-stream",
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          const hint = uploadError.message.toLowerCase().includes("bucket")
            ? "Bucket de evidências não configurado. Aplique a migração supabase-security-qa.sql."
            : uploadError.message;
          setError(`Falha no upload: ${hint}`);
          return;
        }

        const evidence: UploadedEvidence = {
          storagePath,
          fileName: file.name,
          sizeBytes: file.size,
        };
        setUploaded(evidence);
        onUploaded(evidence);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro inesperado no upload.");
      } finally {
        setUploading(false);
      }
    },
    [onCleared, onUploaded]
  );

  return (
    <div className="space-y-3">
      {uploaded ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileCheck2 className="h-5 w-5 text-green-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{uploaded.fileName}</p>
                <p className="text-xs text-gray-500">
                  {formatBytes(uploaded.sizeBytes)} · enviado para <code className="font-mono">{QA_BUCKETS.temp}</code>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={reset}
              disabled={disabled}
              className="text-xs text-red-600 hover:text-red-700 font-semibold shrink-0"
            >
              Remover
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          className={`w-full rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            error
              ? "border-red-300 bg-red-50/50"
              : "border-gray-300 bg-gray-50 hover:border-primary hover:bg-primary-light/40"
          } disabled:opacity-60`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-7 w-7 text-primary animate-spin" />
              <p className="text-sm font-medium text-gray-600">Enviando para o bucket temporário...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <UploadCloud className="h-7 w-7 text-gray-400" />
              <p className="text-sm font-semibold text-gray-700">Arraste o relatório de segurança ou clique para selecionar</p>
              <p className="text-xs text-gray-500">
                Formatos aceitos: <code className="font-mono">.json</code>, <code className="font-mono">.xml</code>,{" "}
                <code className="font-mono">.txt</code> · máx. 5 MB
              </p>
            </div>
          )}
        </button>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
          <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={QA_ALLOWED_EXTENSIONS.join(",")}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
