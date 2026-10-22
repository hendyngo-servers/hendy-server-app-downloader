/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ProjectTemplate, PipelineStage } from '../../types/index.ts';

interface PipelineRunnerProps {
  project: ProjectTemplate;
  onNotify: (msg: string) => void;
}

export const PipelineRunner: React.FC<PipelineRunnerProps> = ({
  project,
  onNotify
}) => {
  const [activeStageId, setActiveStageId] = useState<string>('stage-compile');
  const [isRunningAll, setIsRunningAll] = useState<boolean>(false);
  const [stages, setStages] = useState<PipelineStage[]>([
    {
      id: 'stage-lint',
      name: '1. Kiểm Định Cú Pháp & SAST',
      status: 'success',
      durationMs: 420,
      logs: [
        '[00:00.012] Khởi chạy cargo clippy --all-targets -- -D warnings',
        '[00:00.180] Đang kiểm tra 48 phụ thuộc thư viện an toàn bộ nhớ',
        '[00:00.390] SAST Security Scan: 0 phát hiện nghiêm trọng, 0 mã độc',
        '[00:00.420] Hoàn tất kiểm tra cú pháp thành công với mã thoát 0'
      ]
    },
    {
      id: 'stage-test',
      name: '2. Kiểm Thử Đơn Vị (Unit Tests)',
      status: 'success',
      durationMs: 860,
      logs: [
        '[00:00.005] Khởi chạy 15 kịch bản kiểm thử đơn vị node:test & cargo test',
        '[00:00.240] test packaging::ev_code_signing_verification ... ok',
        '[00:00.410] test workers_pages::domain_routing_isolation ... ok',
        '[00:00.620] test security::zero_source_code_leakage ... ok',
        '[00:00.860] Kết quả: 15/15 kịch bản vượt qua (100% tỷ lệ thành công)'
      ]
    },
    {
      id: 'stage-compile',
      name: '3. Biên Dịch Đa Nền Tảng (Cross-Compile)',
      status: 'success',
      durationMs: 3420,
      logs: [
        `[00:00.010] Khởi tạo môi trường biên dịch cho ${project.name}`,
        '[00:00.510] Target x86_64-pc-windows-msvc: Build hoàn tất (hyperterminal.exe)',
        '[00:01.210] Target aarch64-apple-darwin: Build hoàn tất Universal Binary',
        '[00:02.100] Target x86_64-unknown-linux-gnu: Build hoàn tất AppImage & Deb',
        '[00:02.890] Target aarch64-linux-android: Build APK thành công',
        '[00:03.420] Mã thoát 0. Tất cả các tệp nhị phân đã biên dịch hợp lệ'
      ]
    },
    {
      id: 'stage-strip-sign',
      name: '4. Gỡ Bỏ Ký Hiệu & Ký Số EV',
      status: 'success',
      durationMs: 1250,
      logs: [
        '[00:00.015] Kích hoạt llvm-strip --strip-all trên toàn bộ binaries',
        '[00:00.430] Đã loại bỏ 100% debug symbols, đường dẫn tuyệt đối nội bộ',
        '[00:00.820] Áp dụng chứng chỉ EV Code Signing: CN=ForgeOS Commercial Authority',
        '[00:01.050] Xác thực dấu thời gian RFC-3161 Timestamping thành công',
        '[00:01.250] Dấu vân tay SHA-256 đã đóng dấu bảo vệ chống can thiệp'
      ]
    },
    {
      id: 'stage-upload-r2',
      name: '5. Phân Phối Kho R2 Chuyên Biệt',
      status: 'success',
      durationMs: 1890,
      logs: [
        '[00:00.020] Kết nối Dedicated Storage: r2.cloudflarestorage.com/forgeos-binaries',
        '[00:00.540] Đẩy tệp hyperterminal-v2.4.0-win-x64.exe (42.8 MB) -> R2 (ETag: 71c9449a)',
        '[00:01.120] Đẩy tệp hyperterminal-v2.4.0-mac-universal.dmg (58.4 MB) -> R2',
        '[00:01.650] Đẩy tệp hyperterminal-v2.4.0-linux-x86_64.AppImage (46.1 MB) -> R2',
        '[00:01.890] Lưu trữ kho nhị phân an toàn, khóa quyền truy cập trực tiếp'
      ]
    },
    {
      id: 'stage-edge-purge',
      name: '6. Đồng Bộ & Làm Mới Edge CDN',
      status: 'success',
      durationMs: 310,
      logs: [
        '[00:00.008] Kích hoạt API Cloudflare Zone Cache Purge cho tai-ve.forgeos.vn',
        '[00:00.120] Đồng bộ siêu dữ liệu phát hành mới vào KV Namespace (FORGEOS_KV)',
        '[00:00.280] Triển khai thành công trên 300+ PoPs toàn cầu trong 310ms',
        '[00:00.310] Trạng thái: Sẵn sàng phục vụ người dùng cuối với độ trễ < 10ms'
      ]
    }
  ]);

  const activeStage = stages.find(s => s.id === activeStageId) || stages[0];

  const handleRunAll = () => {
    setIsRunningAll(true);
    onNotify('Đang khởi động luồng CI/CD tự động hóa 6 bước...');

    // Reset all to running sequentially
    setStages(prev => prev.map(s => ({ ...s, status: 'pending' })));

    let current = 0;
    const interval = setInterval(() => {
      if (current >= stages.length) {
        clearInterval(interval);
        setIsRunningAll(false);
        onNotify('Luồng CI/CD hoàn tất xuất sắc: Đã đóng gói, ký số và phát hành thành công!');
        return;
      }

      const stageIndex = current;
      setStages(prev =>
        prev.map((s, idx) => {
          if (idx === stageIndex) return { ...s, status: 'running' };
          if (idx < stageIndex) return { ...s, status: 'success' };
          return s;
        })
      );
      setActiveStageId(stages[stageIndex].id);

      setTimeout(() => {
        setStages(prev =>
          prev.map((s, idx) => (idx === stageIndex ? { ...s, status: 'success' } : s))
        );
      }, 500);

      current++;
    }, 700);
  };

  const handleRerunStage = (stageId: string) => {
    setStages(prev =>
      prev.map(s => (s.id === stageId ? { ...s, status: 'running' } : s))
    );
    setTimeout(() => {
      setStages(prev =>
        prev.map(s => (s.id === stageId ? { ...s, status: 'success' } : s))
      );
      onNotify(`Giai đoạn "${stages.find(s => s.id === stageId)?.name}" đã được chạy lại thành công!`);
    }, 800);
  };

  return (
    <div className="flex-1 bg-slate-950 p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Tiêu đề & Nút kích hoạt */}
        <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <span className="text-indigo-400">⚡</span>
              <span>Luồng Tự Động Hóa CI/CD & Đóng Gói Toàn Diện</span>
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Quy trình 6 bước tự động: Quét cú pháp, kiểm thử, biên dịch đa mục tiêu, ký số EV, tải kho R2 và xóa cache CDN.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleRerunStage(activeStageId)}
              disabled={isRunningAll}
              className="px-3.5 py-2 text-xs font-semibold text-slate-300 bg-slate-900 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Chạy Lại Bước Này
            </button>
            <button
              onClick={handleRunAll}
              disabled={isRunningAll}
              className={`px-4 py-2 text-xs font-semibold text-white rounded-lg shadow-sm flex items-center gap-2 transition-colors ${
                isRunningAll
                  ? 'bg-indigo-900/60 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700'
              }`}
            >
              {isRunningAll ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Đang Thực Thi Pipeline...</span>
                </>
              ) : (
                <>
                  <span>▶</span>
                  <span>Khởi Chạy Toàn Bộ Pipeline</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Thanh trạng thái các bước (Stepper) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {stages.map((stage, idx) => {
            const isSelected = stage.id === activeStageId;
            return (
              <button
                key={stage.id}
                onClick={() => setActiveStageId(stage.id)}
                className={`p-3 rounded-xl border text-left transition-all relative ${
                  isSelected
                    ? 'bg-slate-900 border-indigo-500 shadow-md ring-1 ring-indigo-500/50'
                    : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/70'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono text-slate-400">Bước 0{idx + 1}</span>
                  {stage.status === 'success' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 ring-4 ring-emerald-500/20" />
                  )}
                  {stage.status === 'running' && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  )}
                  {stage.status === 'pending' && (
                    <span className="w-2 h-2 rounded-full bg-slate-600" />
                  )}
                </div>
                <div className="text-xs font-semibold text-white truncate">
                  {stage.name.split('. ')[1]}
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-1">
                  {stage.durationMs}ms
                </div>
              </button>
            );
          })}
        </div>

        {/* Bảng điều khiển chi tiết bước đang chọn */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-sm text-white">{activeStage.name}</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                  activeStage.status === 'success'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/80'
                    : activeStage.status === 'running'
                    ? 'bg-amber-950 text-amber-400 border border-amber-800/80'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {activeStage.status === 'success'
                  ? 'Hoàn Tất'
                  : activeStage.status === 'running'
                  ? 'Đang Chạy'
                  : 'Chờ'}
              </span>
            </div>

            <div className="text-xs font-mono text-slate-400">
              Thời gian xử lý: <strong className="text-white">{activeStage.durationMs}ms</strong>
            </div>
          </div>

          {/* Cửa sổ nhật ký Terminal Live */}
          <div className="p-4 bg-slate-950 font-mono text-xs leading-relaxed overflow-x-auto min-h-[220px]">
            <div className="text-slate-500 mb-2">
              # Bắt đầu nhật ký thực thi giai đoạn: {activeStage.id} ({project.name} v{project.currentVersion})
            </div>
            {activeStage.logs.map((log, lIdx) => (
              <div key={lIdx} className="text-slate-300 py-0.5 hover:bg-slate-900/60 px-1 rounded flex items-center gap-2">
                <span className="text-indigo-400 select-none">➜</span>
                <span>{log}</span>
              </div>
            ))}
            {activeStage.status === 'running' && (
              <div className="text-amber-400 py-1 flex items-center gap-2 animate-pulse">
                <span>➜</span>
                <span>[Đang xử lý gói dữ liệu và xác minh tính toàn vẹn...]</span>
              </div>
            )}
            <div className="text-emerald-400 mt-2">
              ✔ Trạng thái bước: Thành công (Zero Warning, Mã bảo mật đã niêm phong)
            </div>
          </div>
        </div>

        {/* Khối tóm tắt hạ tầng đóng gói */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl">
            <div className="text-xs text-slate-400 font-medium">Hạ Tầng Biên Dịch</div>
            <div className="text-base font-bold text-white mt-1">Docker Multi-Arch Matrix</div>
            <div className="text-xs text-slate-500 mt-1">Cấu hình: Linux/AMD64, Linux/ARM64, macOS SDK, MSVC Toolchain</div>
          </div>
          <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl">
            <div className="text-xs text-slate-400 font-medium">Chứng Chỉ Ký Số</div>
            <div className="text-base font-bold text-emerald-400 mt-1">EV Code Signing (HSM)</div>
            <div className="text-xs text-slate-500 mt-1">Cấp bởi: DigiCert Trusted G4 / ForgeOS Enterprise CA</div>
          </div>
          <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl">
            <div className="text-xs text-slate-400 font-medium">Kho Lưu Trữ Nhị Phân</div>
            <div className="text-base font-bold text-indigo-400 mt-1">Cloudflare R2 Bucket</div>
            <div className="text-xs text-slate-500 mt-1">0đ phí Egress, mã hóa tại chỗ AES-256 server-side</div>
          </div>
        </div>
      </div>
    </div>
  );
};
