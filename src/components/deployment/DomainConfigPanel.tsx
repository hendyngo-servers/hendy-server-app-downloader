/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CloudflareWorkersPagesConfig } from '../../types/index.ts';

interface DomainConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  config: CloudflareWorkersPagesConfig;
  onUpdateConfig: (newConfig: CloudflareWorkersPagesConfig) => void;
  onNotify: (msg: string) => void;
}

export const DomainConfigPanel: React.FC<DomainConfigPanelProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  onNotify
}) => {
  const [baseDomain, setBaseDomain] = useState(config.routes[0]?.domain || 'forgeos.vn');
  const [studioSub, setStudioSub] = useState(config.routes[0]?.subdomain || 'quan-tri');
  const [downloadSub, setDownloadSub] = useState(config.routes[1]?.subdomain || 'tai-ve');
  const [isApiSaving, setIsApiSaving] = useState(false);

  if (!isOpen) return null;

  const handleSaveDomain = (e: React.FormEvent) => {
    e.preventDefault();
    setIsApiSaving(true);
    const cleanDomain = baseDomain.trim().toLowerCase().replace(/^https?:\/\//, '');

    setTimeout(() => {
      const updatedRoutes = [
        {
          ...config.routes[0],
          domain: cleanDomain,
          subdomain: studioSub.trim().toLowerCase()
        },
        {
          ...config.routes[1],
          domain: cleanDomain,
          subdomain: downloadSub.trim().toLowerCase()
        }
      ];

      onUpdateConfig({
        ...config,
        routes: updatedRoutes,
        workersRoute: `${studioSub.trim()}.${cleanDomain}/*`
      });

      setIsApiSaving(false);
      onNotify(`Đã cập nhật định tuyến tên miền qua API thành công! Phân vùng Quản trị (${studioSub}.${cleanDomain}) và Tải về (${downloadSub}.${cleanDomain}) được cô lập an toàn.`);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white">
              Quản Lý Định Tuyến Tên Miền Qua API (Domain Routing API)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Ánh xạ tên miền hiện có để phân chia truy cập riêng biệt giữa Giao diện Quản trị và Trang chủ Tải về.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg font-mono px-2"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSaveDomain} className="space-y-5">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Tên Miền Doanh Nghiệp Hiện Có (Registered Domain)
            </label>
            <input
              type="text"
              value={baseDomain}
              onChange={(e) => setBaseDomain(e.target.value)}
              placeholder="Ví dụ: doanhnghiep.vn"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Hệ thống sử dụng API Endpoint <code className="text-indigo-400">{config.apiEndpoint}</code> để tự động cấu hình bản ghi DNS và chứng chỉ SSL/TLS.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Phân vùng Quản trị */}
            <div className="bg-slate-950 border border-indigo-900/40 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-400 uppercase">
                  1. Giao Diện Quản Trị & Phát Triển
                </span>
                <span className="text-[10px] bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded font-mono">
                  Cloudflare Worker
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Khu vực nội bộ: Quản lý mã nguồn, đóng gói đa nền tảng và kiểm định ký số.
              </p>
              <div className="pt-1">
                <label className="text-[11px] text-slate-500 block mb-1">Tiền tố Subdomain:</label>
                <div className="flex items-center bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white font-mono">
                  <input
                    type="text"
                    value={studioSub}
                    onChange={(e) => setStudioSub(e.target.value)}
                    className="bg-transparent border-none outline-none w-20 text-indigo-300 font-semibold"
                  />
                  <span className="text-slate-500">.{baseDomain}</span>
                </div>
              </div>
            </div>

            {/* Phân vùng Người dùng */}
            <div className="bg-slate-950 border border-emerald-900/40 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 uppercase">
                  2. Trang Chủ Người Dùng Tải Về
                </span>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                  Cloudflare Pages
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Khu vực công khai: Tự động nhận diện HĐH, tải ứng dụng và chạy thử WebAssembly.
              </p>
              <div className="pt-1">
                <label className="text-[11px] text-slate-500 block mb-1">Tiền tố Subdomain:</label>
                <div className="flex items-center bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white font-mono">
                  <input
                    type="text"
                    value={downloadSub}
                    onChange={(e) => setDownloadSub(e.target.value)}
                    className="bg-transparent border-none outline-none w-20 text-emerald-300 font-semibold"
                  />
                  <span className="text-slate-500">.{baseDomain}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bảng cấu hình bản ghi DNS */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
              Bản Ghi DNS Cần Thiết Lập Tại Nhà Đăng Ký Tên Miền
            </span>
            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950 font-mono text-[11px]">
              <table className="w-full text-left">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="py-2 px-3">Loại</th>
                    <th className="py-2 px-3">Tên Host</th>
                    <th className="py-2 px-3">Đích Bản Ghi (Value)</th>
                    <th className="py-2 px-3 text-right">Chứng Chỉ SSL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  <tr>
                    <td className="py-2 px-3 text-indigo-400 font-bold">CNAME</td>
                    <td className="py-2 px-3">{studioSub}</td>
                    <td className="py-2 px-3 text-slate-400">forgeos-admin.workers.dev</td>
                    <td className="py-2 px-3 text-right text-emerald-400">Tự Động (Bảo Vệ)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-emerald-400 font-bold">CNAME</td>
                    <td className="py-2 px-3">{downloadSub}</td>
                    <td className="py-2 px-3 text-slate-400">{config.pagesDomain}</td>
                    <td className="py-2 px-3 text-right text-emerald-400">Tự Động (Bảo Vệ)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isApiSaving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              {isApiSaving ? 'Đang cập nhật qua API...' : 'Lưu & Kích Hoạt Định Tuyến API'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
