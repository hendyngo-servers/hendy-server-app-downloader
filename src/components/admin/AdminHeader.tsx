import React from 'react';

const tabs = [
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

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentProjectName: string;
  adminUser: { username: string; name: string } | null;
  onOpenDeploy: () => void;
  onOpenDomains: () => void;
  onLogout: () => void;
  publicStoreUrl?: string;
}

export const AdminHeader: React.FC<Props> = ({
  activeTab, onTabChange, currentProjectName, adminUser, onOpenDeploy, onOpenDomains, onLogout, publicStoreUrl
}) => (
  <header className="hendy-header hendy-header-admin">
    <div className="hendy-header-main">
      <a href="/" className="hendy-brand" aria-label="ForgeOS Admin Control Center">
        <span className="hendy-brand-mark">F</span>
        <span className="hendy-brand-copy"><strong>ForgeOS</strong><small>ADMIN CONTROL CENTER</small></span>
      </a>
      <div className="hendy-context">
        <span className="hendy-context-kicker">PRIVATE WORKSPACE</span>
        <strong>{currentProjectName}</strong>
      </div>
      <div className="hendy-header-actions">
        <button className="hendy-quiet-button" onClick={onOpenDomains}>API & tên miền</button>
        <button className="hendy-primary-button" onClick={onOpenDeploy}>↗ Triển khai</button>
        {publicStoreUrl ? <a className="hendy-mode-link" href={publicStoreUrl}>Mở Public Store ↗</a> : null}
        <button className="hendy-user-chip" onClick={onLogout} title="Đăng xuất">
          <span className="hendy-avatar">{(adminUser?.name || 'A').slice(0, 1).toUpperCase()}</span>
          <span className="hendy-user-copy"><strong>{adminUser?.name || 'Quản trị viên'}</strong><small>Đăng xuất ↗</small></span>
        </button>
      </div>
    </div>
    <div className="hendy-admin-nav-wrap">
      <div className="hendy-admin-nav-label">WORKSPACE <span>·</span> {adminUser?.username || 'ADMIN'}</div>
      <nav className="hendy-admin-nav" aria-label="Công cụ quản trị">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => onTabChange(tab.id)}
            className={activeTab === tab.id ? 'hendy-admin-nav-link active' : 'hendy-admin-nav-link'}>
            <span className="hendy-nav-icon">{tab.icon}</span>{tab.label}
          </button>
        ))}
      </nav>
      <div className="hendy-admin-status"><span className="hendy-live-dot" /> SESSION ACTIVE</div>
    </div>
  </header>
);
