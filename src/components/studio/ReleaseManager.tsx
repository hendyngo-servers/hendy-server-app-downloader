/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ProjectTemplate, ReleaseVersion, ReleaseChannel } from '../../types/index.ts';
import { validateSemver, formatBytes } from '../../utils/packaging.ts';

interface ReleaseManagerProps {
  project: ProjectTemplate;
  onPublishRelease: (release: ReleaseVersion) => void;
  onNotify: (msg: string) => void;
}

export const ReleaseManager: React.FC<ReleaseManagerProps> = ({
  project,
  onPublishRelease,
  onNotify
}) => {
  const [newVersion, setNewVersion] = useState('v2.5.0');
  const [releaseTitle, setReleaseTitle] = useState('Bản Phát Hành Thương Mại Đạt Chuẩn Hiệu Năng Cao');
  const [channel, setChannel] = useState<ReleaseChannel>('stable');
  const [changelogText, setChangelogText] = useState(
    'Tích hợp chứng chỉ ký số EV Code Signing thương mại cho Windows và macOS\nTối ưu hóa nhị phân Universal ARM64 cho Apple Silicon và AMD64\nĐồng bộ hóa kho lưu trữ tệp nhị phân Cloudflare R2 độc lập'
  );

  const availableArtifacts = project.releases.flatMap(r => r.artifacts);
  const [selectedArtifactIds, setSelectedArtifactIds] = useState<string[]>(
    availableArtifacts.map(a => a.id)
  );

  const handleToggleArtifact = (id: string) => {
    setSelectedArtifactIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleCreateRelease = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSemver(newVersion)) {
      onNotify('Định dạng phiên bản ngữ nghĩa (SemVer) không hợp lệ. Vui lòng dùng dạng vX.Y.Z (Ví dụ: v2.5.0)');
      return;
    }

    const changelog = changelogText.split('\n').filter(line => line.trim().length > 0);
    const chosenArtifacts = availableArtifacts.filter(a => selectedArtifactIds.includes(a.id));

    const newRelease: ReleaseVersion = {
      version: newVersion,
      tag: newVersion,
      releaseDate: new Date().toLocaleDateString('vi-VN', { month: 'long', day: 'numeric', year: 'numeric' }),
      channel,
      title: releaseTitle,
      changelog,
      artifacts: chosenArtifacts,
      published: true
    };

    onPublishRelease(newRelease);
    onNotify(`Đã xuất bản thành công bản phát hành ${newVersion} lên trang chủ người dùng!`);
  };

  return (
    <div className="flex-1 bg-slate-950 p-6 overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Tiêu đề mục */}
        <div className="border-b border-slate-800 pb-4">
          <h2 className="text-xl font-bold text-white tracking-tight">
            Quản Lý & Phân Phối Phiên Bản Phát Hành
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Xuất bản phần mềm thương mại lên cổng tải về công khai với chứng chỉ bảo vệ và mã băm SHA-256 xác thực.
          </p>
        </div>

        {/* Biểu mẫu tạo bản phát hành mới */}
        <form onSubmit={handleCreateRelease} className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-white">
              Soạn Thảo & Xuất Bản Phiên Bản Thương Mại Mới
            </h3>
            <span className="text-xs text-slate-400">
              Phiên bản hiện tại: <span className="font-mono text-emerald-400">{project.currentVersion}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Phiên bản SemVer */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Thẻ Phiên Bản (SemVer)
              </label>
              <input
                type="text"
                value={newVersion}
                onChange={(e) => setNewVersion(e.target.value)}
                placeholder="v2.5.0"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Tiêu đề phát hành */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Tiêu Đề Bản Phát Hành
              </label>
              <input
                type="text"
                value={releaseTitle}
                onChange={(e) => setReleaseTitle(e.target.value)}
                placeholder="Nâng Cấp Hiệu Năng & An Toàn Thương Mại"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Kênh phân phối */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Kênh Phân Phối
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as ReleaseChannel)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="stable">Chính Thức (Người dùng sản xuất)</option>
                <option value="beta">Thử Nghiệm (Người dùng trải nghiệm sớm)</option>
                <option value="nightly">Hằng Ngày (Biên dịch tự động)</option>
              </select>
            </div>
          </div>

          {/* Ghi chú thay đổi */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Ghi Chú Phát Hành & Danh Sách Cải Tiến (Mỗi dòng một tính năng)
            </label>
            <textarea
              value={changelogText}
              onChange={(e) => setChangelogText(e.target.value)}
              rows={4}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 leading-relaxed"
            />
          </div>

          {/* Đính kèm gói nhị phân */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              Đính Kèm Các Tệp Nhị Phân Đã Đóng Gói
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {availableArtifacts.map(art => {
                const isChecked = selectedArtifactIds.includes(art.id);
                return (
                  <div
                    key={art.id}
                    onClick={() => handleToggleArtifact(art.id)}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                      isChecked
                        ? 'border-indigo-500/60 bg-indigo-950/30 text-white'
                        : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-medium truncate">{art.filename}</div>
                    <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
                      <span className="capitalize">{art.platform} ({art.arch})</span>
                      <span>{formatBytes(art.sizeBytes)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Nút gửi */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              Xuất Bản Lên Cổng Tải Về Cho Người Dùng
            </button>
          </div>
        </form>

        {/* Lịch sử phát hành */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-white">
            Lịch Sử Các Bản Phát Hành Thương Mại
          </h3>
          <div className="space-y-3">
            {project.releases.map((rel) => (
              <div
                key={rel.version}
                className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-bold text-white font-mono">{rel.version}</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-sm font-semibold text-slate-300">{rel.title}</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-xs text-slate-500">{rel.releaseDate}</span>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 uppercase">
                    {rel.channel === 'stable' ? 'CHÍNH THỨC' : rel.channel}
                  </span>
                </div>

                <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                  {rel.changelog.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>

                <div className="text-[11px] text-slate-500 pt-1">
                  Gói tệp đính kèm ({rel.artifacts.length}):{' '}
                  <span className="font-mono text-slate-400">
                    {rel.artifacts.map(a => a.filename).join(', ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
