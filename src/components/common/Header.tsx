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
  adminUser?: { username: string; name: string } | null;
  onLogout?: () => void;
}

const studioTabs = [
  { id: 'upload-artifacts', label: 'Bản phát hành', icon: '⬆' },
  { id: 'editor', label: 'Mã nguồn', icon: '⌘' },
  { id: 'pipeline', label: 'CI / CD', icon: '⚡' },
  { id: 'packaging', label: 'Đóng gói', icon: '▦' },
  { id: 'releases', label: 'Phiên bản', icon: '◷' },
  { id: 'deployment', label: 'Triển khai', icon: '☁' },
  { id: 'scanner', label: 'Bảo mật', icon: '⌕' },
  { id: 'security', label: 'Kho khóa', icon: '◇' },
  { id: 'analytics', label: 'Phân tích', icon: '▥' },
  { id: 'domain-api', label: 'API & tên miền', icon: '↗' }
];

const storeTabs = [
  { id: 'download-home', label: 'Khám phá' },
  { id: 'all-platforms', label: 'Hệ điều hành' },
  { id: 'web-sandbox', label: 'Dùng thử' },
  { id: 'manifest-viewer', label: 'Xác minh tệp' },
  { id: 'changelog', label: 'Lịch sử cập nhật' }
];

export const Header: React.FC<HeaderProps> = ({
  activeMode,
  onModeChange,
  activeTab,
  onTabChange,
  currentProjectName,
  detectedOS,
  onOpenDeployModal,
  onOpenDomainSettings,
  adminUser,
  onLogout
}) => {
  const isAdmin = activeMode === 'studio';

  return (
    <header className={isAdmin ? 'hendy-header hendy-header-admin' : 'hendy-header hendy-header-store'}>
      <div className="hendy-header-main">
        <a
          href="/"
          onClick={(e) => { e.preventDefault(); onModeChange('downloads'); }}
          className="hendy-brand"
          aria-label="ForgeOS — trang chủ"
        >
          <span className="hendy-brand-mark">F</span>
          <span className="hendy-brand-copy">
            <strong>ForgeOS</strong>
            <small>{isAdmin ? 'CONTROL CENTER' : 'SOFTWARE STORE'}</small>
          </span>
        </a>

        {isAdmin ? (
          <>
            <div className="hendy-context">
              <span className="hendy-context-kicker">KHÔNG GIAN QUẢN TRỊ</span>
              <strong>{currentProjectName}</strong>
            </div>
            <div className="hendy-header-actions">
              <button className="hendy-quiet-button" onClick={onOpenDomainSettings}>Cấu hình API</button>
              <button className="hendy-primary-button" onClick={onOpenDeployModal}>↗ Triển khai</button>
              <button className="hendy-user-chip" onClick={onLogout} title="Đăng xuất">
                <span className="hendy-avatar">{(adminUser?.name || 'A').slice(0, 1).toUpperCase()}</span>
                <span className="hendy-user-copy"><strong>{adminUser?.name || 'Quản trị viên'}</strong><small>Đăng xuất ↗</small></span>
              </button>
              <button className="hendy-mode-link" onClick={() => onModeChange('downloads')}>Xem cửa hàng ↗</button>
            </div>
          </>
        ) : (
          <>
            <nav className="hendy-store-nav" aria-label="Điều hướng cửa hàng">
              {storeTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={activeTab === tab.id ? 'hendy-store-nav-link active' : 'hendy-store-nav-link'}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
            <div className="hendy-header-actions">
              <span className="hendy-os-pill"><span className="hendy-live-dot" /> Phát hiện: {getPlatformVietnameseName(detectedOS)}</span>
              <button className="hendy-primary-button" onClick={() => onTabChange('all-platforms')}>Tải phần mềm ↓</button>
              <button className="hendy-admin-entry" onClick={() => onModeChange('studio')}>Quản trị ↗</button>
            </div>
          </>
        )}
      </div>

      {isAdmin && (
        <div className="hendy-admin-nav-wrap">
          <div className="hendy-admin-nav-label">WORKSPACE <span>·</span> {adminUser?.username || 'ADMIN'}</div>
          <nav className="hendy-admin-nav" aria-label="Công cụ quản trị">
            {studioTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={activeTab === tab.id ? 'hendy-admin-nav-link active' : 'hendy-admin-nav-link'}
              >
                <span className="hendy-nav-icon">{tab.icon}</span>{tab.label}
              </button>
            ))}
          </nav>
          <div className="hendy-admin-status"><span className="hendy-live-dot" /> SESSION ACTIVE</div>
        </div>
      )}
    </header>
  );
};
