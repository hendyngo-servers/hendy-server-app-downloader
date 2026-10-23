import React, { useState } from "react";
import type { BuildArtifact } from "./types.ts";

interface IntegrityModalProps {
  artifact: BuildArtifact | null;
  downloadUrl: string;
  onClose: () => void;
  onNotify: (message: string) => void;
}

/** Shows the server-recorded SHA-256 and any explicitly provided signature metadata. */
export const IntegrityModal: React.FC<IntegrityModalProps> = ({ artifact, downloadUrl, onClose, onNotify }) => {
  const [copyError, setCopyError] = useState("");
  if (!artifact) return null;

  const copyDigest = async () => {
    try {
      await navigator.clipboard.writeText(artifact.sha256);
      setCopyError("");
      onNotify("Đã sao chép mã SHA-256.");
    } catch {
      setCopyError("Trình duyệt không cho phép truy cập clipboard. Hãy chọn và sao chép mã băm thủ công.");
    }
  };

  const isValidSha = /^[a-f0-9]{64}$/i.test(artifact.sha256 || "");

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="integrity-title" className="w-full max-w-xl rounded-3xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-[.2em] text-emerald-300">ARTIFACT VERIFICATION</span>
            <h2 id="integrity-title" className="mt-1 text-lg font-extrabold">Tính toàn vẹn của gói tải</h2>
            <p className="mt-1 break-all font-mono text-xs text-slate-400">{artifact.filename}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-lg px-3 py-1 text-xl text-slate-400 hover:bg-slate-800 hover:text-white">×</button>
        </div>

        <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950 p-4">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className={isValidSha ? "text-emerald-300" : "text-rose-300"}>{isValidSha ? "✓" : "!"}</span>
            <span>{isValidSha ? "SHA-256 đã được ghi nhận cho artifact" : "Không có mã SHA-256 hợp lệ"}</span>
          </div>
          <code className="mt-3 block break-all font-mono text-[11px] leading-5 text-emerald-200 select-all">{artifact.sha256 || "Chưa có mã băm"}</code>
          {copyError && <p role="alert" className="mt-2 text-[11px] leading-5 text-amber-200">{copyError}</p>}
          <button type="button" onClick={() => void copyDigest()} disabled={!isValidSha} className="mt-3 rounded-lg border border-slate-700 px-3 py-2 text-[11px] font-bold text-slate-200 hover:border-emerald-400 disabled:opacity-50">Sao chép SHA-256</button>
        </div>

        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
          <h3 className="text-xs font-bold text-slate-200">Thông tin chữ ký / Authenticode</h3>
          {artifact.signatureInfo ? (
            <div className="mt-2 space-y-1 text-[11px] text-slate-400">
              <p>Nhà phát hành khai báo: <strong className="text-slate-200">{artifact.signatureInfo.issuer}</strong></p>
              <p>Loại chứng chỉ: {artifact.signatureInfo.certificateType}</p>
              <p>Số sê-ri: <span className="font-mono">{artifact.signatureInfo.serialNumber}</span></p>
              <p>Dấu thời gian: {artifact.signatureInfo.timestamp}</p>
              <p className="mt-2 text-amber-200">Thông tin trên là metadata được cung cấp cùng artifact; cửa sổ này không tự xác minh chuỗi chứng chỉ Authenticode.</p>
            </div>
          ) : (
            <p className="mt-2 text-[11px] leading-5 text-slate-400">Chưa có dữ liệu chữ ký số để hiển thị. Không nên coi artifact là đã được Authenticode ký chỉ dựa vào mã SHA-256.</p>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Lệnh kiểm tra trên máy của bạn</span>
          <code className="mt-2 block break-all font-mono text-[11px] text-indigo-200">{artifact.platform === "windows" ? `Get-FileHash ".\\${artifact.filename}" -Algorithm SHA256` : `sha256sum "${artifact.filename}"`}</code>
          <span className="mt-3 block text-[10px] font-bold uppercase tracking-wider text-slate-500">URL phát hành</span>
          <code className="mt-1 block break-all font-mono text-[10px] text-slate-400">{downloadUrl}</code>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800">Đóng</button>
          <a href={downloadUrl} download={artifact.filename} onClick={onClose} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-300">Tải artifact ↓</a>
        </div>
      </section>
    </div>
  );
};
