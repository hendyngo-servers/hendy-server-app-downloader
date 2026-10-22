/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ProjectTemplate, TargetPlatform, BuildArtifact } from '../../types/index.ts';
import { formatBytes, getPlatformVietnameseName } from '../../utils/packaging.ts';

interface AppDetailModalProps {
  project: ProjectTemplate;
  isOpen: boolean;
  onClose: () => void;
  detectedOS: TargetPlatform;
  onDownload?: (artifact?: BuildArtifact) => void;
  onOpenSandbox: () => void;
  onNotify: (msg: string) => void;
}

export const AppDetailModal: React.FC<AppDetailModalProps> = ({
  project,
  isOpen,
  onClose,
  detectedOS,
  onOpenSandbox,
  onNotify
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<TargetPlatform>(detectedOS);
  const [activeTab, setActiveTab] = useState<'about' | 'safety' | 'reviews' | 'requirements'>('about');

  if (!isOpen) return null;

  const latestRelease = project.releases[0] || {
    version: project.currentVersion,
    title: 'Phát hành chính thức',
    releaseDate: 'Tháng 10, 2026',
    changelog: [],
    artifacts: []
  };

  const currentPlatformArtifacts = latestRelease.artifacts.filter(a => a.platform === selectedPlatform);
  const detectedArtifact = latestRelease.artifacts.find(a => a.platform === detectedOS) || latestRelease.artifacts[0];

  const meta = project.storeMeta;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Thanh tiêu đề modal & nút đóng */}
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded border border-emerald-800/60 font-semibold">
              {meta.badgeLabel}
            </span>
            <span className="text-xs text-slate-400">· Cửa Hàng Ứng Dụng ForgeOS Store</span>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-lg transition-colors"
          >
            ×
          </button>
        </div>

        {/* Thân modal cuộn được */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Header phong cách Google Play / App Store */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* App Icon */}
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-indigo-600 via-slate-800 to-emerald-500 p-0.5 shadow-xl shrink-0 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-3xl font-black text-white">
                {project.name.charAt(0)}
              </div>
            </div>

            {/* Thông tin chính của ứng dụng */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-extrabold text-white tracking-tight">{project.name}</h2>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/50">
                  <span>✔</span>
                  <span>Nhà phát triển đã xác minh</span>
                </span>
              </div>

              <div className="text-sm font-medium text-indigo-400">{project.publisher}</div>
              <p className="text-xs text-slate-300 leading-relaxed">{project.tagline}</p>
            </div>
          </div>

          {/* 4 Thẻ chỉ số chuẩn Google Play Store */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
            <div className="text-center p-2">
              <div className="flex items-center justify-center gap-1 text-sm font-bold text-amber-400 font-mono">
                <span>{meta.rating}</span>
                <span>★</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">{meta.reviewCount.toLocaleString('vi-VN')} đánh giá</div>
            </div>

            <div className="text-center p-2">
              <div className="text-sm font-bold text-white font-mono">{meta.downloadsCount}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Lượt tải xuống</div>
            </div>

            <div className="text-center p-2">
              <div className="text-sm font-bold text-slate-200">{meta.ageRating}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Phù hợp mọi lứa tuổi</div>
            </div>

            <div className="text-center p-2">
              <div className="text-sm font-bold text-emerald-400 font-mono">
                {detectedArtifact ? formatBytes(detectedArtifact.sizeBytes) : '42.8 MB'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Dung lượng cài đặt</div>
            </div>
          </div>

          {/* Nút hành động chính: TRỎ TRỰC TIẾP ĐẾN URL THỰC TẾ CỦA TỆP NHỊ PHÂN */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {detectedArtifact ? (
              <a
                href={detectedArtifact.downloadUrl || `/api/v1/downloads/artifacts/${detectedArtifact.filename}`}
                download={detectedArtifact.filename}
                onClick={() => onNotify(`Đang tải xuống ${detectedArtifact.filename} từ URL thực tế...`)}
                className="w-full sm:flex-1 py-3 px-6 bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 text-slate-950 font-bold rounded-xl text-sm shadow-lg shadow-emerald-950/30 transition-all flex items-center justify-center gap-2"
              >
                <span>Cài Đặt / Tải Về Cho {getPlatformVietnameseName(detectedOS).split(' ')[0].toUpperCase()}</span>
                <span className="font-mono text-xs opacity-80">({formatBytes(detectedArtifact.sizeBytes)})</span>
              </a>
            ) : (
              <button
                disabled
                className="w-full sm:flex-1 py-3 px-6 bg-slate-800 text-slate-400 font-bold rounded-xl text-sm"
              >
                Đang chuẩn bị gói cài đặt
              </button>
            )}

            <button
              onClick={onOpenSandbox}
              className="w-full sm:w-auto py-3 px-5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs border border-slate-700 transition-colors flex items-center justify-center gap-2"
            >
              <span>▶</span>
              <span>Chạy Thử Trực Tiếp (WASM)</span>
            </button>
          </div>

          {/* Thư viện ảnh chụp màn hình phong cách App Store */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Ảnh Chụp Màn Hình Ứng Dụng
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
              {meta.screenshots.map((s) => (
                <div
                  key={s.id}
                  className="w-64 sm:w-72 shrink-0 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-md"
                >
                  <div className="h-36 bg-gradient-to-br from-slate-900 to-slate-950 p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 uppercase">{s.mode}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="h-2 w-3/4 bg-slate-800 rounded" />
                      <div className="h-2 w-1/2 bg-slate-800 rounded" />
                      <div className="h-2 w-2/3 bg-slate-800 rounded" />
                    </div>

                    <div className="text-[11px] font-medium text-slate-300 font-mono">
                      {project.name} · v{project.currentVersion}
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-900/90 text-[11px] text-slate-400 truncate">
                    {s.caption}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Điều hướng các tab thông tin chi tiết */}
          <div className="border-b border-slate-800 flex items-center gap-6 text-xs font-semibold">
            {[
              { id: 'about', label: 'Về Ứng Dụng Này' },
              { id: 'safety', label: 'An Toàn Dữ Liệu' },
              { id: 'reviews', label: `Đánh Giá (${meta.reviews.length})` },
              { id: 'requirements', label: 'Yêu Cầu Hệ Thống' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-2.5 transition-colors ${
                  activeTab === tab.id
                    ? 'text-emerald-400 border-b-2 border-emerald-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Nội dung Tab 1: Về ứng dụng này */}
          {activeTab === 'about' && (
            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <p>{project.description}</p>

              <div className="space-y-2 pt-2">
                <div className="font-semibold text-white">Điểm Nổi Bật & Tính Năng Thương Mại:</div>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li>Biên dịch nhị phân bản địa (Native Binary) tối ưu 100% năng lượng và bộ nhớ.</li>
                  <li>Hỗ trợ xử lý đa nhân, phần cứng GPU tăng tốc không gián đoạn.</li>
                  <li>Mã nguồn được niêm phong phần cứng, không chứa trình theo dõi hoặc mã quảng cáo.</li>
                  <li>Cập nhật định kỳ qua mạng biên Cloudflare Global Edge CDN.</li>
                </ul>
              </div>

              {/* Tùy chọn tải về cho các nền tảng khác trỏ thẳng đến URL thực tế */}
              <div className="pt-4 border-t border-slate-800/80 space-y-3">
                <div className="font-semibold text-white">Tất Cả Gói Cài Đặt Theo Nền Tảng (URL Thực Tế):</div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {[
                    { id: 'windows', name: 'Windows' },
                    { id: 'macos', name: 'macOS' },
                    { id: 'linux', name: 'Linux' },
                    { id: 'android', name: 'Android' },
                    { id: 'ios', name: 'iOS' }
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPlatform(p.id as TargetPlatform)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                        selectedPlatform === p.id
                          ? 'bg-slate-800 text-white border border-slate-700'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  {currentPlatformArtifacts.map((art) => (
                    <div
                      key={art.id}
                      className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between"
                    >
                      <div>
                        <div className="font-mono text-white font-bold">{art.filename}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Kiến trúc: {art.arch} · {formatBytes(art.sizeBytes)} · Định dạng {art.format}
                        </div>
                      </div>
                      <a
                        href={art.downloadUrl || `/api/v1/downloads/artifacts/${art.filename}`}
                        download={art.filename}
                        onClick={() => onNotify(`Đang tải tệp ${art.filename}...`)}
                        className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1"
                      >
                        <span>⬇</span>
                        <span>Tải Tệp Thực</span>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Nội dung Tab 2: An Toàn Dữ Liệu (Chuẩn Google Play Store) */}
          {activeTab === 'safety' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-950/30 border border-emerald-900/50 rounded-2xl space-y-2">
                <div className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                  <span>🛡️</span>
                  <span>Cam Kết Minh Bạch Về An Toàn Dữ Liệu Của Nhà Phát Triển</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Tính an toàn bắt đầu từ sự hiểu biết về cách nhà phát triển thu thập và chia sẻ dữ liệu của bạn. Phần mềm này tuân thủ các quy định bảo mật khắt khe nhất của liên minh ForgeOS.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                  <div className="text-[11px] font-semibold text-slate-400">Dữ Liệu Thu Thập</div>
                  <div className="text-xs text-emerald-400 font-bold">{meta.dataSafety.collectedData}</div>
                  <div className="text-[11px] text-slate-500">Không theo dõi nhận dạng người dùng</div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                  <div className="text-[11px] font-semibold text-slate-400">Thực Hành Bảo Mật</div>
                  <div className="text-xs text-emerald-400 font-bold">{meta.dataSafety.securityPractice}</div>
                  <div className="text-[11px] text-slate-500">Đạt chứng chỉ EV Code Signing</div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                  <div className="text-[11px] font-semibold text-slate-400">Chuẩn Mã Hóa</div>
                  <div className="text-xs text-indigo-400 font-bold">{meta.dataSafety.encryptionStandard}</div>
                  <div className="text-[11px] text-slate-500">Mã hóa đầu cuối toàn trình</div>
                </div>
              </div>
            </div>
          )}

          {/* Nội dung Tab 3: Đánh giá & Nhận xét của người dùng */}
          {activeTab === 'reviews' && (
            <div className="space-y-4">
              <div className="flex items-center gap-6 p-4 bg-slate-950 rounded-2xl border border-slate-800">
                <div className="text-center">
                  <div className="text-4xl font-extrabold text-white font-mono">{meta.rating}</div>
                  <div className="text-amber-400 text-sm mt-0.5">★★★★★</div>
                  <div className="text-[11px] text-slate-500 mt-1">{meta.reviewCount} đánh giá</div>
                </div>

                <div className="flex-1 space-y-1 text-xs">
                  {[
                    { stars: 5, pct: '92%' },
                    { stars: 4, pct: '6%' },
                    { stars: 3, pct: '2%' },
                    { stars: 2, pct: '0%' },
                    { stars: 1, pct: '0%' }
                  ].map((row) => (
                    <div key={row.stars} className="flex items-center gap-2">
                      <span className="font-mono text-slate-400 w-3">{row.stars}</span>
                      <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: row.pct }} />
                      </div>
                      <span className="font-mono text-slate-500 text-[10px] w-7">{row.pct}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {meta.reviews.map((rev) => (
                  <div key={rev.id} className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{rev.author}</span>
                        {rev.verifiedInstall && (
                          <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/50">
                            Đã cài đặt thực tế
                          </span>
                        )}
                      </div>
                      <span className="text-slate-500 font-mono text-[11px]">{rev.date}</span>
                    </div>
                    <div className="text-amber-400 text-xs">{'★'.repeat(rev.rating)}</div>
                    <p className="text-xs text-slate-300 leading-relaxed">{rev.comment}</p>
                    <div className="text-[11px] text-slate-500">Nền tảng: {rev.platform}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nội dung Tab 4: Yêu Cầu Hệ Thống */}
          {activeTab === 'requirements' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <div className="text-slate-500 font-medium">Hệ Điều Hành Tối Thiểu</div>
                <div className="text-white font-bold">{meta.systemRequirements.minOs}</div>
              </div>

              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <div className="text-slate-500 font-medium">Bộ Nhớ RAM Khuyến Nghị</div>
                <div className="text-white font-bold">{meta.systemRequirements.recommendedRam}</div>
              </div>

              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <div className="text-slate-500 font-medium">Dung Lượng Ổ Cứng Khả Dụng</div>
                <div className="text-white font-bold">{meta.systemRequirements.diskSpace}</div>
              </div>

              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                <div className="text-slate-500 font-medium">Xử Lý Đồ Họa (GPU)</div>
                <div className="text-white font-bold">{meta.systemRequirements.gpuReq}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
