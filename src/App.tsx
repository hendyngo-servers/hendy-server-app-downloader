/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { ProjectTemplate, TargetPlatform, BuildArtifact, ReleaseVersion, CloudflareWorkersPagesConfig } from './types/index.ts';
import { SAMPLE_PROJECTS } from './utils/sampleProjects.ts';
import { getDefaultDeploymentConfig } from './utils/workersPagesConfig.ts';
import { detectUserPlatform } from './utils/packaging.ts';
import { Header } from './components/common/Header.tsx';
import { StudioView } from './components/studio/StudioView.tsx';
import { DownloadPortalView } from './components/portal/DownloadPortalView.tsx';
import { GitHubSyncModal } from './components/deployment/GitHubSyncModal.tsx';
import { DomainConfigPanel } from './components/deployment/DomainConfigPanel.tsx';
import { AdminAuthGate } from './components/admin/AdminAuthGate.tsx';

export default function App() {
  const [projects, setProjects] = useState<ProjectTemplate[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>(SAMPLE_PROJECTS[0].id);
  const [deploymentConfig, setDeploymentConfig] = useState<CloudflareWorkersPagesConfig>(getDefaultDeploymentConfig());

  // Hai giao diện tách biệt hoàn toàn: 'studio' (Giao diện Quản trị & Phát triển) vs 'downloads' (Trang chủ Tải về của người dùng)
  const [activeMode, setActiveMode] = useState<'studio' | 'downloads'>('downloads');
  const [activeStudioTab, setActiveStudioTab] = useState<string>('upload-artifacts');
  const [activePortalTab, setActivePortalTab] = useState<string>('download-home');

  // Xác thực quản trị viên máy chủ (Server-side Administrative Auth)
  const [adminToken, setAdminToken] = useState<string | null>(() => localStorage.getItem('forge_admin_token'));
  const [adminUser, setAdminUser] = useState<{ username: string; name: string } | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);

  // Modals
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [isDomainSettingsOpen, setIsDomainSettingsOpen] = useState(false);

  // Hệ điều hành máy khách tự động nhận diện
  const [detectedOS, setDetectedOS] = useState<TargetPlatform>('macos');

  // Hộp thoại thông báo Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const fileSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const notify = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 4000);
  };

  // Tải danh sách ứng dụng từ máy chủ
  const loadProjects = async (token?: string | null) => {
    try {
      const currentToken = token || adminToken;
      if (currentToken) {
        const res = await fetch('/api/v1/admin/projects', {
          headers: { Authorization: `Bearer ${currentToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.projects) {
            setProjects(data.projects);
            return;
          }
        }
      }

      // Fallback sang API công khai
      const res = await fetch('/api/v1/public/apps');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.apps) {
          setProjects(data.apps);
        }
      }
    } catch {
      // Giữ nguyên dữ liệu mẫu nếu máy chủ bận
    }
  };

  useEffect(() => {
    // Tự động nhận diện hệ điều hành máy khách
    setDetectedOS(detectUserPlatform());

    // Kiểm tra tham số định tuyến qua URL (?view=downloads hoặc ?view=studio hoặc ?portal=admin)
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view') || params.get('portal');
    if (viewParam === 'downloads') {
      setActiveMode('downloads');
    } else if (viewParam === 'studio' || viewParam === 'admin') {
      setActiveMode('studio');
    }

    // Kiểm tra trạng thái xác thực quản trị viên máy chủ
    const checkServerAuth = async () => {
      const token = localStorage.getItem('forge_admin_token');
      if (token) {
        try {
          const res = await fetch('/api/v1/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.authenticated) {
              setAdminUser(data.user);
              setAdminToken(token);
              await loadProjects(token);
            } else {
              localStorage.removeItem('forge_admin_token');
              setAdminToken(null);
              setAdminUser(null);
              await loadProjects(null);
            }
          } else {
            localStorage.removeItem('forge_admin_token');
            setAdminToken(null);
            setAdminUser(null);
            await loadProjects(null);
          }
        } catch {
          await loadProjects(null);
        }
      } else {
        await loadProjects(null);
      }
      setIsCheckingAuth(false);
    };

    checkServerAuth();
  }, []);

  const handleAdminLoginSuccess = (token: string, user: { username: string; name: string }) => {
    setAdminToken(token);
    setAdminUser(user);
    loadProjects(token);
    notify(`Chào mừng ${user.name}! Đã cấp quyền quản trị máy chủ.`);
  };

  const handleAdminLogout = async () => {
    if (adminToken) {
      try {
        await fetch('/api/v1/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}` }
        });
      } catch {
        // Bỏ qua
      }
    }
    localStorage.removeItem('forge_admin_token');
    setAdminToken(null);
    setAdminUser(null);
    setActiveMode('downloads');
    notify('Đã đăng xuất phiên làm việc quản trị viên an toàn.');
    loadProjects(null);
  };

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0] || SAMPLE_PROJECTS[0];

  // Persist all Studio edits through the protected API, rather than changing React state only.
  const persistProject = (updatedProject: ProjectTemplate) => {
    setProjects(prev => prev.map(project => project.id === updatedProject.id ? updatedProject : project));
    if (!adminToken) return;
    fetch('/api/v1/admin/projects/' + encodeURIComponent(updatedProject.id), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + adminToken
      },
      body: JSON.stringify(updatedProject)
    }).then(res => {
      if (!res.ok) notify('Không thể lưu thay đổi lên máy chủ (' + res.status + '). Vui lòng đăng nhập lại hoặc thử lại.');
    }).catch(() => notify('Mất kết nối khi lưu thay đổi. Kiểm tra máy chủ rồi thử lại.'));
  };

  const handleUpdateFileContent = (fileId: string, content: string) => {
    const projectId = activeProjectId;
    setProjects(prev => prev.map(project => project.id !== projectId ? project : {
      ...project,
      files: project.files.map(file => file.id === fileId ? { ...file, content } : file)
    }));

    if (!adminToken) return;
    const timerKey = projectId + ':' + fileId;
    const existing = fileSaveTimers.current[timerKey];
    if (existing) clearTimeout(existing);

    // Debounce edits and use a focused PATCH so rapid keystrokes cannot overwrite stale project state.
    fileSaveTimers.current[timerKey] = setTimeout(async () => {
      try {
        const res = await fetch(
          '/api/v1/admin/projects/' + encodeURIComponent(projectId) + '/files/' + encodeURIComponent(fileId),
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + adminToken
            },
            body: JSON.stringify({ content })
          }
        );
        if (!res.ok) notify('Không thể lưu nội dung tệp (' + res.status + '). Vui lòng thử lại.');
      } catch {
        notify('Mất kết nối khi lưu tệp. Kiểm tra máy chủ rồi thử lại.');
      } finally {
        delete fileSaveTimers.current[timerKey];
      }
    }, 600);
  };

  const handleAddFile = (name: string, filePath: string) => {
    const newFile = {
      id: 'file-' + Date.now(),
      name,
      path: filePath,
      language: name.endsWith('.rs') ? 'rust' : name.endsWith('.cpp') ? 'cpp' : name.endsWith('.go') ? 'go' : name.endsWith('.json') ? 'json' : 'typescript',
      content: '// Tệp mã nguồn mới: ' + name + '\n',
      encrypted: false
    };
    persistProject({ ...activeProject, files: [...activeProject.files, newFile] });
    notify('Đã tạo tệp mã nguồn mới: ' + name);
  };

  const handleDeleteFile = (fileId: string) => {
    persistProject({
      ...activeProject,
      files: activeProject.files.filter(file => file.id !== fileId)
    });
    notify('Đã xóa tệp mã nguồn khỏi cây dự án');
  };

  // Only artifacts uploaded and verified by the backend remain publishable after reload.
  const handleAddArtifact = (artifact: BuildArtifact) => {
    const releases = [...activeProject.releases];
    const latest = releases[0];
    if (!latest) {
      notify('Hãy tạo bản phát hành trước khi thêm artifact.');
      return;
    }
    releases[0] = {
      ...latest,
      artifacts: [artifact, ...latest.artifacts.filter(item => item.id !== artifact.id)]
    };
    persistProject({ ...activeProject, releases });
  };

  const handlePublishRelease = (release: ReleaseVersion) => {
    const releases = [
      release,
      ...activeProject.releases.filter(existing => existing.version !== release.version)
    ];
    persistProject({
      ...activeProject,
      currentVersion: release.version,
      releases
    });
  };

  return (
    <div className={activeMode === 'studio' ? 'hendy-app hendy-app-admin flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans' : 'hendy-app hendy-app-store flex flex-col h-screen w-screen bg-slate-50 text-slate-900 overflow-hidden font-sans'}>
      {/* Hộp thông báo nhanh Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 border border-indigo-500/60 text-slate-100 px-4 py-2.5 rounded-xl shadow-xl text-xs flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Thanh điều hướng Header tuân thủ Top Bar Contract */}
      <Header
        activeMode={activeMode}
        onModeChange={(mode) => {
          setActiveMode(mode);
          notify(`Đã chuyển sang ${mode === 'studio' ? 'Giao Diện Quản Trị & Phát Triển (quan-tri.forgeos.vn)' : 'Trang Chủ Tải Về Cho Người Dùng (tai-ve.forgeos.vn)'}`);
        }}
        activeTab={activeMode === 'studio' ? activeStudioTab : activePortalTab}
        onTabChange={(tab) => {
          if (activeMode === 'studio') {
            setActiveStudioTab(tab);
          } else {
            setActivePortalTab(tab);
          }
        }}
        currentProjectName={activeProject.name}
        detectedOS={detectedOS}
        onOpenDeployModal={() => setIsDeployModalOpen(true)}
        onOpenDomainSettings={() => setIsDomainSettingsOpen(true)}
        adminUser={adminUser}
        onLogout={handleAdminLogout}
      />

      {/* Khung nội dung chính: Tách biệt hoàn toàn giữa Quản trị và Trang chủ Tải về */}
      <main className="flex-1 flex overflow-hidden">
        {activeMode === 'studio' ? (
          // Kiểm tra xác thực máy chủ trước khi cho phép vào giao diện quản trị
          !adminUser ? (
            <AdminAuthGate
              onSuccess={handleAdminLoginSuccess}
              onCancel={() => setActiveMode('downloads')}
            />
          ) : (
            <StudioView
              projects={projects}
              activeProject={activeProject}
              onSelectProject={(p) => setActiveProjectId(p.id)}
              activeTab={activeStudioTab}
              onTabChange={setActiveStudioTab}
              onAddArtifact={handleAddArtifact}
              onPublishRelease={handlePublishRelease}
              onUpdateFileContent={handleUpdateFileContent}
              onAddFile={handleAddFile}
              onDeleteFile={handleDeleteFile}
              config={deploymentConfig}
              adminToken={adminToken || ''}
              onNotify={notify}
              onRefreshData={() => loadProjects(adminToken)}
            />
          )
        ) : (
          isCheckingAuth ? (
            <div className="flex-1 flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
              Đang tải danh sách phần mềm đã xuất bản...
            </div>
          ) : projects.length === 0 ? (
            <div className="flex-1 flex items-center justify-center bg-slate-950 p-6">
              <div className="max-w-xl text-center space-y-3">
                <div className="text-3xl">📦</div>
                <h2 className="text-lg font-bold text-white">Chưa có bản phát hành công khai</h2>
                <p className="text-sm text-slate-400">
                  Kho hiện chưa có artifact thật thuộc bản phát hành đã xuất bản, hoặc API chưa kết nối được.
                  Quản trị viên có thể đăng nhập tại giao diện Studio để tải tệp phát hành lên.
                </p>
              </div>
            </div>
          ) : (
            <DownloadPortalView
              project={activeProject}
              projects={projects}
              onSelectProject={(p) => setActiveProjectId(p.id)}
              detectedOS={detectedOS}
              onNotify={notify}
              activeTab={activePortalTab}
              onTabChange={setActivePortalTab}
            />
          )
        )}
      </main>

      {/* Cửa sổ xuất bản GitHub và triển khai Workers & Pages */}
      <GitHubSyncModal
        isOpen={isDeployModalOpen}
        onClose={() => setIsDeployModalOpen(false)}
        project={activeProject}
        config={deploymentConfig}
        onNotify={notify}
      />

      {/* Cửa sổ quản lý định tuyến tên miền qua API */}
      <DomainConfigPanel
        isOpen={isDomainSettingsOpen}
        onClose={() => setIsDomainSettingsOpen(false)}
        config={deploymentConfig}
        onUpdateConfig={setDeploymentConfig}
        onNotify={notify}
      />
    </div>
  );
}
