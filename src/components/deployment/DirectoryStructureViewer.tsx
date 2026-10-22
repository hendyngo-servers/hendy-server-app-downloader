/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  getWorkersPagesDirectoryTree,
  generateWranglerConfig,
  generatePagesFunctionsRoute,
  generateGitHubWorkflowYaml,
  generateSystemArchitectureMarkdown,
  getDefaultDeploymentConfig,
  DirectoryNode
} from '../../utils/workersPagesConfig.ts';

interface DirectoryStructureViewerProps {
  onNotify: (msg: string) => void;
}

export const DirectoryStructureViewer: React.FC<DirectoryStructureViewerProps> = ({ onNotify }) => {
  const tree = getWorkersPagesDirectoryTree();
  const defaultConfig = getDefaultDeploymentConfig();
  const [selectedFile, setSelectedFile] = useState<string>('wrangler.toml');

  const fileContents: Record<string, string> = {
    'wrangler.toml': generateWranglerConfig(defaultConfig),
    'functions/api/[[route]].ts': generatePagesFunctionsRoute(),
    '.github/workflows/build-and-release.yml': generateGitHubWorkflowYaml(defaultConfig),
    'README.md': generateSystemArchitectureMarkdown(defaultConfig),
    'package.json': `{
  "name": "forgeos-commercial-platform",
  "private": true,
  "version": "2.4.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "deploy:pages": "wrangler pages deploy dist",
    "deploy:worker": "wrangler deploy"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240405.0",
    "wrangler": "^3.50.0"
  }
}`
  };

  const handleCopyCode = () => {
    const code = fileContents[selectedFile] || '';
    navigator.clipboard.writeText(code);
    onNotify(`Đã sao chép nội dung tệp ${selectedFile} vào khay nhớ tạm!`);
  };

  const renderTree = (node: DirectoryNode, depth = 0) => {
    const isDir = node.type === 'directory';
    const relativeKey = node.path.replace(/^\//, '');

    return (
      <div key={node.path} style={{ paddingLeft: `${depth * 14}px` }}>
        <div
          onClick={() => {
            if (!isDir && (fileContents[node.name] || fileContents[relativeKey])) {
              setSelectedFile(fileContents[node.name] ? node.name : relativeKey);
            }
          }}
          className={`flex items-center justify-between py-1 px-2 rounded text-xs transition-colors cursor-pointer ${
            selectedFile === node.name || selectedFile === relativeKey
              ? 'bg-indigo-950/70 text-indigo-300 font-semibold'
              : 'text-slate-300 hover:bg-slate-900'
          }`}
        >
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-slate-500 font-mono text-[11px]">
              {isDir ? '📁' : '📄'}
            </span>
            <span className="truncate">{node.name}</span>
          </div>
          {node.description && (
            <span className="text-[10px] text-slate-500 font-mono hidden sm:inline truncate max-w-[200px]">
              {node.description}
            </span>
          )}
        </div>
        {node.children?.map(child => renderTree(child, depth + 1))}
      </div>
    );
  };

  const activeContent = fileContents[selectedFile] || fileContents['wrangler.toml'];

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-base font-bold text-white">
            Cấu Trúc Thư Mục Triển Khai "Workers & Pages" Chuẩn Thương Mại
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Bố cục thư mục tiêu chuẩn với API Gateway định tuyến tên miền và CI/CD ma trận đa hệ điều hành.
          </p>
        </div>
        <button
          onClick={handleCopyCode}
          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium transition-colors"
        >
          Sao Chép Tệp Đang Chọn
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Cây thư mục bên trái */}
        <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-96 overflow-y-auto">
          <div className="text-[11px] font-mono font-semibold text-slate-400 mb-2 uppercase tracking-wider">
            Cấu Trúc Thư Mục Kho Lưu Trữ
          </div>
          {renderTree(tree)}
        </div>

        {/* Khung xem trước mã nguồn bên phải */}
        <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-lg p-3 flex flex-col max-h-96">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2">
            <span className="text-xs font-mono text-indigo-400 font-semibold">{selectedFile}</span>
            <span className="text-[11px] text-slate-500 font-mono">
              {activeContent.split('\n').length} dòng
            </span>
          </div>
          <pre className="flex-1 overflow-auto font-mono text-xs text-slate-300 leading-relaxed whitespace-pre selection:bg-indigo-500/30">
            {activeContent}
          </pre>
        </div>
      </div>
    </div>
  );
};
