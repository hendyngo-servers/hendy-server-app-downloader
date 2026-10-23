/**
 * Public Store entry point. This bundle intentionally does not import admin tools,
 * source editor, release management, or the admin login gate.
 */
import React, { useEffect, useState } from 'react';
import { loadPublicApps, loadPublicDomainRoutes, routeFor, hostnameToUrl } from '../shared/store.ts';
import type { ProjectTemplate, TargetPlatform } from '../../types/index.ts';
import { SAMPLE_PROJECTS } from '../../utils/sampleProjects.ts';
import { detectUserPlatform, getPlatformVietnameseName } from '../../utils/packaging.ts';
import { PublicStoreHeader } from '../../components/portal/PublicStoreHeader.tsx';
import { DownloadPortalView } from '../../components/portal/DownloadPortalView.tsx';

export default function PublicStoreApp() {
  const [projects, setProjects] = useState<ProjectTemplate[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [detectedOS, setDetectedOS] = useState<TargetPlatform>('windows');
  const [activeTab, setActiveTab] = useState('download-home');
  const [adminUrl, setAdminUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(current => current === message ? null : current), 4000);
  };

  useEffect(() => {
    setDetectedOS(detectUserPlatform());
    let cancelled = false;

    const loadPublicData = async () => {
      try {
        const data = await loadPublicApps();
        if (!cancelled && data.success && Array.isArray(data.apps)) {
          setProjects(data.apps);
          setActiveProjectId(current => current || data.apps[0]?.id || '');
        }
      } catch {
        if (!cancelled) notify('Chưa kết nối được máy chủ. Hãy kiểm tra lại sau.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const loadDomainLinks = async () => {
      try {
        const data = await loadPublicDomainRoutes();
        const admin = routeFor(data.routes, 'admin');
        if (!cancelled && admin) setAdminUrl(hostnameToUrl(admin.hostname));
      } catch {
        // A missing admin route never blocks public downloads.
      }
    };

    void loadPublicData();
    void loadDomainLinks();
    return () => { cancelled = true; };
  }, []);

  const project = projects.find(item => item.id === activeProjectId) || projects[0] || SAMPLE_PROJECTS[0];

  return (
    <div className="hendy-app hendy-app-store flex min-h-screen w-full flex-col bg-slate-50 text-slate-900 font-sans">
      {toast && (
        <div role="status" className="fixed bottom-5 right-5 z-[100] rounded-xl border border-emerald-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700 shadow-xl">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />{toast}
        </div>
      )}
      <PublicStoreHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        detectedPlatform={getPlatformVietnameseName(detectedOS)}
        adminUrl={adminUrl}
      />
      <main className="min-h-[calc(100vh-76px)] flex-1 bg-slate-50">
        {loading ? (
          <div className="flex min-h-[60vh] items-center justify-center gap-3 text-sm text-slate-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
            Đang tải kho phần mềm…
          </div>
        ) : projects.length === 0 ? (
          <section className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-white text-3xl shadow-sm ring-1 ring-slate-200">▦</div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Kho phần mềm đang cập nhật</h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-slate-500">Máy chủ chưa trả về ứng dụng công khai. Vui lòng quay lại sau khi bản phát hành được đăng tải.</p>
            <button onClick={() => window.location.reload()} className="mt-6 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400">Tải lại danh sách</button>
          </section>
        ) : (
          <DownloadPortalView
            project={project}
            projects={projects}
            onSelectProject={selected => setActiveProjectId(selected.id)}
            detectedOS={detectedOS}
            onNotify={notify}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        )}
      </main>
      <footer className="border-t border-slate-200 bg-white px-6 py-5 text-center text-[11px] text-slate-500">
        ForgeOS Software Store <span className="mx-2 text-slate-300">·</span> Tệp tải chỉ được công bố khi thuộc bản phát hành đã xuất bản.
      </footer>
    </div>
  );
}
