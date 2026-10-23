import React from 'react';

const links = [
  { id: 'download-home', label: 'Khám phá' },
  { id: 'all-platforms', label: 'Hệ điều hành' },
  { id: 'web-sandbox', label: 'Dùng thử' },
  { id: 'manifest-viewer', label: 'Xác minh tệp' },
  { id: 'changelog', label: 'Lịch sử cập nhật' }
];

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
  detectedPlatform: string;
  adminUrl?: string;
}

export const PublicStoreHeader: React.FC<Props> = ({ activeTab, onTabChange, detectedPlatform, adminUrl }) => (
  <header className="hendy-header hendy-header-store">
    <div className="hendy-header-main">
      <a href="/" className="hendy-brand" aria-label="ForgeOS — cửa hàng phần mềm">
        <span className="hendy-brand-mark">F</span>
        <span className="hendy-brand-copy"><strong>ForgeOS</strong><small>SOFTWARE STORE</small></span>
      </a>
      <nav className="hendy-store-nav" aria-label="Điều hướng cửa hàng">
        {links.map(link => (
          <button key={link.id} onClick={() => onTabChange(link.id)}
            className={activeTab === link.id ? 'hendy-store-nav-link active' : 'hendy-store-nav-link'}>
            {link.label}
          </button>
        ))}
      </nav>
      <div className="hendy-header-actions">
        <span className="hendy-os-pill"><span className="hendy-live-dot" /> Thiết bị: {detectedPlatform}</span>
        {adminUrl ? <a className="hendy-admin-entry" href={adminUrl}>Quản trị ↗</a> : null}
      </div>
    </div>
  </header>
);
