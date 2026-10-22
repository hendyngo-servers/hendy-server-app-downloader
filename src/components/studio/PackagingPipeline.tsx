/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ProjectTemplate, TargetPlatform, ArchType, BuildArtifact } from '../../types/index.ts';
import {
  formatBytes,
  generateArtifactFilename,
  generatePseudoSha256,
  createExecutableInstallerScript
} from '../../utils/packaging.ts';

interface PackagingPipelineProps {
  project: ProjectTemplate;
  onAddArtifact: (artifact: BuildArtifact) => void;
  onNotify: (msg: string) => void;
}

export const PackagingPipeline: React.FC<PackagingPipelineProps> = ({
  project,
  onAddArtifact,
  onNotify
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<TargetPlatform>('windows');
  const [selectedArch, setSelectedArch] = useState<ArchType>('x86_64');
  const [selectedFormat, setSelectedFormat] = useState<string>('.exe');
  const [enableSigning, setEnableSigning] = useState<boolean>(true);
  const [desktopShortcut, setDesktopShortcut] = useState<boolean>(true);
  const [isBuilding, setIsBuilding] = useState<boolean>(false);
  const [buildLogs, setBuildLogs] = useState<string[]>([
    'Hệ thống đóng gói đa nền tảng ForgeOS v4.2 tiêu chuẩn thương mại đã sẵn sàng.',
    'Vui lòng chọn hệ điều hành đích và tùy chọn đóng gói để bắt đầu quá trình biên dịch.'
  ]);

  const platformConfig = project.platforms.find(p => p.platform === selectedPlatform) || project.platforms[0];

  const handlePlatformChange = (p: TargetPlatform) => {
    setSelectedPlatform(p);
    const cfg = project.platforms.find(item => item.platform === p);
    if (cfg && cfg.formats.length > 0) {
      setSelectedFormat(cfg.formats[0].format);
      setSelectedArch(cfg.formats[0].architectures[0] || 'x86_64');
    }
  };

  const handleStartBuild = async () => {
    setIsBuilding(true);
    setBuildLogs([
      `[00.00s] Đang khởi tạo tiến trình đóng gói thương mại cho ${project.name} (${project.currentVersion})...`,
      `[00.12s] Hệ điều hành đích: ${selectedPlatform.toUpperCase()} | Kiến trúc CPU: ${selectedArch} | Định dạng: ${selectedFormat}`,
      `[00.28s] Kiểm tra bộ công cụ biên dịch: ${project.framework}...`,
      `[00.54s] Giải quyết các gói phụ thuộc hệ thống và áp dụng cờ tối ưu hóa...`,
      `[01.10s] Biên dịch cây mã nguồn với chế độ tối ưu hóa thương mại (--release / -O3)...`
    ]);

    setTimeout(() => {
      setBuildLogs(prev => [
        ...prev,
        `[01.85s] Liên kết nhị phân với các API hệ thống đồ họa và mạng...`,
        `[02.40s] Gỡ bỏ toàn bộ debug symbols (Binary Stripping) ngăn chặn rò rỉ mã nguồn...`,
        `[02.75s] Đóng gói tài nguyên tĩnh, biểu tượng (32x32, 128x128, 512x512) và phông chữ...`
      ]);
    }, 600);

    setTimeout(() => {
      setBuildLogs(prev => [
        ...prev,
        enableSigning
          ? `[03.10s] Ký số điện tử thương mại (EV Code Signing) xác thực danh tính nhà phát triển...`
          : `[03.10s] Bỏ qua ký số theo cấu hình người dùng.`,
        `[03.70s] Đóng gói bộ cài đặt độc lập (${selectedFormat})...`,
        `[04.20s] Thiết lập lối tắt Desktop & Menu Bắt Đầu: ${desktopShortcut ? 'BẬT' : 'TẮT'}...`
      ]);
    }, 1200);

    setTimeout(() => {
      const filename = generateArtifactFilename(
        project.name,
        project.currentVersion,
        selectedPlatform,
        selectedArch,
        selectedFormat
      );
      const sha256 = generatePseudoSha256(`${project.name}-${project.currentVersion}-${selectedPlatform}-${Date.now()}`);
      const mockSizeBytes = Math.floor(35000000 + Math.random() * 25000000);

      const newArtifact: BuildArtifact = {
        id: `art-${Date.now()}`,
        platform: selectedPlatform,
        format: selectedFormat,
        arch: selectedArch,
        filename,
        sizeBytes: mockSizeBytes,
        sha256,
        downloadUrl: `/api/download/${filename}`,
        createdAt: new Date().toISOString(),
        verified: true,
        signatureInfo: {
          issuer: 'DigiCert Commercial EV Code Signing CA G3',
          certificateType: 'Extended Validation (EV)',
          timestamp: new Date().toISOString(),
          serialNumber: `VN-${Date.now().toString(16).toUpperCase()}`
        }
      };

      onAddArtifact(newArtifact);

      setBuildLogs(prev => [
        ...prev,
        `[04.85s] Tính toán đối soát mã băm SHA-256: ${sha256}`,
        `[05.10s] Tải tệp lên hạ tầng lưu trữ chuyên biệt (Cloudflare R2): ${filename} (${formatBytes(mockSizeBytes)})`,
        `[05.30s] THÀNH CÔNG: Tệp nhị phân phần mềm đã được đóng gói và sẵn sàng phát hành!`
      ]);
      setIsBuilding(false);
      onNotify(`Đã đóng gói thành công tệp ${filename}!`);
    }, 1800);
  };

  const handleDownloadArtifact = (artifact: BuildArtifact) => {
    const scriptContent = createExecutableInstallerScript(
      project.name,
      project.currentVersion,
      artifact.platform,
      artifact.format
    );
    const blob = new Blob([scriptContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = artifact.platform === 'windows' ? `${artifact.filename}.bat` : `${artifact.filename}.sh`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onNotify(`Đã tải xuống gói cài đặt: ${a.download}`);
  };

  const allArtifacts = project.releases.flatMap(r => r.artifacts);

  return (
    <div className="flex-1 bg-slate-950 p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Tiêu đề mục */}
        <div className="border-b border-slate-800 pb-4">
          <h2 className="text-xl font-bold text-white tracking-tight">
            Động Cơ Đóng Gói Phần Mềm Đa Nền Tảng
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Biên dịch, ký số thương mại EV và đóng gói {project.name} cho mọi hệ điều hành với bộ cài đặt độc lập.
          </p>
        </div>

        {/* Lựa chọn hệ điều hành đích */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
            Chọn Hệ Điều Hành Đích Cần Đóng Gói
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { id: 'windows', name: 'Windows', icon: '🪟', desc: '10 / 11 / Server' },
              { id: 'macos', name: 'macOS', icon: '🍎', desc: 'Apple Silicon & Intel' },
              { id: 'linux', name: 'Linux', icon: '🐧', desc: 'AppImage / deb / rpm' },
              { id: 'android', name: 'Android', icon: '🤖', desc: 'APK / AAB Di Động' },
              { id: 'ios', name: 'iOS', icon: '📱', desc: 'IPA / TestFlight' },
              { id: 'web', name: 'Web (WASM)', icon: '🌐', desc: 'Trình Duyệt Web' },
            ].map(os => {
              const isSelected = selectedPlatform === os.id;
              return (
                <button
                  key={os.id}
                  type="button"
                  onClick={() => handlePlatformChange(os.id as TargetPlatform)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-950/40 shadow-sm shadow-indigo-950'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="text-xl mb-1">{os.icon}</div>
                  <div className="text-xs font-semibold text-white">{os.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{os.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cấu hình đóng gói */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              Cấu Hình Đóng Gói Nền Tảng: {selectedPlatform.toUpperCase()}
            </h3>
            <span className="text-xs font-mono text-indigo-400">
              Bộ Công Cụ: {project.framework}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Định dạng gói */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-2">
                Định Dạng Gói Đóng
              </label>
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                {platformConfig?.formats.map(fmt => (
                  <option key={fmt.format} value={fmt.format}>
                    {fmt.name} ({fmt.format})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1.5">
                {platformConfig?.formats.find(f => f.format === selectedFormat)?.description}
              </p>
            </div>

            {/* Kiến trúc CPU */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-2">
                Kiến Trúc Bộ Vi Xử Lý (CPU)
              </label>
              <select
                value={selectedArch}
                onChange={(e) => setSelectedArch(e.target.value as ArchType)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="x86_64">x86_64 (Intel / AMD 64-bit)</option>
                <option value="arm64">ARM64 (Apple Silicon / Snapdragon)</option>
                <option value="universal">Universal Nhị Phân Kép (x86_64 + ARM64)</option>
                <option value="wasm">WebAssembly (Môi Trường Hộp Cát)</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Tập lệnh bộ xử lý tối ưu hóa hiệu năng máy khách.
              </p>
            </div>

            {/* Tùy chọn ký số & phím tắt */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-300 block">
                Bảo Mật & Tùy Chọn Cài Đặt
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={enableSigning}
                  onChange={(e) => setEnableSigning(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-0 bg-slate-950"
                />
                <span>Ký Số EV Code Signing Thương Mại</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={desktopShortcut}
                  onChange={(e) => setDesktopShortcut(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-0 bg-slate-950"
                />
                <span>Tạo Biểu Tượng Desktop & Menu Bắt Đầu</span>
              </label>
            </div>
          </div>

          {/* Nút kích hoạt đóng gói */}
          <div className="pt-2 flex justify-end">
            <button
              onClick={handleStartBuild}
              disabled={isBuilding}
              className={`px-5 py-2.5 rounded-lg text-xs font-semibold text-white shadow-sm flex items-center gap-2 transition-colors ${
                isBuilding
                  ? 'bg-indigo-900/60 text-indigo-300 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700'
              }`}
            >
              {isBuilding ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Đang biên dịch & đóng gói gói phần mềm...</span>
                </>
              ) : (
                <span>Thực Thi Đóng Gói Cho {selectedPlatform.toUpperCase()} ({selectedFormat})</span>
              )}
            </button>
          </div>
        </div>

        {/* Bảng điều khiển đầu ra tiến trình */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Bảng Điều Khiển Nhật Ký Đóng Gói</span>
            <span className="font-mono text-slate-500">ForgeOS Packaging Daemon</span>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-emerald-400 h-44 overflow-y-auto space-y-1">
            {buildLogs.map((log, idx) => (
              <div key={idx} className="leading-5">
                {log}
              </div>
            ))}
          </div>
        </div>

        {/* Danh sách gói phần mềm nhị phân đã tạo */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              Kho Gói Phần Mềm Nhị Phân Sẵn Sàng Phát Hành ({allArtifacts.length})
            </h3>
            <span className="text-xs text-slate-500">Lưu trữ trên hạ tầng chuyên biệt, không chứa mã nguồn</span>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Tệp Nhị Phân</th>
                  <th className="py-2.5 px-4">Nền Tảng</th>
                  <th className="py-2.5 px-4">Kiến Trúc</th>
                  <th className="py-2.5 px-4 text-right">Dung Lượng</th>
                  <th className="py-2.5 px-4">Mã Băm SHA-256</th>
                  <th className="py-2.5 px-4 text-right">Hành Động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {allArtifacts.map((art) => (
                  <tr key={art.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-3 px-4 font-sans font-medium text-white">
                      {art.filename}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-sans">
                      <span className="capitalize">{art.platform}</span> ({art.format})
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {art.arch}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-300">
                      {formatBytes(art.sizeBytes)}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px] max-w-[140px] truncate" title={art.sha256}>
                      {art.sha256.slice(0, 16)}...
                    </td>
                    <td className="py-3 px-4 text-right font-sans">
                      <button
                        onClick={() => handleDownloadArtifact(art)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded text-xs font-medium transition-colors"
                      >
                        Tải Gói Về Máy
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
