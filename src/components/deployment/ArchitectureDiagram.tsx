/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';

interface NodeDetail {
  title: string;
  type: string;
  description: string;
  specs: string[];
}

export const ArchitectureDiagram: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<string>('worker-studio');

  const nodeDetails: Record<string, NodeDetail> = {
    'dns-gateway': {
      title: 'Mạng Biên Anycast & Định Tuyến Tên Miền Qua API (Cloudflare Edge DNS)',
      type: 'Cổng Định Tuyến & Điều Phối Lưu Lượng',
      description: 'Định tuyến lưu lượng qua các tên miền phụ cách ly hoàn toàn, mã hóa SSL/TLS tự động và chống tấn công DDoS.',
      specs: [
        'Định tuyến Anycast toàn cầu trên 330+ trung tâm dữ liệu',
        'CNAME quan-tri.domain.com -> Phân vùng Worker Quản trị',
        'CNAME tai-ve.domain.com -> Phân vùng Pages Người dùng',
        'Chính sách xác thực Token Zero-Trust bảo vệ khu vực quản trị'
      ]
    },
    'worker-studio': {
      title: 'Giao Diện Quản Trị, Bảo Trì & Phát Triển (Cloudflare Worker)',
      type: 'Động Cơ Tính Toán Mạng Biên Edge Compute',
      description: 'Phân vùng nội bộ dành cho kỹ sư quản trị: biên dịch mã nguồn, kiểm tra cú pháp, đóng gói đa nền tảng và điều khiển API tên miền.',
      specs: [
        'Cô lập nghiêm ngặt tại subdomain quản trị (quan-tri.domain.com)',
        'Bảo mật mã nguồn cốt lõi bằng chuẩn mã hóa AES-256-GCM',
        'Quản lý ma trận biên dịch đa hệ điều hành và gắn tem thời gian ký số',
        'Truy xuất trực tiếp KV và R2 để xuất bản tệp phát hành'
      ]
    },
    'pages-portal': {
      title: 'Trang Chủ Người Dùng Tải Phần Mềm (Cloudflare Pages)',
      type: 'Phân Phối Toàn Cầu & Trải Nghiệm Khách Hàng',
      description: 'Giao diện công khai tốc độ cao: tự động nhận diện hệ điều hành của người dùng, tải về 1-chạm và chạy thử WebAssembly.',
      specs: [
        'Ánh xạ tên miền tải về công khai (tai-ve.domain.com)',
        'Cổng API Functions (/functions/api/[[route]].ts) bảo vệ',
        'Tuyệt đối không nhúng bất kỳ mã nguồn cốt lõi hay token bảo mật nào',
        'Mạng đệm cạnh toàn cầu với tính sẵn sàng 99.99%'
      ]
    },
    'kv-storage': {
      title: 'Bộ Nhớ Đệm KV: Siêu Dữ Liệu & Bảng Định Tuyến API',
      type: 'Kho Khóa-Giá Trị Độ Trễ Cực Thấp',
      description: 'Lưu trữ thông tin phiên bản phát hành, mã băm SHA-256 và cấu hình định tuyến tên miền động.',
      specs: [
        'Khai báo binding: RELEASE_KV',
        'Độ trễ đọc dưới 1 mili-giây tại mọi vị trí mạng biên',
        'Tự động đồng bộ hóa toàn cầu ngay khi xuất bản'
      ]
    },
    'r2-bucket': {
      title: 'Hạ Tầng Lưu Trữ Chuyên Biệt R2 (Tệp Nhị Phân Phát Hành)',
      type: 'Kho Đối Tượng Độc Lập Không Phí Băng Thông',
      description: 'Lưu trữ các tệp cài đặt nhị phân thương mại (.exe, .msi, .dmg, .pkg, .AppImage, .deb, .apk) tách biệt hoàn toàn với mã nguồn.',
      specs: [
        'Khai báo binding: RELEASE_STORAGE',
        'Phân phối truyền tải nhị phân trực tiếp cho người dùng qua HTTP chunking',
        'Khóa tệp bất biến (Immutable ETag) và tiêu đề bảo mật'
      ]
    },
    'github-runners': {
      title: 'Ma Trận CI/CD GitHub Actions Đa Hệ Điều Hành',
      type: 'Máy Chủ Biên Dịch Tự Động',
      description: 'Biên dịch nhị phân tự động từ xa trên môi trường Windows, macOS và Linux chính thống, gỡ bỏ debug symbols trước khi đóng gói.',
      specs: [
        'Runner windows-latest (x86_64 MSVC + WiX Installer)',
        'Runner macos-14 (Apple Silicon M-Series + Notarization)',
        'Runner ubuntu-22.04 (GNU Toolchain + Bộ công cụ AppImage)'
      ]
    }
  };

  const activeDetail = nodeDetails[selectedNode] || nodeDetails['worker-studio'];

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-base font-bold text-white">
            Sơ Đồ Kiến Trúc Hệ Thống: Cloudflare Workers & Pages
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Mô hình cách ly tuyệt đối giữa Giao diện Quản trị và Trang chủ Tải về của Người dùng. Nhấp vào từng khối để xem chi tiết.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span>Trạng Thái Kiến Trúc: Đạt Chuẩn Thương Mại</span>
        </div>
      </div>

      {/* Sơ đồ trực quan */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-6 overflow-x-auto">
        <div className="min-w-[700px] flex flex-col items-center gap-6">
          {/* Tầng 1: Mạng Anycast DNS */}
          <div
            onClick={() => setSelectedNode('dns-gateway')}
            className={`w-96 p-3 rounded-lg border text-center cursor-pointer transition-all ${
              selectedNode === 'dns-gateway'
                ? 'border-indigo-400 bg-indigo-950/40 ring-1 ring-indigo-400/50'
                : 'border-slate-700 bg-slate-900/80 hover:border-slate-600'
            }`}
          >
            <div className="text-xs font-bold text-white uppercase tracking-wider">
              Mạng Biên Anycast DNS & Định Tuyến API
            </div>
            <div className="text-[11px] font-mono text-indigo-300 mt-1">
              quan-tri.domain.vn &lt;--&gt; tai-ve.domain.vn
            </div>
          </div>

          {/* Đường dẫn phân luồng */}
          <div className="flex items-center justify-between w-[520px] text-[11px] text-slate-500 font-mono">
            <span>↓ Phân vùng Quản trị (Token Auth)</span>
            <span>↓ Phân vùng Người dùng (Edge CDN)</span>
          </div>

          {/* Tầng 2: Hai giao diện tách biệt hoàn toàn */}
          <div className="flex items-stretch justify-center gap-8 w-full max-w-[680px]">
            {/* Giao diện quản trị */}
            <div
              onClick={() => setSelectedNode('worker-studio')}
              className={`flex-1 p-4 rounded-lg border cursor-pointer transition-all ${
                selectedNode === 'worker-studio'
                  ? 'border-indigo-400 bg-indigo-950/40 ring-1 ring-indigo-400/50'
                  : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-indigo-300">GIAO DIỆN QUẢN TRỊ</span>
                <span className="text-[10px] font-mono bg-indigo-900/60 text-indigo-200 px-1.5 py-0.5 rounded">
                  Worker
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Phát triển, bảo trì, đóng gói đa nền tảng, quản lý API định tuyến tên miền.
              </p>
              <div className="mt-2 text-[10px] text-slate-500 font-mono">
                Tên miền: quan-tri.forgeos.vn
              </div>
            </div>

            {/* Trang chủ tải về người dùng */}
            <div
              onClick={() => setSelectedNode('pages-portal')}
              className={`flex-1 p-4 rounded-lg border cursor-pointer transition-all ${
                selectedNode === 'pages-portal'
                  ? 'border-emerald-400 bg-emerald-950/40 ring-1 ring-emerald-400/50'
                  : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-emerald-300">TRANG CHỦ TẢI VỀ</span>
                <span className="text-[10px] font-mono bg-emerald-900/60 text-emerald-200 px-1.5 py-0.5 rounded">
                  Pages
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Nhận diện HĐH tự động, tải gói nhị phân, chạy thử WebAssembly an toàn.
              </p>
              <div className="mt-2 text-[10px] text-slate-500 font-mono">
                Tên miền: tai-ve.forgeos.vn
              </div>
            </div>
          </div>

          {/* Đường dẫn xuống kho lưu trữ */}
          <div className="w-px h-6 bg-slate-700" />

          {/* Tầng 3: Hạ tầng lưu trữ chuyên biệt & CI/CD */}
          <div className="flex items-stretch justify-center gap-6 w-full max-w-[680px]">
            {/* KV Cache */}
            <div
              onClick={() => setSelectedNode('kv-storage')}
              className={`flex-1 p-3 rounded-lg border cursor-pointer transition-all ${
                selectedNode === 'kv-storage'
                  ? 'border-amber-400 bg-amber-950/40'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              <div className="text-xs font-bold text-amber-300 mb-1">BỘ NHỚ ĐỆM KV</div>
              <div className="text-[11px] text-slate-400">Bảng định tuyến & Siêu dữ liệu</div>
            </div>

            {/* R2 Storage */}
            <div
              onClick={() => setSelectedNode('r2-bucket')}
              className={`flex-1 p-3 rounded-lg border cursor-pointer transition-all ${
                selectedNode === 'r2-bucket'
                  ? 'border-sky-400 bg-sky-950/40'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              <div className="text-xs font-bold text-sky-300 mb-1">KHO CHUYÊN BIỆT R2</div>
              <div className="text-[11px] text-slate-400">Tệp nhị phân: .exe, .dmg, .AppImage</div>
            </div>

            {/* GitHub Actions */}
            <div
              onClick={() => setSelectedNode('github-runners')}
              className={`flex-1 p-3 rounded-lg border cursor-pointer transition-all ${
                selectedNode === 'github-runners'
                  ? 'border-purple-400 bg-purple-950/40'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              <div className="text-xs font-bold text-purple-300 mb-1">CI/CD GITHUB ACTIONS</div>
              <div className="text-[11px] text-slate-400">Biên dịch Win / Mac / Linux</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bảng chi tiết thành phần được chọn */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2">
          <div>
            <span className="text-xs font-bold text-white">{activeDetail.title}</span>
            <span className="text-slate-600 mx-2">·</span>
            <span className="text-[11px] text-indigo-400 font-mono">{activeDetail.type}</span>
          </div>
        </div>
        <p className="text-xs text-slate-300 mb-3">{activeDetail.description}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400 font-mono">
          {activeDetail.specs.map((spec, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-indigo-500 font-bold">-</span>
              <span>{spec}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
