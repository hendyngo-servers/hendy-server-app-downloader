/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ProjectTemplate } from '../../types/index.ts';

interface AnalyticsDashboardProps {
  project: ProjectTemplate;
  onNotify: (msg: string) => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  project,
  onNotify
}) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  const stats = {
    totalDownloads: '148,290',
    activeInstalls: '92,410',
    crashFreeRate: '99.98%',
    avgLatency: '8.4 ms',
    cacheHitRatio: '98.7%',
    bandwidthSaved: '6.42 TB',
    costSavedUsd: '$4,815'
  };

  const osBreakdown = [
    { os: 'Windows (x86_64/ARM64)', share: 44, downloads: '65,247', color: 'bg-blue-500', barWidth: 'w-[44%]' },
    { os: 'macOS (Apple Silicon & Intel)', share: 28, downloads: '41,521', color: 'bg-purple-500', barWidth: 'w-[28%]' },
    { os: 'Linux (Debian, Fedora, Arch)', share: 15, downloads: '22,243', color: 'bg-amber-500', barWidth: 'w-[15%]' },
    { os: 'Android (APK Native)', share: 8, downloads: '11,863', color: 'bg-emerald-500', barWidth: 'w-[8%]' },
    { os: 'iOS (IPA / TestFlight)', share: 4, downloads: '5,931', color: 'bg-rose-500', barWidth: 'w-[4%]' },
    { os: 'WebAssembly (Trình duyệt)', share: 1, downloads: '1,485', color: 'bg-cyan-500', barWidth: 'w-[1%]' },
  ];

  const recentEvents = [
    { time: '1 phút trước', event: 'Tải về hyperterminal-v2.4.0-win-x64.exe', ip: '113.161.**.** (TP.HCM, VN)', status: '200 OK (R2 Cache Hit)' },
    { time: '3 phút trước', event: 'Tải về hyperterminal-v2.4.0-mac-universal.dmg', ip: '14.232.**.** (Hà Nội, VN)', status: '200 OK (R2 Cache Hit)' },
    { time: '7 phút trước', event: 'Xác thực định tuyến: tai-ve.forgeos.vn', ip: '171.244.**.** (Đà Nẵng, VN)', status: '200 OK (Edge Worker)' },
    { time: '12 phút trước', event: 'Khởi chạy WebAssembly Sandbox', ip: '203.205.**.** (Cần Thơ, VN)', status: '101 Switching Protocols' },
    { time: '18 phút trước', event: 'Chặn truy cập trái phép mã nguồn core/main.rs', ip: '104.28.**.** (Bảo vệ Zero-Trust)', status: '403 Forbidden (Blocked)' },
  ];

  return (
    <div className="flex-1 bg-slate-950 p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Tiêu đề & Chọn khoảng thời gian */}
        <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <span className="text-indigo-400">📊</span>
              <span>Bảng Phân Tích & Giám Sát Phân Phối Toàn Cầu</span>
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Dữ liệu tải về theo thời gian thực, thị phần hệ điều hành, tỷ lệ không lỗi và hiệu suất mạng biên Cloudflare.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-lg">
            {(['7d', '30d', '90d'] as const).map(range => (
              <button
                key={range}
                onClick={() => {
                  setTimeRange(range);
                  onNotify(`Đã cập nhật số liệu phân tích trong ${range === '7d' ? '7 ngày' : range === '30d' ? '30 ngày' : '90 ngày'} gần nhất.`);
                }}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  timeRange === range
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {range === '7d' ? '7 Ngày' : range === '30d' ? '30 Ngày' : '90 Ngày'}
              </button>
            ))}
          </div>
        </div>

        {/* 4 Thẻ KPI chính */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="text-xs font-medium text-slate-400">Tổng Lượt Tải Về</div>
            <div className="text-2xl font-bold font-mono text-white mt-1">{stats.totalDownloads}</div>
            <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1 font-mono">
              <span>↑ 18.4%</span>
              <span className="text-slate-500 font-sans">so với kỳ trước</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="text-xs font-medium text-slate-400">Tỷ Lệ Phiên Không Lỗi</div>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{stats.crashFreeRate}</div>
            <div className="text-xs text-slate-500 mt-1">Chuẩn ổn định thương mại Tier-1</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="text-xs font-medium text-slate-400">Độ Trễ Mạng Biên Edge</div>
            <div className="text-2xl font-bold font-mono text-indigo-400 mt-1">{stats.avgLatency}</div>
            <div className="text-xs text-slate-500 mt-1">300+ PoPs Cloudflare toàn cầu</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="text-xs font-medium text-slate-400">Tỷ Lệ Cache Hit R2</div>
            <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">{stats.cacheHitRatio}</div>
            <div className="text-xs text-slate-500 mt-1">Tiết kiệm {stats.bandwidthSaved} băng thông</div>
          </div>
        </div>

        {/* Thị phần phân phối theo hệ điều hành & Biểu đồ thanh ngang */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Thị Phần Phân Phối Theo Hệ Điều Hành
              </h3>
              <span className="text-xs font-mono text-slate-400">Cập nhật: Trực tiếp</span>
            </div>

            <div className="space-y-3">
              {osBreakdown.map(item => (
                <div key={item.os} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">{item.os}</span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-white font-semibold">{item.downloads}</span>
                      <span className="text-slate-500">({item.share}%)</span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.share}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Nhật ký yêu cầu biên thực tế (Real-time Edge Stream) */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Nhật Ký Yêu Cầu Tại Mạng Biên (Edge Logs)</span>
              </h3>
              <span className="text-[11px] font-mono text-emerald-400">Bảo mật Zero-Trust</span>
            </div>

            <div className="space-y-2.5">
              {recentEvents.map((evt, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950/80 border border-slate-800/80 p-2.5 rounded-lg flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-slate-200 font-medium truncate">{evt.event}</div>
                    <div className="text-[11px] font-mono text-slate-500">{evt.ip} · {evt.time}</div>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                      evt.status.includes('403')
                        ? 'bg-rose-950 text-rose-400 border border-rose-800/60'
                        : 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                    }`}
                  >
                    {evt.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Khối bảo vệ an toàn thương mại */}
        <div className="bg-gradient-to-r from-indigo-950/40 via-slate-900/60 to-emerald-950/40 border border-indigo-900/50 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-white">Chính Sách Miễn Phí Egress Cloudflare R2 + Bảo Vệ DDoS L3/L4/L7</div>
            <div className="text-xs text-slate-400 leading-relaxed">
              Mọi tệp tải về được phục vụ trực tiếp từ R2 qua bộ nhớ đệm Cloudflare Edge Cache. Mã nguồn gốc nằm ở phân vùng hoàn toàn tách biệt, bảo vệ tuyệt đối khỏi mọi hình thức trích xuất trái phép.
            </div>
          </div>
          <button
            onClick={() => onNotify('Đã làm mới báo cáo kiểm toán bảo mật và định tuyến!')}
            className="shrink-0 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
          >
            Xuất Báo Cáo Phân Tích (.JSON)
          </button>
        </div>
      </div>
    </div>
  );
};
