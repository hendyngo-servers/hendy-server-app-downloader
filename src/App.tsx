/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ProjectTemplate, TargetPlatform, BuildArtifact, ReleaseVersion, CloudflareWorkersPagesConfig } from './types/index.ts';
import { SAMPLE_PROJECTS } from './utils/sampleProjects.ts';
import { getDefaultDeploymentConfig } from './utils/workersPagesConfig.ts';
import { detectUserPlatform } from './utils/packaging.ts';
import { Header } from './components/common/Header.tsx';
import { StudioView } from './components/studio/StudioView.tsx';
import { DownloadPortalView } from './components/portal/DownloadPortalView.tsx';
import { GitHubSyncModal } from './components/deployment/GitHubSyncModal.tsx';
import { DomainConfigPanel } from './components/deployment/DomainConfigPanel.tsx';

export default function App() {
  const [projects, setProjects] = useState<ProjectTemplate[]>(SAMPLE_PROJECTS);
  const [activeProjectId, setActiveProjectId] = useState<string>(SAMPLE_PROJECTS[0].id);
  const [deploymentConfig, setDeploymentConfig] = useState<CloudflareWorkersPagesConfig>(getDefaultDeploymentConfig());

  // Hai giao diện tách biệt hoàn toàn: 'studio' (Giao diện Quản trị & Phát triển) vs 'downloads' (Trang chủ Tải về của người dùng)
  const [activeMode, setActiveMode] = useState<'studio' | 'downloads'>('studio');
  const [activeStudioTab, setActiveStudioTab] = useState<string>('editor');
  const [activePortalTab, setActivePortalTab] = useState<string>('download-home');

  // Modals
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [isDomainSettingsOpen, setIsDomainSettingsOpen] = useState(false);

  // Hệ điều hành máy khách tự động nhận diện
  const [detectedOS, setDetectedOS] = useState<TargetPlatform>('macos');

  // Hộp thoại thông báo Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    // Tự động nhận diện hệ điều hành máy khách
    setDetectedOS(detectUserPlatform());

    // Kiểm tra tham số định tuyến qua URL (?view=downloads hoặc ?view=studio)
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    if (viewParam === 'downloads') {
      setActiveMode('downloads');
    } else if (viewParam === 'studio') {
      setActiveMode('studio');
    }
  }, []);

  const notify = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 4000);
  };

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];

  // Xử lý cập nhật mã nguồn tệp
  const handleUpdateFileContent = (fileId: string, content: string) => {
    setProjects(prev => prev.map(proj => {
      if (proj.id !== activeProjectId) return proj;
      return {
        ...proj,
        files: proj.files.map(f => f.id === fileId ? { ...f, content } : f)
      };
    }));
  };

  const handleAddFile = (name: string, path: string) => {
    const newFile = {
      id: `file-${Date.now()}`,
      name,
      path,
      language: name.endsWith('.rs') ? 'rust' : name.endsWith('.cpp') ? 'cpp' : name.endsWith('.go') ? 'go' : name.endsWith('.json') ? 'json' : 'typescript',
      content: `// Tệp mã nguồn mới: ${name}\n`,
      encrypted: true,
      securityHash: `sha256-${Date.now().toString(16)}`
    };

    setProjects(prev => prev.map(proj => {
      if (proj.id !== activeProjectId) return proj;
      return {
        ...proj,
        files: [...proj.files, newFile]
      };
    }));
    notify(`Đã tạo tệp mã nguồn mới: ${name}`);
  };

  const handleDeleteFile = (fileId: string) => {
    setProjects(prev => prev.map(proj => {
      if (proj.id !== activeProjectId) return proj;
      return {
        ...proj,
        files: proj.files.filter(f => f.id !== fileId)
      };
    }));
    notify('Đã xóa tệp mã nguồn khỏi cây dự án');
  };

  // Đăng ký tệp nhị phân đã đóng gói
  const handleAddArtifact = (artifact: BuildArtifact) => {
    setProjects(prev => prev.map(proj => {
      if (proj.id !== activeProjectId) return proj;
      const latestRel = proj.releases[0];
      if (!latestRel) return proj;

      const updatedReleases = [
        {
          ...latestRel,
          artifacts: [artifact, ...latestRel.artifacts.filter(a => a.id !== artifact.id)]
        },
        ...proj.releases.slice(1)
      ];

      return {
        ...proj,
        releases: updatedReleases
      };
    }));
  };

  // Xuất bản bản phát hành mới
  const handlePublishRelease = (release: ReleaseVersion) => {
    setProjects(prev => prev.map(proj => {
      if (proj.id !== activeProjectId) return proj;
      return {
        ...proj,
        currentVersion: release.version,
        releases: [release, ...proj.releases]
      };
    }));
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
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
      />

      {/* Khung nội dung chính: Tách biệt hoàn toàn giữa Quản trị và Trang chủ Tải về */}
      <main className="flex-1 flex overflow-hidden">
        {activeMode === 'studio' ? (
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
            onNotify={notify}
          />
        ) : (
          <DownloadPortalView
            project={activeProject}
            projects={projects}
            onSelectProject={(p) => setActiveProjectId(p.id)}
            detectedOS={detectedOS}
            onNotify={notify}
          />
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
