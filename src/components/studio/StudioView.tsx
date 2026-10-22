/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ProjectTemplate, SourceFile, BuildArtifact, ReleaseVersion, CloudflareWorkersPagesConfig } from '../../types/index.ts';
import { ProjectExplorer } from './ProjectExplorer.tsx';
import { CodeEditor } from './CodeEditor.tsx';
import { PackagingPipeline } from './PackagingPipeline.tsx';
import { ReleaseManager } from './ReleaseManager.tsx';
import { SecurityVaultPanel } from './SecurityVaultPanel.tsx';
import { SecurityScanner } from './SecurityScanner.tsx';
import { PipelineRunner } from './PipelineRunner.tsx';
import { AnalyticsDashboard } from './AnalyticsDashboard.tsx';
import { DomainApiConsole } from './DomainApiConsole.tsx';
import { ArtifactUploadPanel } from '../admin/ArtifactUploadPanel.tsx';
import { ArchitectureDiagram } from '../deployment/ArchitectureDiagram.tsx';
import { DirectoryStructureViewer } from '../deployment/DirectoryStructureViewer.tsx';

interface StudioViewProps {
  projects: ProjectTemplate[];
  activeProject: ProjectTemplate;
  onSelectProject: (p: ProjectTemplate) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onAddArtifact: (artifact: BuildArtifact) => void;
  onPublishRelease: (release: ReleaseVersion) => void;
  onUpdateFileContent: (fileId: string, content: string) => void;
  onAddFile: (name: string, path: string) => void;
  onDeleteFile: (fileId: string) => void;
  config: CloudflareWorkersPagesConfig;
  adminToken: string;
  onNotify: (msg: string) => void;
  onRefreshData: () => void;
}

export const StudioView: React.FC<StudioViewProps> = ({
  projects,
  activeProject,
  onSelectProject,
  activeTab,
  onTabChange,
  onAddArtifact,
  onPublishRelease,
  onUpdateFileContent,
  onAddFile,
  onDeleteFile,
  config,
  adminToken,
  onNotify,
  onRefreshData
}) => {
  const projectFiles = activeProject.files || [];
  const [activeFileId, setActiveFileId] = useState<string>(
    projectFiles[0]?.id || ''
  );
  const [isCompiling, setIsCompiling] = useState<boolean>(false);

  const activeFile = projectFiles.find(f => f.id === activeFileId) || projectFiles[0] || null;

  const handleQuickRun = () => {
    setIsCompiling(true);
    setTimeout(() => {
      setIsCompiling(false);
      onNotify(`Cú pháp hợp lệ! Không phát hiện lỗi trong ${activeProject.name} (${activeFile?.name})`);
    }, 800);
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-950">
      {/* Tab 1: Soạn thảo mã nguồn */}
      {activeTab === 'editor' && (
        <div className="flex-1 flex overflow-hidden">
          <ProjectExplorer
            projects={projects}
            activeProject={activeProject}
            onSelectProject={(p) => {
              onSelectProject(p);
              if (p.files[0]) setActiveFileId(p.files[0].id);
            }}
            activeFile={activeFile}
            onSelectFile={(f) => setActiveFileId(f.id)}
            onAddFile={onAddFile}
            onDeleteFile={onDeleteFile}
          />
          <CodeEditor
            activeFile={activeFile}
            onUpdateContent={(content) => {
              if (activeFile) onUpdateFileContent(activeFile.id, content);
            }}
            onQuickRun={handleQuickRun}
            isCompiling={isCompiling}
          />
        </div>
      )}

      {/* Tab Mới: Tải Lên Kho Nhị Phân & Manifest */}
      {activeTab === 'upload-artifacts' && (
        <ArtifactUploadPanel
          projects={projects}
          activeProject={activeProject}
          onSelectProject={onSelectProject}
          adminToken={adminToken}
          onNotify={onNotify}
          onRefreshData={onRefreshData}
        />
      )}

      {/* Tab 2: Luồng CI/CD Tự Động Hóa */}
      {activeTab === 'pipeline' && (
        <PipelineRunner
          project={activeProject}
          onNotify={onNotify}
        />
      )}

      {/* Tab 3: Đóng gói đa nền tảng */}
      {activeTab === 'packaging' && (
        <PackagingPipeline
          project={activeProject}
          onAddArtifact={onAddArtifact}
          onNotify={onNotify}
        />
      )}

      {/* Tab 4: Quản lý phiên bản phát hành */}
      {activeTab === 'releases' && (
        <ReleaseManager
          project={activeProject}
          onPublishRelease={onPublishRelease}
          onNotify={onNotify}
        />
      )}

      {/* Tab 5: Triển khai Cloudflare Workers & Pages */}
      {activeTab === 'deployment' && (
        <div className="flex-1 bg-slate-950 p-6 overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold text-white tracking-tight">
                Trung Tâm Triển Khai Cloudflare Workers & Pages
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Sơ đồ kiến trúc hạ tầng chuyên biệt, cổng API định tuyến tên miền động và cấu trúc thư mục triển khai.
              </p>
            </div>

            {/* Sơ đồ kiến trúc */}
            <ArchitectureDiagram />

            {/* Trình xem cấu trúc thư mục */}
            <DirectoryStructureViewer onNotify={onNotify} />
          </div>
        </div>
      )}

      {/* Tab 6: Quét Lỗ Hổng & An Toàn SAST */}
      {activeTab === 'scanner' && (
        <SecurityScanner
          project={activeProject}
          onNotify={onNotify}
        />
      )}

      {/* Tab 7: Bảo mật mã nguồn cốt lõi & Kiểm định thương mại */}
      {activeTab === 'security' && (
        <SecurityVaultPanel
          project={activeProject}
          config={config}
          onNotify={onNotify}
        />
      )}

      {/* Tab 8: Phân tích & Giám sát phân phối */}
      {activeTab === 'analytics' && (
        <AnalyticsDashboard
          project={activeProject}
          onNotify={onNotify}
        />
      )}

      {/* Tab 9: Cổng API Định Tuyến Tên Miền */}
      {activeTab === 'domain-api' && (
        <DomainApiConsole
          config={config}
          onNotify={onNotify}
        />
      )}
    </div>
  );
};
