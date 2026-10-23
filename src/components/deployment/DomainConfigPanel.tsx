/**
 * Server-backed domain routing manager. This panel saves application routes through
 * the authenticated backend API; it does not pretend to edit registrar DNS records.
 */
import React, { useEffect, useState } from 'react';
import type { CloudflareWorkersPagesConfig, DomainRouteSetting } from '../../types/index.ts';
import { loadAdminDomainRoutes, saveAdminDomainRoutes, normalizeHostname } from '../../client/shared/store.ts';
import type { DomainRouteRecord } from '../../client/shared/types.ts';

type ApiRoute = DomainRouteRecord;
interface Props {
  isOpen: boolean;
  onClose: () => void;
  config: CloudflareWorkersPagesConfig;
  onUpdateConfig: (config: CloudflareWorkersPagesConfig) => void;
  onNotify: (message: string) => void;
  adminToken: string;
}
const cleanHost = (value: string) => normalizeHostname(value);
const hostPattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/;

export const DomainConfigPanel: React.FC<Props> = ({ isOpen, onClose, config, onUpdateConfig, onNotify, adminToken }) => {
  const [adminDomain, setAdminDomain] = useState('');
  const [publicDomain, setPublicDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      setNotice('');
      try {
        const data = await loadAdminDomainRoutes(adminToken);
        const routes = (data.routes || []) as ApiRoute[];
        if (!cancelled) {
          setAdminDomain(routes.find(route => route.targetView === 'admin')?.hostname || '');
          setPublicDomain(routes.find(route => route.targetView === 'downloads')?.hostname || '');
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Không tải được cấu hình định tuyến.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [isOpen, adminToken]);

  if (!isOpen) return null;

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    const adminHost = cleanHost(adminDomain);
    const storeHost = cleanHost(publicDomain);
    if (!hostPattern.test(adminHost) || !hostPattern.test(storeHost)) {
      setError('Nhập hostname hợp lệ, ví dụ quan-tri.example.com và tai-ve.example.com. Không nhập đường dẫn hoặc wildcard.');
      return;
    }
    if (adminHost === storeHost) {
      setError('Tên miền quản trị và cổng tải phải khác nhau.');
      return;
    }
    setSaving(true);
    try {
      const data = await saveAdminDomainRoutes(adminToken, { adminDomain: adminHost, publicDomain: storeHost });
      const routes = (data.routes || []) as ApiRoute[];
      const toSetting = (route: ApiRoute, index: number): DomainRouteSetting => {
        const pieces = route.hostname.split('.');
        return {
          id: route.targetView === 'admin' ? 'route-admin' : 'route-downloads',
          subdomain: pieces.length > 1 ? pieces[0] : route.hostname,
          domain: pieces.length > 1 ? pieces.slice(1).join('.') : '',
          targetView: route.targetView === 'admin' ? 'studio' : 'downloads',
          purpose: route.targetView === 'admin'
            ? 'Admin Control Center; tất cả thao tác nhạy cảm phải qua API xác thực.'
            : 'Public Store; chỉ hiển thị bản phát hành đã xuất bản.',
          dnsType: 'CNAME',
          dnsTarget: 'Cần gắn custom domain ở nền tảng hosting',
          status: 'pending',
          sslStatus: 'provisioning',
          accessControl: route.targetView === 'admin' ? 'Internal Token Auth' : 'Public Edge CDN',
          apiManaged: true
        };
      };
      onUpdateConfig({
        ...config,
        routes: routes.map(toSetting),
        workersRoute: `${adminHost}/*`,
        pagesDomain: storeHost
      });
      setAdminDomain(adminHost);
      setPublicDomain(storeHost);
      setNotice('Đã lưu bảng định tuyến trên API. Cấu hình DNS/custom domains và TLS tại nền tảng hosting vẫn là bước riêng.');
      onNotify('Đã lưu ánh xạ hostname cho Admin Control Center và Public Store qua API.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu cấu hình định tuyến.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="domain-routing-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-300">API CONTROL PLANE</p>
            <h2 id="domain-routing-title" className="mt-1 text-xl font-extrabold tracking-tight">Định tuyến hai giao diện theo tên miền</h2>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-400">Hostname được lưu trên backend và Worker/Render dùng để chọn đúng entry point. Cấu hình này không tự tạo bản ghi DNS hoặc cấp chứng chỉ TLS.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-xl px-3 py-2 text-xl text-slate-400 hover:bg-slate-800 hover:text-white">×</button>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 py-10 text-sm text-slate-400"><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-violet-400" />Đang tải cấu hình từ API…</div>
        ) : (
          <form onSubmit={handleSave} className="mt-5 space-y-5">
            {error && <div role="alert" className="rounded-xl border border-rose-800 bg-rose-950/40 px-4 py-3 text-xs leading-5 text-rose-200">{error}</div>}
            {notice && <div role="status" className="rounded-xl border border-emerald-800 bg-emerald-950/30 px-4 py-3 text-xs leading-5 text-emerald-200">{notice}</div>}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block rounded-2xl border border-violet-500/30 bg-slate-950 p-4">
                <span className="flex items-center gap-2 text-xs font-bold text-violet-200"><span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500/15">⌘</span>Admin Control Center</span>
                <span className="mt-4 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Hostname quản trị</span>
                <input value={adminDomain} onChange={event => setAdminDomain(event.target.value)} required autoComplete="url" spellCheck={false} placeholder="quan-tri.example.com" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 font-mono text-xs text-white outline-none focus:border-violet-400" />
                <span className="mt-2 block text-[11px] leading-5 text-slate-500">Đăng nhập bắt buộc; API admin vẫn xác thực Bearer token độc lập.</span>
              </label>
              <label className="block rounded-2xl border border-emerald-500/30 bg-slate-950 p-4">
                <span className="flex items-center gap-2 text-xs font-bold text-emerald-200"><span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/15">↓</span>Public Store</span>
                <span className="mt-4 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Hostname công khai</span>
                <input value={publicDomain} onChange={event => setPublicDomain(event.target.value)} required autoComplete="url" spellCheck={false} placeholder="tai-ve.example.com" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 font-mono text-xs text-white outline-none focus:border-emerald-400" />
                <span className="mt-2 block text-[11px] leading-5 text-slate-500">Chỉ dành cho tìm kiếm ứng dụng, manifest công khai và tải bản phát hành.</span>
              </label>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-700">
              <div className="border-b border-slate-700 bg-slate-800/70 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Ánh xạ API hiện tại</div>
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-[10px] uppercase text-slate-500"><tr><th className="px-4 py-3">Giao diện</th><th className="px-4 py-3">Hostname</th><th className="px-4 py-3">Entry point</th></tr></thead>
                <tbody className="divide-y divide-slate-800">
                  <tr><td className="px-4 py-3 font-semibold text-violet-200">Admin</td><td className="break-all px-4 py-3 font-mono text-slate-200">{cleanHost(adminDomain) || '—'}</td><td className="px-4 py-3 font-mono text-slate-400">admin.html / AdminApp</td></tr>
                  <tr><td className="px-4 py-3 font-semibold text-emerald-200">Public Store</td><td className="break-all px-4 py-3 font-mono text-slate-200">{cleanHost(publicDomain) || '—'}</td><td className="px-4 py-3 font-mono text-slate-400">index.html / PublicStoreApp</td></tr>
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-[11px] leading-5 text-amber-100/80">
              <strong className="text-amber-200">Bước triển khai sau khi lưu:</strong> thêm mỗi hostname vào đúng dịch vụ Cloudflare Workers/Pages hoặc Render; trỏ DNS theo hướng dẫn nền tảng và chờ TLS hoạt động. Không đặt Cloudflare API token trong trình duyệt hoặc mã nguồn.
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-800 pt-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} className="rounded-xl px-4 py-3 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white">Đóng</button>
              <button type="submit" disabled={saving} className="rounded-xl bg-violet-500 px-5 py-3 text-xs font-extrabold text-white hover:bg-violet-400 disabled:opacity-60">{saving ? 'Đang lưu qua API…' : 'Lưu định tuyến qua API'}</button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
};
