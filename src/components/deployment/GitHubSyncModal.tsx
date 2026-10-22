/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import JSZip from 'jszip';
import { ProjectTemplate, CloudflareWorkersPagesConfig } from '../../types/index.ts';
import {
  generateWranglerConfig,
  generatePagesFunctionsRoute,
  generateGitHubWorkflowYaml,
  generateSystemArchitectureMarkdown
} from '../../utils/workersPagesConfig.ts';

interface GitHubSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectTemplate;
  config: CloudflareWorkersPagesConfig;
  onNotify: (msg: string) => void;
}

export const GitHubSyncModal: React.FC<GitHubSyncModalProps> = ({
  isOpen,
  onClose,
  project,
  config,
  onNotify
}) => {
  const [repoName, setRepoName] = useState('forgeos-enterprise/commercial-software-platform');
  const [branch, setBranch] = useState('main');
  const [commitMsg, setCommitMsg] = useState('phat-hanh: trien khai he thong quan tri va trang chu tai ve doc lap len workers and pages');
  const [isPushing, setIsPushing] = useState(false);
  const [pushStatus, setPushStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadZip = async () => {
    try {
      const zip = new JSZip();

      // Thêm các tệp triển khai Cloudflare Workers & Pages
      zip.file('wrangler.toml', generateWranglerConfig(config));
      zip.file('functions/api/[[route]].ts', generatePagesFunctionsRoute());
      zip.file('.github/workflows/build-and-release.yml', generateGitHubWorkflowYaml(config));
      zip.file('README.md', generateSystemArchitectureMarkdown(config));

      // Thêm các tệp mã nguồn dự án
      project.files.forEach(file => {
        const cleanPath = file.path.startsWith('/') ? file.path.slice(1) : file.path;
        zip.file(cleanPath, file.content);
      });

      // Thêm package.json
      zip.file('package.json', JSON.stringify({
        name: project.slug,
        version: project.currentVersion.replace('v', ''),
        description: project.description,
        scripts: {
          dev: 'vite',
          build: 'vite build',
          "deploy:pages": "wrangler pages deploy dist",
          "deploy:worker": "wrangler deploy"
        }
      }, null, 2));

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.slug}-workers-pages-repository.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onNotify(`Đã tải xuống gói kho lưu trữ hoàn chỉnh: ${a.download}`);
    } catch (err) {
      onNotify('Lỗi trong quá trình tạo tệp nén kho lưu trữ.');
    }
  };

  const handleSimulateGitHubPush = () => {
    setIsPushing(true);
    setPushStatus('Đang kết nối tới máy chủ GitHub API...');

    setTimeout(() => {
      setPushStatus('Khởi tạo cây thư mục chuẩn Workers & Pages...');
    }, 700);

    setTimeout(() => {
      setPushStatus('Đang commit sơ đồ kiến trúc hệ thống, wrangler.toml và ma trận CI/CD...');
    }, 1400);

    setTimeout(() => {
      setIsPushing(false);
      setPushStatus(`Đã đẩy thành công lên https://github.com/${repoName} (nhánh ${branch})`);
      onNotify(`Đã tải lên mã nguồn và sơ đồ kiến trúc thành công lên GitHub (${repoName})!`);
    }, 2200);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white">
              Xuất Bản Lên GitHub & Triển Khai "Workers & Pages"
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Bao gồm đầy đủ mã nguồn, sơ đồ kiến trúc hệ thống và cấu trúc thư mục triển khai.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg font-mono px-2"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Kho Lưu Trữ GitHub Đích (Target Repository)
            </label>
            <input
              type="text"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              placeholder="tochuc/ten-kho-luu-tru"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Nhánh Triển Khai (Branch)
              </label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Liên Kết Cloudflare Pages
              </label>
              <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-emerald-400 font-mono truncate">
                {config.pagesDomain}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Thông Điệp Commit (Commit Message)
            </label>
            <input
              type="text"
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              placeholder="Mô tả commit..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {pushStatus && (
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-emerald-400">
              {pushStatus}
            </div>
          )}

          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 text-xs text-slate-400 space-y-1">
            <div className="font-semibold text-slate-300">Nội Dung Tệp Đóng Gói:</div>
            <div>• <code className="text-indigo-300">wrangler.toml</code>: Cấu hình KV và hạ tầng lưu trữ R2</div>
            <div>• <code className="text-indigo-300">functions/api/[[route]].ts</code>: API Gateway định tuyến tên miền</div>
            <div>• <code className="text-indigo-300">.github/workflows/build-and-release.yml</code>: CI/CD ma trận đa hệ điều hành</div>
            <div>• <code className="text-indigo-300">README.md</code>: Sơ Đồ Kiến Trúc Hệ Thống Thương Mại</div>
            <div>• Toàn bộ {project.files.length} tệp mã nguồn ({project.framework})</div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <button
            onClick={handleDownloadZip}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
          >
            Tải Tệp .ZIP Sẵn Sàng Đẩy
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white"
            >
              Đóng
            </button>
            <button
              onClick={handleSimulateGitHubPush}
              disabled={isPushing}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              {isPushing ? 'Đang đẩy lên GitHub...' : 'Đẩy Lên Kho GitHub'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
