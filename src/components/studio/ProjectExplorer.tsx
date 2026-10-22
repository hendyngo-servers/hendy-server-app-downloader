/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ProjectTemplate, SourceFile } from '../../types/index.ts';

interface ProjectExplorerProps {
  projects: ProjectTemplate[];
  activeProject: ProjectTemplate;
  onSelectProject: (project: ProjectTemplate) => void;
  activeFile: SourceFile | null;
  onSelectFile: (file: SourceFile) => void;
  onAddFile: (name: string, path: string) => void;
  onDeleteFile: (fileId: string) => void;
}

export const ProjectExplorer: React.FC<ProjectExplorerProps> = ({
  projects,
  activeProject,
  onSelectProject,
  activeFile,
  onSelectFile,
  onAddFile,
  onDeleteFile
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  const handleCreateFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    const cleanName = newFileName.trim();
    const path = `/${cleanName}`;
    onAddFile(cleanName, path);
    setNewFileName('');
    setIsAdding(false);
  };

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full shrink-0 select-none">
      {/* Bộ chọn dự án phần mềm */}
      <div className="p-3 border-b border-slate-800">
        <label className="text-[11px] font-semibold text-slate-400 block mb-1 uppercase tracking-wider">
          Phần Mềm Đang Quản Trị
        </label>
        <select
          value={activeProject.id}
          onChange={(e) => {
            const p = projects.find(item => item.id === e.target.value);
            if (p) onSelectProject(p);
          }}
          className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200 font-medium focus:outline-none focus:border-indigo-500"
        >
          {projects.map((proj) => (
            <option key={proj.id} value={proj.id}>
              {proj.name} ({proj.currentVersion})
            </option>
          ))}
        </select>
        <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
          <span>{activeProject.framework}</span>
          <span className="font-mono text-slate-500 truncate max-w-[120px]">{activeProject.bundleIdentifier}</span>
        </div>
      </div>

      {/* Danh sách tệp mã nguồn */}
      <div className="px-3 py-2 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <span className="font-semibold uppercase tracking-wider text-[11px]">Cấu Trúc Mã Nguồn</span>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="text-indigo-400 hover:text-indigo-300 text-xs font-medium px-1.5 py-0.5 rounded hover:bg-slate-800"
          title="Tạo tệp mã nguồn mới"
        >
          + Thêm Tệp
        </button>
      </div>

      {/* Biểu mẫu tạo tệp */}
      {isAdding && (
        <form onSubmit={handleCreateFile} className="p-2 border-b border-slate-800 bg-slate-950">
          <input
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="Ví dụ: config.json"
            autoFocus
            className="w-full bg-slate-900 border border-indigo-500/50 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
          />
          <div className="flex justify-end gap-1.5 mt-1.5">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-[11px] text-slate-400 hover:text-slate-200 px-2 py-0.5"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="text-[11px] bg-indigo-600 text-white rounded px-2.5 py-0.5 font-medium hover:bg-indigo-500"
            >
              Tạo
            </button>
          </div>
        </form>
      )}

      {/* Danh sách tệp */}
      <div className="flex-1 overflow-y-auto py-1">
        {activeProject.files.map((file) => {
          const isSelected = activeFile?.id === file.id;
          return (
            <div
              key={file.id}
              onClick={() => onSelectFile(file)}
              className={`group flex items-center justify-between px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-indigo-950/70 text-indigo-300 border-l-2 border-indigo-500'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <span className="text-slate-500 font-mono text-[11px]">
                  {file.name.endsWith('.rs') ? '🦀' : file.name.endsWith('.cpp') ? '⚡' : file.name.endsWith('.go') ? '🔷' : file.name.endsWith('.json') ? '⚙️' : '📄'}
                </span>
                <span className="truncate">{file.name}</span>
                {file.isEntry && (
                  <span className="text-[10px] text-indigo-400 font-mono">chính</span>
                )}
                {file.encrypted && (
                  <span className="text-[10px] text-emerald-400" title="Được bảo vệ mã hóa">🔒</span>
                )}
              </div>
              {activeProject.files.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteFile(file.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 text-xs px-1"
                  title="Xóa tệp"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Nền tảng biên dịch đã sẵn sàng */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/50">
        <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider block mb-1.5">
          Nền Tảng Biên Dịch Hỗ Trợ
        </span>
        <div className="flex flex-wrap gap-1 text-[11px] text-slate-400">
          {activeProject.platforms.filter(p => p.enabled).map(p => (
            <span key={p.platform} className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-300 font-mono">
              {p.platform}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
