/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TargetPlatform } from '../../types/index.ts';
import { getPlatformVietnameseName } from '../../utils/packaging.ts';

interface HeaderProps {
  activeMode: 'studio' | 'downloads';
  onModeChange: (mode: 'studio' | 'downloads') => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentProjectName: string;
  detectedOS: TargetPlatform;
  onOpenDeployModal: () => void;
  onOpenDomainSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeMode,
  onModeChange,
  activeTab,
  onTabChange,
  currentProjectName,
  detectedOS,
  onOpenDeployModal,
  onOpenDomainSettings
}) => {
  const studioTabs = [
    { id: 'editor', label: 'Mã Nguồn Cốt Lõi', icon: '📝' },
    { id: 'pipeline', label: 'Luồng CI/CD', icon: '⚡' },
    { id: 'packaging', label: 'Đóng Gói Đa Nền Tảng', icon: '📦' },
    { id: 'releases', label: 'Quản Lý Phát Hành', icon: '🚀' },
    { id: 'deployment', label: 'Workers & Pages', icon: '☁️' },
    { id: 'scanner', label: 'Quét Lỗ Hổng SAST', icon: '🔍' },
    { id: 'security', label: 'Két An Toàn & Ký Số', icon: '🛡️' },
    { id: 'analytics', label: 'Phân Tích Phân Phối', icon: '📊' },
    { id: 'domain-api', label: 'Cổng API Tên Miền', icon: '🌐' }
  ];

  const storeTabs = [
    { id: 'download-home', label: 'Cửa Hàng Ứng Dụng', icon: '🛍️' },
    { id: 'all-platforms', label: 'Tất Cả Hệ Điều Hành', icon: '💻' },
    { id: 'web-sandbox', label: 'Chạy Thử WebAssembly', icon: '▶️' },
    { id: 'changelog', label: 'Ghi Chú Phát Hành', icon: '📜' }
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-950/95 backdrop-blur-md sticky top-0 z-40">
      {/* Thanh định tuyến tên miền và kiểm định an toàn phân vùng */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-1.5 text-xs text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-mono text-[11px]">Định Tuyến API:</span>
          {activeMode === 'studio' ? (
            <span className="text-indigo-400 font-mono font-medium">quan-tri.forgeos.vn (Giao Diện Quản Trị & Phát Triển)</span>
          ) : (
            <span className="text-emerald-400 font-mono font-medium">tai-ve.forgeos.vn (Trang Chủ Phân Phối Người Dùng)</span>
          )}
          <span className="text-slate-600 hidden sm:inline">·</span>
          <span className="text-slate-400 hidden sm:inline">
            Cách Ly Mã Nguồn: <strong className="text-emerald-400 font-normal">An Toàn Tuyệt Đối (Air-Gapped)</strong>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenDomainSettings}
            className="hover:text-slate-200 transition-colors text-[11px] underline underline-offset-2"
          >
            Cấu Hình Tên Miền API
          </button>
          <span className="text-slate-700">|</span>
          <div className="flex items-center bg-slate-950 rounded p-0.5 border border-slate-800">
            <button
              onClick={() => {
                onModeChange('studio');
                if (['download-home', 'all-platforms', 'web-sandbox', 'changelog'].includes(activeTab)) {
                  onTabChange('editor');
                }
              }}
              className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                activeMode === 'studio'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Giao Diện Quản Trị
            </button>
            <button
              onClick={() => {
                onModeChange('downloads');
                onTabChange('download-home');
              }}
              className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                activeMode === 'downloads'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Trang Chủ Tải Về
            </button>
          </div>
        </div>
      </div>

      {/* Top Bar Contract chuẩn thương mại: 3 vùng cách nhau bởi gap-8 */}
      <div className="flex items-center justify-between gap-8 px-6 py-3 max-w-7xl mx-auto">
        {/* Vùng 1: Nhãn hiệu chữ đơn dòng */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="/"
            onClick={(e) => { e.preventDefault(); onModeChange('studio'); }}
            className="text-lg font-bold tracking-tight text-white whitespace-nowrap hover:text-indigo-300 transition-colors"
          >
            ForgeOS
          </a>
          <span className="text-slate-700">/</span>
          <span className="text-sm text-slate-300 font-medium whitespace-nowrap">
            {activeMode === 'studio' ? currentProjectName : 'Kho Ứng Dụng Đa Nền Tảng'}
          </span>
        </div>

        {/* Vùng 2: Các liên kết điều hướng chính */}
        <nav className="hidden md:flex items-center gap-5 text-xs font-medium text-slate-400 overflow-x-auto py-1">
          {activeMode === 'studio' ? (
            studioTabs.slice(0, 5).map(tab => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`whitespace-nowrap transition-colors hover:text-white flex items-center gap-1.5 ${
                  activeTab === tab.id ? 'text-white border-b-2 border-indigo-500 pb-0.5 font-semibold' : ''
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))
          ) : (
            storeTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`whitespace-nowrap transition-colors hover:text-white flex items-center gap-1.5 ${
                  activeTab === tab.id ? 'text-white border-b-2 border-emerald-500 pb-0.5 font-semibold' : ''
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))
          )}
        </nav>

        {/* Vùng 3: Hành động chính đơn nhất */}
        <div className="flex items-center gap-3 shrink-0">
          {activeMode === 'studio' ? (
            <button
              onClick={onOpenDeployModal}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 active:bg-indigo-700 transition-colors whitespace-nowrap shadow-sm shadow-indigo-950"
            >
              Triển Khai & Đẩy Lên GitHub
            </button>
          ) : (
            <button
              onClick={() => onTabChange('all-platforms')}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 rounded-lg hover:bg-emerald-300 active:bg-emerald-500 transition-colors whitespace-nowrap shadow-sm"
            >
              Tải Về Cho {getPlatformVietnameseName(detectedOS).split(' ')[0].toUpperCase()}
            </button>
          )}
        </div>
      </div>

      {/* Thanh công cụ phụ mở rộng cho Giao Diện Quản Trị (Sub-bar) */}
      {activeMode === 'studio' && (
        <div className="bg-slate-900/60 border-t border-slate-800/80 px-6 py-1.5 overflow-x-auto">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-xs">
            <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider mr-2 shrink-0">
              Bộ Công Cụ Quản Trị:
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {studioTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    activeTab === tab.id
                      ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <span className="text-[12px]">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
