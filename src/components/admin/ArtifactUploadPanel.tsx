/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { ProjectTemplate, TargetPlatform, ArchType } from '../../types/index.ts';
import { formatBytes, getPlatformVietnameseName } from '../../utils/packaging.ts';

interface ArtifactUploadPanelProps {
  projects: ProjectTemplate[];
  activeProject: ProjectTemplate;
  onSelectProject: (p: ProjectTemplate) => void;
  adminToken: string;
  onNotify: (msg: string) => void;
  onRefreshData: () => void;
}

export const ArtifactUploadPanel: React.FC<ArtifactUploadPanelProps> = ({
  projects,
  activeProject,
  onSelectProject,
  adminToken,
  onNotify,
  onRefreshData
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [version, setVersion] = useState<string>(activeProject.currentVersion || '2.4.0');
  const [platform, setPlatform] = useState<TargetPlatform>('windows');
  const [arch, setArch] = useState<ArchType>('x86_64');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [manifestData, setManifestData] = useState<any>(null);
  const [isLoadingManifest, setIsLoadingManifest] = useState<boolean>(false);
  const [recentUpload, setRecentUpload] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tải dữ liệu Manifest từ máy chủ
  const fetchManifest = async () => {
    setIsLoadingManifest(true);
    try {
      const res = await fetch('/api/v1/admin/manifest.json', {
        headers: { Authorization: `Bearer ${adminToken}` },
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        setManifestData(data);
      }
    } catch {
      // Bỏ qua lỗi kết nối tạm thời
    } finally {
      setIsLoadingManifest(false);
    }
  };

  useEffect(() => {
    fetchManifest();
  }, [activeProject.slug, adminToken]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const name = file.name.toLowerCase();
      if (name.endsWith('.exe') || name.endsWith('.msi')) setPlatform('windows');
      else if (name.endsWith('.dmg') || name.endsWith('.pkg')) setPlatform('macos');
      else if (name.endsWith('.appimage') || name.endsWith('.deb')) setPlatform('linux');
      else if (name.endsWith('.apk')) setPlatform('android');
      else if (name.endsWith('.ipa')) setPlatform('ios');
      else if (name.endsWith('.wasm')) setPlatform('web');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      onNotify('Vui lòng chọn một tệp đóng gói để tải lên kho.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(25);

    try {
      let data: any;
      const authHeaders = { Authorization: `Bearer ${adminToken}` };
      const directUploadThreshold = 45 * 1024 * 1024;

      if (selectedFile.size > directUploadThreshold) {
        // Avoid buffering very large packages in the Render Free web service.
        const requestUpload = await fetch('/api/v1/admin/artifact-upload-url', {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectSlug: activeProject.slug,
            version,
            filename: selectedFile.name,
            platform,
            format: selectedFile.name.substring(selectedFile.name.lastIndexOf('.')),
            arch
          })
        });
        const ticket = await requestUpload.json();
        if (!requestUpload.ok || !ticket.success || !ticket.uploadUrl || !ticket.ticketId) {
          throw new Error(ticket.error || 'Không thể tạo URL upload trực tiếp lên R2.');
        }

        setUploadProgress(35);
        const binaryUpload = await fetch(ticket.uploadUrl, {
          method: 'PUT',
          body: selectedFile
        });
        if (!binaryUpload.ok) {
          throw new Error('R2 từ chối upload (' + binaryUpload.status + '). Kiểm tra CORS bucket và quyền token.');
        }
        setUploadProgress(80);

        const register = await fetch('/api/v1/admin/register-artifact', {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticketId: ticket.ticketId })
        });
        data = await register.json();
        if (!register.ok || !data.success) {
          throw new Error(data.error || 'Đã upload nhưng không thể đăng ký artifact. Không công khai tệp cho đến khi đăng ký thành công.');
        }
      } else {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('projectSlug', activeProject.slug);
        formData.append('version', version);
        formData.append('platform', platform);
        formData.append('arch', arch);

        setUploadProgress(60);
        const res = await fetch('/api/v1/admin/upload-artifact', {
          method: 'POST',
          headers: authHeaders,
          body: formData
        });
        data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Tải lên kho thất bại.');
        }
      }

      setUploadProgress(100);
      setRecentUpload({
        ...data,
        directDownloadUrl: data.directDownloadUrl || data.artifact?.downloadUrl,
        message: 'Tải lên artifact thành công. Bản phát hành vẫn ở trạng thái nháp cho đến khi được xuất bản.'
      });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      onNotify(`Tải lên thành công! SHA-256: ${data.calculatedSha256.substring(0, 16)}...`);
      fetchManifest();
      onRefreshData();
    } catch (err: any) {
      onNotify(`Lỗi tải lên: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRegenerateManifest = async () => {
    try {
      onNotify('Đang quét lại toàn bộ kho tệp nhị phân trên máy chủ...');
      const res = await fetch('/api/v1/admin/generate-manifest', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchManifest();
        onNotify('Đã cập nhật lại manifest từ metadata và artifact lưu trữ.');
        onRefreshData();
      } else {
        throw new Error(data.error || 'Không thể tạo lại manifest');
      }
    } catch (err: any) {
      onNotify(`Lỗi: ${err.message}`);
    }
  };

  const currentAppManifest = manifestData?.apps?.[activeProject.slug];
  const currentArtifacts = currentAppManifest?.artifacts || [];

  return (
    <div className="flex-1 bg-slate-950 p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Tiêu đề & Chọn phần mềm */}
        <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <span className="text-indigo-400">📦</span>
              <span>Kho Lưu Trữ Nhị Phân & Quản Lý Manifest Tự Động</span>
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Tải lên các gói phát hành thực tế (.exe, .msi, .dmg, .AppImage, .apk), máy chủ tự động lưu vào kho, tính toán mã băm SHA-256 từ nội dung tệp và cập nhật manifest.json.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">Dự án:</span>
            <select
              value={activeProject.id}
              onChange={(e) => {
                const found = projects.find(p => p.id === e.target.value);
                if (found) onSelectProject(found);
              }}
              className="bg-slate-900 border border-slate-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Khối tải lên tệp mới (Upload Form) */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>⬆️</span>
              <span>Tải Lên Tệp Phát Hành Thực Tế Vào Kho Nhị Phân</span>
            </h3>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded border border-emerald-800/60">
              Quyền Quản Trị Viên Máy Chủ (Server-Verified)
            </span>
          </div>

          <form onSubmit={handleUpload} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Phiên Bản Phát Hành (Version)
                </label>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="2.4.0"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Hệ Điều Hành Mục Tiêu
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as TargetPlatform)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
                >
                  <option value="windows">Windows (.exe / .msi)</option>
                  <option value="macos">macOS (.dmg / .pkg)</option>
                  <option value="linux">Linux (.AppImage / .deb)</option>
                  <option value="android">Android (.apk)</option>
                  <option value="ios">iOS (.ipa)</option>
                  <option value="web">WebAssembly (.wasm)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Kiến Trúc Vi Xử Lý (Arch)
                </label>
                <select
                  value={arch}
                  onChange={(e) => setArch(e.target.value as ArchType)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                >
                  <option value="x86_64">x86_64 (Intel / AMD 64-bit)</option>
                  <option value="arm64">arm64 (Apple Silicon / ARM)</option>
                  <option value="universal">Universal (Universal Binary)</option>
                  <option value="wasm">wasm (WebAssembly)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Chọn Tệp Nhị Phân (.exe, .dmg, .apk, .AppImage...)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  accept=".exe,.msi,.dmg,.pkg,.AppImage,.deb,.apk,.ipa,.wasm,.zip"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-300 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                />
              </div>
            </div>

            {selectedFile && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-3">
                  <span className="text-emerald-400 font-bold">📄 {selectedFile.name}</span>
                  <span className="text-slate-400">({formatBytes(selectedFile.size)})</span>
                  <span className="text-indigo-400">Dự kiến SHA-256 sẽ được tính toán trực tiếp từ byte tệp này</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-slate-500 hover:text-white"
                >
                  Hủy
                </button>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400">
                Tệp nhị phân: <code className="text-indigo-300 font-mono">Cloudflare R2</code> · metadata: <code className="text-indigo-300 font-mono">PostgreSQL</code>
              </span>

              <button
                type="submit"
                disabled={isUploading || !selectedFile}
                className={`px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-md flex items-center gap-2 transition-all ${
                  isUploading || !selectedFile
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700'
                }`}
              >
                {isUploading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Đang Tải Lên & Tính Mã Băm ({uploadProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <span>Tải Lên Kho Nhị Phân & Tạo Manifest</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Kết quả tải lên vừa xong */}
          {recentUpload && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-800/80 rounded-xl space-y-2 text-xs">
              <div className="text-emerald-400 font-bold flex items-center gap-2">
                <span>✔</span>
                <span>{recentUpload.message || 'Tải lên thành công.'}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300 font-mono text-[11px]">
                <div>
                  <span className="text-slate-500">URL Tải Thực Tế: </span>
                  <a
                    href={recentUpload.directDownloadUrl}
                    className="text-indigo-300 underline font-semibold hover:text-white"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {recentUpload.directDownloadUrl}
                  </a>
                </div>
                <div>
                  <span className="text-slate-500">Mã Băm SHA-256: </span>
                  <span className="text-emerald-400 break-all">{recentUpload.calculatedSha256}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Danh sách tệp nhị phân hiện có trong kho */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📁</span>
                <span>Tệp Phát Hành Thực Tế Trong Kho Cho {activeProject.name} ({currentArtifacts.length} tệp)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Các tệp này có thể tải trực tiếp qua HTTP. Nút tải về ở cổng người dùng trỏ trực tiếp đến URL này.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRegenerateManifest}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5"
              >
                <span>🔄</span>
                <span>Đồng Bộ Manifest Từ Database</span>
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {currentArtifacts.map((art: any) => (
              <div
                key={art.id || art.filename}
                className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-white text-sm">{art.filename}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-indigo-950 text-indigo-300 border border-indigo-800">
                      {art.platform}
                    </span>
                    <span className="text-slate-500">·</span>
                    <span className="text-slate-400 font-mono">{formatBytes(art.sizeBytes)}</span>
                    <span className="text-slate-500">·</span>
                    <span className="text-slate-400 font-mono">v{art.version}</span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 flex-wrap">
                    <span className="text-slate-500">SHA-256:</span>
                    <span className="text-emerald-400">{art.sha256}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={art.url || art.downloadUrl}
                    download={art.filename}
                    className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow-sm flex items-center gap-1"
                  >
                    <span>⬇</span>
                    <span>Tải Về Trực Tiếp</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Khung xem trước tệp Manifest JSON */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📋</span>
                <span>Tệp Manifest Định Danh (manifest.json)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Chứa đầy đủ thông tin: version, platform, file size, URL thực tế và SHA-256 hash tính toán từ file.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="/api/v1/admin/manifest.json"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-mono"
              >
                Mở manifest quản trị /api/v1/admin/manifest.json ↗
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(manifestData, null, 2));
                  onNotify('Đã sao chép nội dung manifest.json vào khay nhớ tạm!');
                }}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold"
              >
                Sao Chép JSON
              </button>
            </div>
          </div>

          <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-emerald-300 font-mono text-xs max-h-72 overflow-y-auto leading-relaxed">
            {manifestData ? JSON.stringify(manifestData, null, 2) : 'Đang tải manifest...'}
          </pre>
        </div>
      </div>
    </div>
  );
};
