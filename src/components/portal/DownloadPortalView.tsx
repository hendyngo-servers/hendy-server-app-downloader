/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ProjectTemplate, TargetPlatform, BuildArtifact } from '../../types/index.ts';
import {
  formatBytes,
  getRecommendedInstallerCommand,
  createExecutableInstallerScript,
  getPlatformVietnameseName
} from '../../utils/packaging.ts';
import { WebSandboxModal } from './WebSandboxModal.tsx';

interface DownloadPortalViewProps {
  project: ProjectTemplate;
  projects: ProjectTemplate[];
  onSelectProject: (p: ProjectTemplate) => void;
  detectedOS: TargetPlatform;
  onNotify: (msg: string) => void;
}

export const DownloadPortalView: React.FC<DownloadPortalViewProps> = ({
  project,
  projects,
  onSelectProject,
  detectedOS,
  onNotify
}) => {
  const [activePlatformTab, setActivePlatformTab] = useState<TargetPlatform>(detectedOS);
  const [showSandbox, setShowSandbox] = useState(false);
  const [showChecksumModal, setShowChecksumModal] = useState<BuildArtifact | null>(null);

  const latestRelease = project.releases[0] || {
    version: project.currentVersion,
    title: 'Bản Phát Hành Thương Mại Chính Thức',
    releaseDate: 'Tháng 10, 2026',
    changelog: ['Bản đóng gói đa nền tảng đạt chuẩn bảo mật EV'],
    artifacts: []
  };

  const matchingArtifacts = latestRelease.artifacts.filter(a => a.platform === activePlatformTab);
  const primaryDetectedArtifact = latestRelease.artifacts.find(a => a.platform === detectedOS) || latestRelease.artifacts[0];

  const handleDownload = (artifact?: BuildArtifact) => {
    const target = artifact || primaryDetectedArtifact;
    if (!target) {
      onNotify('Gói cài đặt cho nền tảng này đang được chuẩn bị.');
      return;
    }

    const scriptContent = createExecutableInstallerScript(
      project.name,
      latestRelease.version,
      target.platform,
      target.format
    );
    const blob = new Blob([scriptContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = target.platform === 'windows' ? `${target.filename}.bat` : `${target.filename}.sh`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onNotify(`Đang tải xuống ${target.filename} (${formatBytes(target.sizeBytes)})`);
  };

  const cliInstruction = getRecommendedInstallerCommand(activePlatformTab, project.slug, latestRelease.version);

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Cửa sổ Web Sandbox chạy thử trực tiếp */}
      <WebSandboxModal
        isOpen={showSandbox}
        onClose={() => setShowSandbox(false)}
        project={project}
      />

      {/* Cửa sổ đối soát chữ ký số & mã băm SHA-256 */}
      {showChecksumModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Kiểm Tra Tính Toàn Vẹn & Ký Số Thương Mại</h3>
              <button
                onClick={() => setShowChecksumModal(null)}
                className="text-slate-400 hover:text-white font-mono"
              >
                ×
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 block mb-0.5">Tên Tệp Gói Phát Hành:</span>
                <span className="font-mono text-white">{showChecksumModal.filename}</span>
              </div>
              {showChecksumModal.signatureInfo && (
                <div className="p-2.5 bg-slate-950 border border-emerald-900/50 rounded space-y-1">
                  <div className="text-emerald-400 font-semibold">Chứng Chỉ Ký Số EV: Đã Xác Thực</div>
                  <div className="text-slate-400 text-[11px]">Đơn vị phát hành: {showChecksumModal.signatureInfo.issuer}</div>
                  <div className="text-slate-400 text-[11px]">Số sê-ri chứng thư: {showChecksumModal.signatureInfo.serialNumber}</div>
                </div>
              )}
              <div>
                <span className="text-slate-500 block mb-0.5">Mã Băm SHA-256 (Mã Định Danh Duy Nhất):</span>
                <div className="bg-slate-950 p-2.5 rounded font-mono text-[11px] text-emerald-400 break-all select-all">
                  {showChecksumModal.sha256}
                </div>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Lệnh Kiểm Tra Tại Thiết Bị Khách:</span>
                <div className="bg-slate-950 p-2.5 rounded font-mono text-[11px] text-slate-300">
                  sha256sum {showChecksumModal.filename}
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(showChecksumModal.sha256);
                  onNotify('Đã sao chép mã băm SHA-256 vào khay nhớ tạm!');
                  setShowChecksumModal(null);
                }}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded text-xs font-semibold"
              >
                Sao Chép Mã Băm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phần giới thiệu chính (Hero Banner) */}
      <div className="border-b border-slate-800/80 bg-gradient-to-b from-slate-900/60 to-slate-950 py-16 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          {/* Danh sách phần mềm phát hành */}
          <div className="inline-flex items-center gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs">
            <span className="text-slate-500 pl-2">Phần Mềm Đang Chọn:</span>
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelectProject(p)}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  project.id === p.id
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">
              Cổng Tải Về & Trải Nghiệm Phần Mềm Chính Thức
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
              {project.name}
            </h1>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
              {project.tagline}
            </p>
            <div className="flex items-center justify-center gap-3 text-xs text-slate-400 pt-1">
              <span>Phiên bản {project.currentVersion}</span>
              <span>·</span>
              <span>Phát hành bởi {project.publisher}</span>
              <span>·</span>
              <span className="text-emerald-400">Chứng Chỉ Thương Mại EV Xác Thực</span>
            </div>
          </div>

          {/* Nút hành động tự động theo hệ điều hành người dùng */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => handleDownload()}
              className="w-full sm:w-auto px-8 py-3.5 bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 text-slate-950 font-bold rounded-xl text-sm shadow-lg shadow-emerald-950/40 transition-all flex items-center justify-center gap-3"
            >
              <span>Tải Về Cho {getPlatformVietnameseName(detectedOS).split(' ')[0].toUpperCase()}</span>
              {primaryDetectedArtifact && (
                <span className="font-mono text-xs opacity-80">
                  ({formatBytes(primaryDetectedArtifact.sizeBytes)})
                </span>
              )}
            </button>

            <button
              onClick={() => setShowSandbox(true)}
              className="w-full sm:w-auto px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-sm border border-slate-700 transition-colors flex items-center justify-center gap-2"
            >
              <span>Chạy Thử Trên Trình Duyệt</span>
              <span className="text-xs text-indigo-400 font-mono">WASM 60FPS</span>
            </button>
          </div>

          <div className="text-xs text-slate-500">
            Hệ điều hành nhận diện được:{' '}
            <span className="text-slate-300 font-semibold">{getPlatformVietnameseName(detectedOS)}</span>
            {' '}· Tương thích toàn diện với vi xử lý Intel, AMD và Apple Silicon
          </div>
        </div>
      </div>

      {/* Ma trận tất cả hệ điều hành */}
      <div className="max-w-5xl mx-auto py-12 px-6 space-y-8">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Lựa Chọn Gói Cài Đặt Theo Từng Nền Tảng
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Chọn hệ điều hành thiết bị của bạn để lấy gói cài đặt trực tiếp, câu lệnh trình quản lý gói hoặc chạy thử nghiệm trực tiếp.
          </p>
        </div>

        {/* Các thẻ chuyển đổi hệ điều hành */}
        <div className="flex items-center gap-2 border-b border-slate-800 overflow-x-auto pb-2">
          {[
            { id: 'windows', name: 'Windows', icon: '🪟' },
            { id: 'macos', name: 'macOS', icon: '🍎' },
            { id: 'linux', name: 'Linux', icon: '🐧' },
            { id: 'android', name: 'Android', icon: '🤖' },
            { id: 'ios', name: 'iOS', icon: '📱' },
            { id: 'web', name: 'Trình Duyệt Web', icon: '🌐' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActivePlatformTab(tab.id as TargetPlatform)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activePlatformTab === tab.id
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.name}</span>
            </button>
          ))}
        </div>

        {/* Khung nội dung chi tiết theo hệ điều hành */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white">
                Tùy Chọn Cài Đặt Cho {getPlatformVietnameseName(activePlatformTab)}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Các gói cài đặt độc lập với kênh tự động cập nhật và chữ ký số an toàn.
              </p>
            </div>
            <button
              onClick={() => handleDownload()}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shrink-0"
            >
              Tải Gói {activePlatformTab.toUpperCase()} Về Máy
            </button>
          </div>

          {/* Hướng dẫn cài đặt dòng lệnh */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold">{cliInstruction.manager}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(cliInstruction.command);
                  onNotify('Đã sao chép câu lệnh cài đặt vào khay nhớ tạm!');
                }}
                className="text-indigo-400 hover:text-indigo-300 text-xs font-mono"
              >
                Sao Chép Lệnh
              </button>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-200 select-all">
              {cliInstruction.command}
            </div>
          </div>

          {/* Danh sách tệp phân phối có sẵn */}
          <div className="space-y-3">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
              Tệp Nhị Phân Khả Dụng Trong Kho Lưu Trữ
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {matchingArtifacts.length > 0 ? (
                matchingArtifacts.map(art => (
                  <div
                    key={art.id}
                    className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-white font-mono">{art.filename}</div>
                      <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                        <span>Kiến trúc: {art.arch}</span>
                        <span>·</span>
                        <span>{formatBytes(art.sizeBytes)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowChecksumModal(art)}
                        className="text-[11px] text-slate-400 hover:text-slate-200 font-mono underline"
                      >
                        SHA-256
                      </button>
                      <button
                        onClick={() => handleDownload(art)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-semibold"
                      >
                        Tải Tệp
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 p-6 bg-slate-950 rounded-xl border border-slate-800 text-center text-xs text-slate-400">
                  Gói cài đặt tương thích toàn cầu có thể cài đặt trực tiếp qua nút tải về hoặc câu lệnh phía trên.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Ghi chú phát hành & Danh sách tính năng */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">
                Ghi Chú Phát Hành: {latestRelease.version} ({latestRelease.title})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Ngày phát hành: {latestRelease.releaseDate} · Kênh phân phối: {latestRelease.channel === 'stable' ? 'Chính Thức' : latestRelease.channel}
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800/60">
              Đạt Chuẩn Thương Mại
            </span>
          </div>

          <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
            {latestRelease.changelog.map((item, idx) => (
              <li key={idx} className="leading-relaxed">{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
