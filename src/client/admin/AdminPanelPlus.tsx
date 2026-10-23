/**
 * Private Admin Control Center entry point. The public store is compiled from a
 * separate entry and is not imported by this bundle.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { loadPublicDomainRoutes, routeFor, hostnameToUrl } from '../shared/store.ts';
import { PublishModal } from '../shared/PublishModal.tsx';
import type { BuildArtifact, CloudflareWorkersPagesConfig, ProjectTemplate, ReleaseVersion } from '../../types/index.ts';
import { SAMPLE_PROJECTS } from '../../utils/sampleProjects.ts';
import { getDefaultDeploymentConfig } from '../../utils/workersPagesConfig.ts';
import { AdminHeader } from '../../components/admin/AdminHeader.tsx';
import { AdminAuthGate } from '../../components/admin/AdminAuthGate.tsx';
import { StudioView } from '../../components/studio/StudioView.tsx';
import { GitHubSyncModal } from '../../components/deployment/GitHubSyncModal.tsx';
import { DomainConfigPanel } from '../../components/deployment/DomainConfigPanel.tsx';

export default function AdminApp() {
  const [projects, setProjects] = useState<ProjectTemplate[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>(SAMPLE_PROJECTS[0].id);
  const [activeTab, setActiveTab] = useState('upload-artifacts');
  const [deploymentConfig, setDeploymentConfig] = useState<CloudflareWorkersPagesConfig>(getDefaultDeploymentConfig());
  const [adminToken, setAdminToken] = useState<string | null>(() => localStorage.getItem('forge_admin_token'));
  const [adminUser, setAdminUser] = useState<{ username: string; name: string } | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [isDomainSettingsOpen, setIsDomainSettingsOpen] = useState(false);
  const [pendingRelease, setPendingRelease] = useState<ReleaseVersion | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [publicStoreUrl, setPublicStoreUrl] = useState('');
  const fileSaveTimers = useRef<Record<string, number>>({});

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(current => current === message ? null : current), 4000);
  }, []);

  const loadProjects = useCallback(async (token: string) => {
    try {
      const response = await fetch('/api/v1/admin/projects', {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
      });
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('forge_admin_token');
        setAdminToken(null);
        setAdminUser(null);
        return;
      }
      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = await response.json();
      if (data.success && Array.isArray(data.projects)) {
        setProjects(data.projects);
        setActiveProjectId(current => current || data.projects[0]?.id || SAMPLE_PROJECTS[0].id);
      }
    } catch {
      notify('Không thể tải workspace từ máy chủ. Kiểm tra API backend và thử lại.');
    }
  }, [notify]);

  useEffect(() => {
    let cancelled = false;

    const loadPublicStoreLink = async () => {
      try {
        const data = await loadPublicDomainRoutes();
        const route = routeFor(data.routes, 'downloads');
        if (route && !cancelled) setPublicStoreUrl(hostnameToUrl(route.hostname));
      } catch {
        // The admin workspace remains available even before a public custom domain is configured.
      }
    };

    const checkSession = async () => {
      const token = localStorage.getItem('forge_admin_token');
      if (!token) {
        if (!cancelled) { setAdminToken(null); setAdminUser(null); setIsCheckingAuth(false); }
        return;
      }
      try {
        const response = await fetch('/api/v1/auth/me', {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
        });
        const data = response.ok ? await response.json() : null;
        if (data?.authenticated && data.user) {
          if (!cancelled) {
            setAdminToken(token);
            setAdminUser(data.user);
          }
          await loadProjects(token);
        } else {
          localStorage.removeItem('forge_admin_token');
          if (!cancelled) { setAdminToken(null); setAdminUser(null); }
        }
      } catch {
        // Keep the login boundary visible when the API cannot verify the stored session.
        if (!cancelled) { setAdminToken(null); setAdminUser(null); }
      } finally {
        if (!cancelled) setIsCheckingAuth(false);
      }
    };

    void loadPublicStoreLink();
    void checkSession();
    return () => { cancelled = true; };
  }, [loadProjects]);

  useEffect(() => () => {
    Object.values(fileSaveTimers.current).forEach(timer => window.clearTimeout(timer));
  }, []);

  const activeProject = projects.find(project => project.id === activeProjectId) || projects[0] || SAMPLE_PROJECTS[0];

  const handleLoginSuccess = (token: string, user: { username: string; name: string }) => {
    localStorage.setItem('forge_admin_token', token);
    setAdminToken(token);
    setAdminUser(user);
    void loadProjects(token);
    notify(`Đăng nhập thành công. Chào mừng ${user.name}.`);
  };

  const handleLogout = async () => {
    const token = adminToken;
    try {
      if (token) await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch {
      // Local session is still cleared if the server is unreachable.
    }
    localStorage.removeItem('forge_admin_token');
    setAdminToken(null);
    setAdminUser(null);
    setProjects([]);
    notify('Đã đăng xuất khỏi Admin Control Center.');
  };

  const persistProject = (updatedProject: ProjectTemplate) => {
    setProjects(previous => previous.map(project => project.id === updatedProject.id ? updatedProject : project));
    if (!adminToken) return;
    void fetch('/api/v1/admin/projects/' + encodeURIComponent(updatedProject.id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(updatedProject)
    }).then(response => {
      if (!response.ok) notify(`Không lưu được thay đổi lên máy chủ (HTTP ${response.status}).`);
    }).catch(() => notify('Mất kết nối khi lưu thay đổi.'));
  };

  const handleUpdateFileContent = (fileId: string, content: string) => {
    const projectId = activeProjectId;
    setProjects(previous => previous.map(project => project.id !== projectId ? project : {
      ...project, files: project.files.map(file => file.id === fileId ? { ...file, content } : file)
    }));
    if (!adminToken) return;

    const timerKey = projectId + ':' + fileId;
    const previousTimer = fileSaveTimers.current[timerKey];
    if (previousTimer) window.clearTimeout(previousTimer);
    fileSaveTimers.current[timerKey] = window.setTimeout(async () => {
      try {
        const response = await fetch(
          '/api/v1/admin/projects/' + encodeURIComponent(projectId) + '/files/' + encodeURIComponent(fileId),
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({ content })
          }
        );
        if (!response.ok) notify(`Không lưu được nội dung tệp (HTTP ${response.status}).`);
      } catch {
        notify('Mất kết nối khi lưu tệp nguồn.');
      } finally {
        delete fileSaveTimers.current[timerKey];
      }
    }, 600);
  };

  const handleAddFile = (name: string, filePath: string) => {
    const newFile = {
      id: 'file-' + crypto.randomUUID(),
      name,
      path: filePath,
      language: name.endsWith('.rs') ? 'rust' : name.endsWith('.cpp') ? 'cpp' : name.endsWith('.go') ? 'go' : name.endsWith('.json') ? 'json' : 'typescript',
      content: '// Tệp mã nguồn mới: ' + name + '\n',
      encrypted: false
    };
    persistProject({ ...activeProject, files: [...activeProject.files, newFile] });
    notify(`Đã tạo tệp: ${name}`);
  };

  const handleDeleteFile = (fileId: string) => {
    persistProject({ ...activeProject, files: activeProject.files.filter(file => file.id !== fileId) });
    notify('Đã xóa tệp khỏi cây dự án.');
  };

  const handleAddArtifact = (artifact: BuildArtifact) => {
    const releases = [...activeProject.releases];
    if (!releases[0]) { notify('Hãy tạo bản phát hành trước khi thêm artifact.'); return; }
    releases[0] = { ...releases[0], artifacts: [artifact, ...releases[0].artifacts.filter(item => item.id !== artifact.id)] };
    persistProject({ ...activeProject, releases });
  };

  const handlePublishRelease = (release: ReleaseVersion) => {
    setPendingRelease(release);
  };

  const confirmPublishRelease = () => {
    if (!pendingRelease) return;
    const releases = [pendingRelease, ...activeProject.releases.filter(item => item.version !== pendingRelease.version)];
    persistProject({ ...activeProject, currentVersion: pendingRelease.version, releases });
    notify(`Đã gửi bản phát hành v${pendingRelease.version} lên API để công bố.`);
    setPendingRelease(null);
  };

  if (isCheckingAuth) {
    return (
      <div className="hendy-app hendy-app-admin flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <div className="flex items-center gap-3 text-sm"><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-violet-400" />Đang xác minh phiên quản trị…</div>
      </div>
    );
  }

  return (
    <div className="hendy-app hendy-app-admin flex min-h-screen w-full flex-col bg-slate-950 text-slate-100 font-sans">
      {toast && <div role="status" className="fixed bottom-5 right-5 z-[100] rounded-xl border border-indigo-500/50 bg-slate-900 px-4 py-3 text-xs text-white shadow-xl">{toast}</div>}
      {adminUser && adminToken ? (
        <AdminHeader
          activeTab={activeTab}
          onTabChange={setActiveTab}
          currentProjectName={activeProject.name}
          adminUser={adminUser}
          onOpenDeploy={() => setIsDeployModalOpen(true)}
          onOpenDomains={() => setIsDomainSettingsOpen(true)}
          onLogout={() => void handleLogout()}
          publicStoreUrl={publicStoreUrl}
        />
      ) : (
        <header className="hendy-header hendy-header-admin">
          <div className="hendy-header-main">
            <a href="/" className="hendy-brand" aria-label="ForgeOS Admin Control Center">
              <span className="hendy-brand-mark">F</span>
              <span className="hendy-brand-copy"><strong>ForgeOS</strong><small>ADMIN CONTROL CENTER</small></span>
            </a>
            <span className="ml-auto rounded-full border border-amber-500/20 bg-amber-400/10 px-3 py-2 text-[10px] font-bold tracking-wider text-amber-200">PRIVATE AREA · SIGN IN REQUIRED</span>
          </div>
        </header>
      )}
      <main className="min-h-[calc(100vh-130px)] flex-1">
        {!adminUser || !adminToken ? (
          <AdminAuthGate
            onSuccess={handleLoginSuccess}
            onCancel={publicStoreUrl ? () => window.location.assign(publicStoreUrl) : undefined}
          />
        ) : (
          <StudioView
            projects={projects}
            activeProject={activeProject}
            onSelectProject={project => setActiveProjectId(project.id)}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onAddArtifact={handleAddArtifact}
            onPublishRelease={handlePublishRelease}
            onUpdateFileContent={handleUpdateFileContent}
            onAddFile={handleAddFile}
            onDeleteFile={handleDeleteFile}
            config={deploymentConfig}
            adminToken={adminToken}
            onNotify={notify}
            onRefreshData={() => void loadProjects(adminToken)}
          />
        )}
      </main>

      {adminUser && adminToken && (
        <>
          <GitHubSyncModal
            isOpen={isDeployModalOpen}
            onClose={() => setIsDeployModalOpen(false)}
            project={activeProject}
            config={deploymentConfig}
            onNotify={notify}
          />
          <DomainConfigPanel
            isOpen={isDomainSettingsOpen}
            onClose={() => setIsDomainSettingsOpen(false)}
            config={deploymentConfig}
            onUpdateConfig={setDeploymentConfig}
            onNotify={notify}
            adminToken={adminToken}
          />
          <PublishModal
            release={pendingRelease}
            onClose={() => setPendingRelease(null)}
            onConfirm={confirmPublishRelease}
          />
        </>
      )}
    </div>
  );
}
