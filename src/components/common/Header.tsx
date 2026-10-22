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
  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40">
      {/* Thanh định tuyến tên miền và kiểm định an toàn phân vùng */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-1.5 text-xs text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-mono text-[11px]">Định Tuyến API:</span>
          {activeMode === 'studio' ? (
            <span className="text-indigo-400 font-mono font-medium">quan-tri.forgeos.vn (Giao Diện Quản Trị & Phát Triển)</span>
          ) : (
            <span className="text-emerald-400 font-mono font-medium">tai-ve.forgeos.vn (Trang Chủ Phân Phối Người Dùng)</span>
          )}
          <span className="text-slate-600">·</span>
          <span className="text-slate-400">Cách Ly Mã Nguồn: <strong className="text-emerald-400 font-normal">An Toàn Tuyệt Đối (Air-Gapped)</strong></span>
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
              onClick={() => onModeChange('studio')}
              className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                activeMode === 'studio'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Giao Diện Quản Trị
            </button>
            <button
              onClick={() => onModeChange('downloads')}
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
      <div className="flex items-center justify-between gap-8 px-6 py-3.5 max-w-7xl mx-auto">
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

        {/* Vùng 2: Các liên kết điều hướng chuyên môn */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-400">
          {activeMode === 'studio' ? (
            <>
              <button
                onClick={() => onTabChange('editor')}
                className={`whitespace-nowrap transition-colors hover:text-white ${
                  activeTab === 'editor' ? 'text-white border-b-2 border-indigo-500 pb-0.5 font-semibold' : ''
                }`}
              >
                Mã Nguồn Cốt Lõi
              </button>
              <button
                onClick={() => onTabChange('packaging')}
                className={`whitespace-nowrap transition-colors hover:text-white ${
                  activeTab === 'packaging' ? 'text-white border-b-2 border-indigo-500 pb-0.5 font-semibold' : ''
                }`}
              >
                Đóng Gói Đa Nền Tảng
              </button>
              <button
                onClick={() => onTabChange('releases')}
                className={`whitespace-nowrap transition-colors hover:text-white ${
                  activeTab === 'releases' ? 'text-white border-b-2 border-indigo-500 pb-0.5 font-semibold' : ''
                }`}
              >
                Quản Lý Phát Hành
              </button>
              <button
                onClick={() => onTabChange('deployment')}
                className={`whitespace-nowrap transition-colors hover:text-white ${
                  activeTab === 'deployment' ? 'text-white border-b-2 border-indigo-500 pb-0.5 font-semibold' : ''
                }`}
              >
                Workers & Pages
              </button>
              <button
                onClick={() => onTabChange('security')}
                className={`whitespace-nowrap transition-colors hover:text-white ${
                  activeTab === 'security' ? 'text-white border-b-2 border-indigo-500 pb-0.5 font-semibold' : ''
                }`}
              >
                Bảo Mật & Ký Số
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onTabChange('download-home')}
                className={`whitespace-nowrap transition-colors hover:text-white ${
                  activeTab === 'download-home' ? 'text-white border-b-2 border-emerald-500 pb-0.5 font-semibold' : ''
                }`}
              >
                Tổng Quan Phần Mềm
              </button>
              <button
                onClick={() => onTabChange('all-platforms')}
                className={`whitespace-nowrap transition-colors hover:text-white ${
                  activeTab === 'all-platforms' ? 'text-white border-b-2 border-emerald-500 pb-0.5 font-semibold' : ''
                }`}
              >
                Tất Cả Hệ Điều Hành
              </button>
              <button
                onClick={() => onTabChange('web-sandbox')}
                className={`whitespace-nowrap transition-colors hover:text-white ${
                  activeTab === 'web-sandbox' ? 'text-white border-b-2 border-emerald-500 pb-0.5 font-semibold' : ''
                }`}
              >
                Chạy Thử WebAssembly
              </button>
              <button
                onClick={() => onTabChange('changelog')}
                className={`whitespace-nowrap transition-colors hover:text-white ${
                  activeTab === 'changelog' ? 'text-white border-b-2 border-emerald-500 pb-0.5 font-semibold' : ''
                }`}
              >
                Ghi Chú Phát Hành
              </button>
            </>
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
    </header>
  );
};
