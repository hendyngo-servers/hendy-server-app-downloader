import React from "react";
import type { ReleaseVersion } from "./types.ts";

interface PublishModalProps {
  release: ReleaseVersion | null;
  onClose: () => void;
  onConfirm: () => void;
}

/** Final review step before persisting a release to the public download portal. */
export const PublishModal: React.FC<PublishModalProps> = ({ release, onClose, onConfirm }) => {
  if (!release) return null;
  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md">
      <section role="dialog" aria-modal="true" aria-labelledby="publish-release-title" className="w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl">
        <div className="flex items-start gap-3 border-b border-slate-800 pb-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-400/10 text-xl text-emerald-300">↗</span>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-emerald-300">RELEASE CONSOLE</p>
            <h2 id="publish-release-title" className="mt-1 text-lg font-extrabold">Xác nhận công bố bản phát hành</h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">Bản phát hành sẽ được lưu qua API quản trị. Chỉ artifact thật đã được tải lên mới có thể cung cấp liên kết tải.</p>
          </div>
        </div>
        <div className="mt-5 space-y-3 rounded-xl border border-slate-700 bg-slate-950 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">Phiên bản</span>
            <strong className="font-mono text-sm text-emerald-200">{release.version}</strong>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">Kênh</span>
            <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] font-bold uppercase text-slate-200">{release.channel}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500">Tiêu đề</span>
            <p className="mt-1 text-sm font-semibold text-slate-100">{release.title}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Artifact đính kèm</span>
            <p className="mt-1 text-sm font-semibold text-slate-100">{release.artifacts.length}</p>
            {release.artifacts.length > 0 && <ul className="mt-2 space-y-1 text-[11px] text-slate-400">{release.artifacts.map(item => <li key={item.id} className="break-all">• {item.filename}</li>)}</ul>}
          </div>
          {release.artifacts.length === 0 && <p className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-[11px] leading-5 text-amber-200">Bản phát hành này chưa có artifact. Backend có thể không công khai bản phát hành cho đến khi có gói tệp thật.</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800">Quay lại chỉnh sửa</button>
          <button type="button" onClick={onConfirm} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-300">Xác nhận công bố</button>
        </div>
      </section>
    </div>
  );
};
