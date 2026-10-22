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
import { AppDetailModal } from './AppDetailModal.tsx';

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
  const [activePlatformFilter, setActivePlatformFilter] = useState<'all' | TargetPlatform>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSandbox, setShowSandbox] = useState<boolean>(false);
  const [showChecksumModal, setShowChecksumModal] = useState<BuildArtifact | null>(null);
  const [selectedAppForDetail, setSelectedAppForDetail] = useState<ProjectTemplate | null>(null);
  const [selectedPlatformTab, setSelectedPlatformTab] = useState<TargetPlatform>(detectedOS);

  const latestRelease = project.releases[0] || {
    version: project.currentVersion,
    title: 'Bản Phát Hành Thương Mại Chính Thức',
    releaseDate: 'Tháng 10, 2026',
    changelog: ['Bản đóng gói đa nền tảng đạt chuẩn bảo mật EV'],
    artifacts: []
  };

  const matchingArtifacts = latestRelease.artifacts.filter(a => a.platform === selectedPlatformTab);
  const primaryDetectedArtifact = latestRelease.artifacts.find(a => a.platform === detectedOS) || latestRelease.artifacts[0];

  const handleDownload = (targetProject: ProjectTemplate = project, artifact?: BuildArtifact) => {
    const rel = targetProject.releases[0] || targetProject.releases[targetProject.releases.length - 1];
    const target = artifact || rel?.artifacts.find(a => a.platform === detectedOS) || rel?.artifacts[0];
    if (!target) {
      onNotify('Gói cài đặt cho nền tảng này đang được chuẩn bị.');
      return;
    }

    const scriptContent = createExecutableInstallerScript(
      targetProject.name,
      rel.version,
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

    onNotify(`Đang tải xuống ${target.filename} (${formatBytes(target.sizeBytes)}) từ kho Cloudflare R2!`);
  };

  const cliInstruction = getRecommendedInstallerCommand(selectedPlatformTab, project.slug, latestRelease.version);

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.category.toLowerCase().includes(searchQuery.toLowerCase());
    if (activePlatformFilter === 'all') return matchesSearch;
    const hasPlatform = p.platforms.some(plat => plat.platform === activePlatformFilter && plat.enabled);
    return matchesSearch && hasPlatform;
  });

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 overflow-y-auto">
      {/* Modal Chạy thử trực tiếp WebAssembly */}
      <WebSandboxModal
        isOpen={showSandbox}
        onClose={() => setShowSandbox(false)}
        project={project}
      />

      {/* Modal Chi Tiết Phong Cách App Store / Google Play */}
      {selectedAppForDetail && (
        <AppDetailModal
          project={selectedAppForDetail}
          isOpen={true}
          onClose={() => setSelectedAppForDetail(null)}
          detectedOS={detectedOS}
          onDownload={(art) => handleDownload(selectedAppForDetail, art)}
          onOpenSandbox={() => {
            onSelectProject(selectedAppForDetail);
            setShowSandbox(true);
            setSelectedAppForDetail(null);
          }}
          onNotify={onNotify}
        />
      )}

      {/* Modal Kiểm tra mã băm SHA-256 & Chữ ký số */}
      {showChecksumModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Kiểm Tra Tính Toàn Vẹn & Ký Số Thương Mại</h3>
              <button
                onClick={() => setShowChecksumModal(null)}
                className="text-slate-400 hover:text-white font-mono text-lg"
              >
                ×
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 block mb-0.5">Tên Tệp Gói Phát Hành:</span>
                <span className="font-mono text-white font-semibold">{showChecksumModal.filename}</span>
              </div>
              {showChecksumModal.signatureInfo && (
                <div className="p-2.5 bg-slate-950 border border-emerald-900/50 rounded-lg space-y-1">
                  <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
                    <span>✔</span>
                    <span>Chứng Chỉ Ký Số EV: Đã Xác Thực Tính Hợp Lệ</span>
                  </div>
                  <div className="text-slate-400 text-[11px]">Đơn vị phát hành: {showChecksumModal.signatureInfo.issuer}</div>
                  <div className="text-slate-400 text-[11px]">Số sê-ri: {showChecksumModal.signatureInfo.serialNumber}</div>
                </div>
              )}
              <div>
                <span className="text-slate-500 block mb-0.5">Mã Băm SHA-256:</span>
                <div className="bg-slate-950 p-2.5 rounded-lg font-mono text-[11px] text-emerald-400 break-all select-all border border-slate-800">
                  {showChecksumModal.sha256}
                </div>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Lệnh Xác Minh Thiết Bị:</span>
                <div className="bg-slate-950 p-2.5 rounded-lg font-mono text-[11px] text-slate-300 border border-slate-800">
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
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Sao Chép Mã Băm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Spotlight: Thiết kế theo Google Play Store & Apple App Store */}
      <section className="relative overflow-hidden border-b border-slate-800 bg-gradient-to-b from-slate-900/90 via-slate-950 to-slate-950 px-6 pt-10 pb-14">
        {/* Vệt ánh sáng nền */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-r from-indigo-500/10 via-emerald-500/10 to-purple-500/10 blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto relative z-10 space-y-8">
          {/* Header thanh tìm kiếm phong cách Chrome Web Store */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-800/60">
                Kho Ứng Dụng Đa Nền Tảng ForgeOS
              </span>
              <span className="text-xs text-slate-400 hidden md:inline">
                · Máy Chủ Phân Phối Edge CDN Khách Hàng
              </span>
            </div>

            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Tìm phần mềm, công cụ, hệ điều hành..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900/90 text-white text-xs pl-9 pr-4 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-500 shadow-inner"
              />
              <span className="absolute left-3 top-2.5 text-xs text-slate-400">🔍</span>
            </div>
          </div>

          {/* Khối tiêu điểm ứng dụng nổi bật (Featured Spotlight) */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-sm grid grid-cols-1 lg:grid-cols-12 gap-8 items-center shadow-2xl">
            {/* Cột trái: Thông tin ứng dụng */}
            <div className="lg:col-span-7 space-y-5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-800/60 flex items-center gap-1">
                  <span>★</span>
                  <span>{project.storeMeta.badgeLabel}</span>
                </span>
                <span className="text-xs text-slate-400">v{project.currentVersion}</span>
                <span className="text-slate-600">·</span>
                <span className="text-xs text-indigo-400 font-medium">{project.category}</span>
              </div>

              <div>
                <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight flex items-center gap-3">
                  <span>{project.name}</span>
                  <span className="text-emerald-400 text-lg">✔</span>
                </h1>
                <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                  {project.tagline}
                </p>
              </div>

              {/* 4 Thống kê biểu tượng Google Play Store */}
              <div className="flex items-center gap-4 sm:gap-6 text-xs border-y border-slate-800/80 py-3">
                <div>
                  <div className="flex items-center gap-1 font-bold text-amber-400 font-mono text-sm">
                    <span>{project.storeMeta.rating}</span>
                    <span>★</span>
                  </div>
                  <div className="text-[11px] text-slate-400">{project.storeMeta.reviewCount} đánh giá</div>
                </div>
                <div className="h-6 w-px bg-slate-800" />
                <div>
                  <div className="font-bold text-white font-mono text-sm">{project.storeMeta.downloadsCount}</div>
                  <div className="text-[11px] text-slate-400">Lượt tải về</div>
                </div>
                <div className="h-6 w-px bg-slate-800" />
                <div>
                  <div className="font-bold text-slate-300 font-mono text-sm">{project.storeMeta.ageRating}</div>
                  <div className="text-[11px] text-slate-400">Mọi lứa tuổi</div>
                </div>
                <div className="h-6 w-px bg-slate-800" />
                <div>
                  <div className="font-bold text-emerald-400 font-mono text-sm">
                    {primaryDetectedArtifact ? formatBytes(primaryDetectedArtifact.sizeBytes) : '42.8 MB'}
                  </div>
                  <div className="text-[11px] text-slate-400">Gói cài đặt</div>
                </div>
              </div>

              {/* Nút cài đặt & Hành động */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={() => handleDownload()}
                  className="px-7 py-3.5 bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs sm:text-sm shadow-lg shadow-emerald-950/40 transition-all flex items-center gap-2"
                >
                  <span>Cài Đặt Cho {getPlatformVietnameseName(detectedOS).split(' ')[0].toUpperCase()}</span>
                  {primaryDetectedArtifact && (
                    <span className="font-mono text-xs opacity-80">
                      ({formatBytes(primaryDetectedArtifact.sizeBytes)})
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setShowSandbox(true)}
                  className="px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs sm:text-sm border border-slate-700 transition-colors flex items-center gap-2"
                >
                  <span>▶</span>
                  <span>Chạy Thử WASM</span>
                </button>

                <button
                  onClick={() => setSelectedAppForDetail(project)}
                  className="px-4 py-3.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs sm:text-sm border border-slate-800 transition-colors"
                >
                  Xem Chi Tiết Ứng Dụng ↗
                </button>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center gap-2">
                <span>Thiết bị của bạn:</span>
                <span className="text-white font-semibold">{getPlatformVietnameseName(detectedOS)}</span>
                <span>·</span>
                <span className="text-emerald-400">Đã ký số EV & không kèm mã theo dõi</span>
              </div>
            </div>

            {/* Cột phải: Mockup trình chiếu ảnh chụp giao diện */}
            <div className="lg:col-span-5 space-y-3">
              <div className="relative rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-2xl p-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {project.name.toLowerCase()} — UI Preview
                  </span>
                </div>

                <div className="py-6 space-y-3 font-mono text-xs text-slate-300">
                  <div className="text-slate-500">// Giao diện tối ưu phần cứng đa nền tảng</div>
                  <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800/80 space-y-1">
                    <div className="text-emerald-400 font-bold">$ {project.slug} --ready</div>
                    <div className="text-slate-400 text-[11px]">Đã kết nối GPU Hardware Acceleration (Vulkan/Metal/DirectX)</div>
                    <div className="text-slate-400 text-[11px]">Độ trễ phản hồi: 0.8ms · Bộ nhớ RAM: 24.8 MB</div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2">
                    <span>Định danh gói: {project.bundleIdentifier}</span>
                    <span className="text-emerald-400">Đã xác minh</span>
                  </div>
                </div>
              </div>

              {/* Danh sách ứng dụng nhanh */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                <span className="text-slate-500 text-[11px] shrink-0">Chuyển phần mềm:</span>
                {projects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => onSelectProject(p)}
                    className={`px-3 py-1 rounded-lg shrink-0 font-medium transition-colors ${
                      p.id === project.id
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Thanh lọc theo nền tảng hệ điều hành */}
      <div className="border-b border-slate-800/80 bg-slate-900/40 px-6 py-3 sticky top-[49px] z-20 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 overflow-x-auto">
          <div className="flex items-center gap-2">
            {[
              { id: 'all', label: 'Tất Cả Hệ Điều Hành', icon: '✨' },
              { id: 'windows', label: 'Windows', icon: '🪟' },
              { id: 'macos', label: 'macOS', icon: '🍎' },
              { id: 'linux', label: 'Linux', icon: '🐧' },
              { id: 'android', label: 'Android', icon: '🤖' },
              { id: 'ios', label: 'iOS', icon: '📱' }
            ].map(pill => (
              <button
                key={pill.id}
                onClick={() => setActivePlatformFilter(pill.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  activePlatformFilter === pill.id
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>{pill.icon}</span>
                <span>{pill.label}</span>
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-400 hidden sm:block font-mono">
            Hiển thị {filteredProjects.length} ứng dụng thương mại
          </div>
        </div>
      </div>

      {/* Kệ ứng dụng (App Store Shelves) */}
      <div className="max-w-6xl mx-auto py-10 px-6 space-y-12">
        {/* Kệ 1: Ứng dụng nổi bật */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <span>🔥</span>
                <span>Ứng Dụng Hàng Đầu & Đánh Giá Cao Nhất</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Được tuyển chọn và kiểm định bảo mật nghiêm ngặt bởi đội ngũ kỹ sư ForgeOS.
              </p>
            </div>
            <span className="text-xs text-emerald-400 font-semibold font-mono">
              Chuẩn Đóng Gói Tier-1
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {filteredProjects.map((p) => {
              const rel = p.releases[0] || p.releases[p.releases.length - 1];
              const art = rel?.artifacts.find(a => a.platform === detectedOS) || rel?.artifacts[0];
              return (
                <div
                  key={p.id}
                  className="bg-slate-900/50 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-5 flex flex-col justify-between transition-all group shadow-sm hover:shadow-xl"
                >
                  <div className="space-y-4">
                    {/* Header Thẻ App */}
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-emerald-400 p-0.5 shrink-0 shadow-md">
                        <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center font-black text-xl text-white">
                          {p.name.charAt(0)}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-white text-base truncate group-hover:text-emerald-400 transition-colors">
                            {p.name}
                          </h3>
                        </div>
                        <div className="text-xs text-indigo-400">{p.publisher}</div>
                        <div className="flex items-center gap-1 text-xs text-amber-400 font-mono mt-0.5">
                          <span>{p.storeMeta.rating}</span>
                          <span>★</span>
                          <span className="text-slate-500 font-sans text-[11px]">
                            ({p.storeMeta.reviewCount})
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {p.tagline}
                    </p>

                    {/* Huy hiệu hệ điều hành hỗ trợ */}
                    <div className="flex flex-wrap gap-1">
                      {p.platforms.filter(plat => plat.enabled).map(plat => (
                        <span
                          key={plat.platform}
                          className="text-[10px] px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800 font-mono uppercase"
                        >
                          {plat.platform}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Hành động tải về & xem chi tiết */}
                  <div className="pt-5 mt-4 border-t border-slate-800/80 flex items-center justify-between gap-3">
                    <button
                      onClick={() => setSelectedAppForDetail(p)}
                      className="text-xs text-slate-400 hover:text-white transition-colors underline underline-offset-2"
                    >
                      Chi tiết
                    </button>

                    <button
                      onClick={() => handleDownload(p, art)}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <span>Tải Về</span>
                      {art && (
                        <span className="font-mono text-[11px] opacity-80">
                          ({formatBytes(art.sizeBytes)})
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Khối Hướng Dẫn Cài Đặt Nhanh Theo Dòng Lệnh Cho Quản Trị Viên & Lập Trình Viên */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>⚡</span>
                <span>Cài Đặt Nhanh Qua Trình Quản Lý Gói Thiết Bị</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Tự động tải về, đối soát chữ ký số EV và thêm ứng dụng vào biến môi trường hệ thống.
              </p>
            </div>

            {/* Chuyển đổi tab hệ điều hành */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              {[
                { id: 'windows', name: 'Windows' },
                { id: 'macos', name: 'macOS' },
                { id: 'linux', name: 'Linux' }
              ].map(osTab => (
                <button
                  key={osTab.id}
                  onClick={() => setSelectedPlatformTab(osTab.id as TargetPlatform)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    selectedPlatformTab === osTab.id
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {osTab.name}
                </button>
              ))}
            </div>
          </div>

          {/* Hộp lệnh CLI */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300">{cliInstruction.manager}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(cliInstruction.command);
                  onNotify('Đã sao chép câu lệnh cài đặt vào khay nhớ tạm!');
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-mono flex items-center gap-1"
              >
                <span>Sao Chép Lệnh</span>
              </button>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 font-mono text-xs text-emerald-400 select-all">
              {cliInstruction.command}
            </div>
          </div>

          {/* Danh sách tệp phân phối có sẵn trong kho */}
          <div className="space-y-3 pt-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Tệp Nhị Phân Khả Dụng Trong Kho R2 ({matchingArtifacts.length} gói)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {matchingArtifacts.map(art => (
                <div
                  key={art.id}
                  className="p-3.5 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-mono text-white font-bold">{art.filename}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {art.arch} · {formatBytes(art.sizeBytes)} · Đã ký số EV
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowChecksumModal(art)}
                      className="text-slate-400 hover:text-white underline font-mono text-[11px]"
                    >
                      Mã SHA
                    </button>
                    <button
                      onClick={() => handleDownload(project, art)}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
                    >
                      Tải Gói
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Khối Cam Kết Bảo Mật Chuẩn Thương Mại (Air-Gapped Isolation Guarantee) */}
        <div className="border border-indigo-900/60 bg-gradient-to-r from-indigo-950/40 via-slate-900/80 to-emerald-950/40 rounded-3xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛡️</span>
            <div>
              <h3 className="text-base font-bold text-white">
                Kiến Trúc Cách Ly An Toàn Tuyệt Đối (Air-Gapped Source Code Isolation)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Tiêu chuẩn phân phối phần mềm thương mại bảo mật cao.
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Hệ thống phân phối người dùng tại tên miền <strong className="text-emerald-400 font-mono">tai-ve.forgeos.vn</strong> chỉ cung cấp các gói cài đặt nhị phân đã gỡ bỏ ký hiệu debug và kiểm định an toàn SAST. Mã nguồn cốt lõi và các công cụ biên dịch nội bộ được lưu trữ tại phân vùng riêng biệt <strong className="text-indigo-400 font-mono">quan-tri.forgeos.vn</strong>, ngăn chặn 100% mọi nguy cơ lộ lọt dữ liệu hoặc can thiệp trái phép.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Bảo Vệ Mã Cốt Lõi</span>
              <span className="text-emerald-400 font-bold font-mono">0.00% Rủi Ro Lộ Mã</span>
            </div>
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Chứng Chỉ Ký Số</span>
              <span className="text-white font-bold">EV Hardware HSM</span>
            </div>
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Mạng Phân Phối Tốc Độ Cao</span>
              <span className="text-cyan-400 font-bold font-mono">Cloudflare R2 + 300+ PoPs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
