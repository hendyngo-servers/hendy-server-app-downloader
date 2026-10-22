/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { ProjectTemplate } from '../../types/index.ts';

interface WebSandboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectTemplate;
}

export const WebSandboxModal: React.FC<WebSandboxModalProps> = ({
  isOpen,
  onClose,
  project
}) => {
  // Trạng thái dòng lệnh cho HyperTerminal
  const [terminalHistory, setTerminalHistory] = useState<string[]>([
    'Môi Trường WebAssembly Client ForgeOS v2.4.0',
    'Máy chủ ảo hóa: WebAssembly Core (32 luồng xử lý, hỗ trợ SIMD-128)',
    'Hộp cát thực thi: Cô lập an toàn trong trình duyệt, không rò rỉ mã nguồn',
    'Nhập "help", "sysinfo", "kiem-tra" hoặc "top" để tương tác.'
  ]);
  const [termInput, setTermInput] = useState('');

  // Trạng thái Canvas cho OmniCanvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [shapes, setShapes] = useState<{ id: number; type: string; x: number; y: number; color: string }[]>([
    { id: 1, type: 'rect', x: 50, y: 50, color: '#6366f1' },
    { id: 2, type: 'circle', x: 220, y: 120, color: '#10b981' }
  ]);

  // Trạng thái Vault cho VaultKey
  const [vaultEntries, setVaultEntries] = useState([
    { id: '1', site: 'dvc.gov.vn', username: 'chuyengia@forgeos.vn', passkey: 'FIDO2-ECC-P256-DA-DANG-KY' },
    { id: '2', site: 'cloudflare.com', username: 'quantri@forgeos.vn', passkey: 'KHOA-PHAN-CUNG-YUBIKEY-5' }
  ]);
  const [newSite, setNewSite] = useState('');

  useEffect(() => {
    if (project.id === 'proj-omnicanvas' && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        // Lưới kỹ thuật
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        for (let x = 0; x < canvasRef.current.width; x += 30) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvasRef.current.height);
          ctx.stroke();
        }
        for (let y = 0; y < canvasRef.current.height; y += 30) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvasRef.current.width, y);
          ctx.stroke();
        }

        // Hình vẽ
        shapes.forEach(shape => {
          ctx.fillStyle = shape.color;
          if (shape.type === 'rect') {
            ctx.fillRect(shape.x, shape.y, 80, 60);
          } else {
            ctx.beginPath();
            ctx.arc(shape.x, shape.y, 40, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }
    }
  }, [project.id, shapes, isOpen]);

  if (!isOpen) return null;

  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = termInput.trim().toLowerCase();
    if (!cmd) return;

    let response = '';
    if (cmd === 'help') {
      response = 'Các lệnh khả dụng: sysinfo, kiem-tra, top, clear, date, ping';
    } else if (cmd === 'sysinfo') {
      response = `Hệ điều hành: WebAssembly / V8 Sandbox Engine\nKiến trúc: wasm32-wasi / SIMD Tăng Tốc\nSố luồng tính toán: 8 Cores\nBộ nhớ cấp phát: 512MB Heap\nTần số quét: 60Hz Ổn Định`;
    } else if (cmd === 'kiem-tra') {
      response = 'Kiểm định bảo mật: ĐẠT CHUẨN THƯƠNG MẠI\nRủi ro rò rỉ mã nguồn: 0.00%\nChữ ký điện tử: DigiCert EV Code Signing Xác Thực';
    } else if (cmd === 'top') {
      response = 'PID  NGUOI_DUNG  CPU%  MEM%  TIEN_TRINH\n 1   system      0.4   12MB  forgeos-wasm-daemon\n 2   user        1.2   34MB  render_surface';
    } else if (cmd === 'ping') {
      response = '64 bytes phản hồi từ edge.cloudflare.workers.dev: icmp_seq=1 time=3.8 ms';
    } else if (cmd === 'clear') {
      setTerminalHistory([]);
      setTermInput('');
      return;
    } else {
      response = `Thực thi lệnh "${termInput}". Trạng thái: hoàn tất thành công (exit code 0).`;
    }

    setTerminalHistory(prev => [...prev, `$ ${termInput}`, response]);
    setTermInput('');
  };

  const handleAddCanvasShape = () => {
    const newShape = {
      id: Date.now(),
      type: shapes.length % 2 === 0 ? 'circle' : 'rect',
      x: 40 + Math.random() * 250,
      y: 40 + Math.random() * 150,
      color: ['#6366f1', '#10b981', '#f59e0b', '#ec4899'][Math.floor(Math.random() * 4)]
    };
    setShapes(prev => [...prev, newShape]);
  };

  const handleAddVaultEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSite.trim()) return;
    setVaultEntries(prev => [
      ...prev,
      {
        id: String(Date.now()),
        site: newSite.trim(),
        username: 'nguoidung@forgeos.vn',
        passkey: 'KHOA-FIDO2-SECURE-ENCLAVE'
      }
    ]);
    setNewSite('');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full flex flex-col h-[600px] overflow-hidden shadow-2xl">
        {/* Thanh tiêu đề cửa sổ ứng dụng mô phỏng */}
        <div className="h-12 bg-slate-950 border-b border-slate-800 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
            <span className="text-xs font-semibold text-white ml-2">
              {project.name} {project.currentVersion} (Môi Trường Chạy Thử WebAssembly Trực Tiếp)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-emerald-400 font-mono">Đang Chạy (WASM 60 FPS)</span>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-base font-mono px-2"
            >
              ×
            </button>
          </div>
        </div>

        {/* Nội dung hộp cát tùy biến theo từng ứng dụng */}
        <div className="flex-1 bg-slate-950 p-4 flex flex-col overflow-hidden">
          {project.id === 'proj-hyperterminal' && (
            <div className="flex-1 flex flex-col font-mono text-xs">
              <div className="flex-1 overflow-y-auto space-y-1 text-emerald-400 pr-2">
                {terminalHistory.map((item, idx) => (
                  <div key={idx} className="whitespace-pre-wrap leading-5">
                    {item}
                  </div>
                ))}
              </div>
              <form onSubmit={handleTerminalSubmit} className="flex gap-2 pt-3 border-t border-slate-800">
                <span className="text-slate-500 font-mono">$</span>
                <input
                  type="text"
                  value={termInput}
                  onChange={(e) => setTermInput(e.target.value)}
                  placeholder="Nhập 'help', 'sysinfo', 'kiem-tra'..."
                  autoFocus
                  className="flex-1 bg-transparent border-none outline-none text-white font-mono"
                />
                <button
                  type="submit"
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-emerald-400 rounded"
                >
                  Gửi
                </button>
              </form>
            </div>
          )}

          {project.id === 'proj-omnicanvas' && (
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs text-slate-300">
                  Bảng Vẽ Vector Đồ Họa ({shapes.length} thành phần xử lý bởi WebAssembly Skia)
                </span>
                <button
                  onClick={handleAddCanvasShape}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium"
                >
                  + Thêm Phần Tử Vector
                </button>
              </div>
              <div className="flex-1 pt-3 flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  width={650}
                  height={380}
                  className="border border-slate-800 rounded-lg shadow-inner bg-slate-950"
                />
              </div>
            </div>
          )}

          {project.id === 'proj-vaultkey' && (
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs text-slate-300">
                  Két Sắt Bảo Mật Khóa Passkey Phần Cứng (Mã Hóa AES-256-GCM)
                </span>
                <span className="text-xs font-mono text-emerald-400">Trạng Thái: Đã Mở Khóa An Toàn</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 py-3">
                {vaultEntries.map(entry => (
                  <div
                    key={entry.id}
                    className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-white">{entry.site}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{entry.username}</div>
                    </div>
                    <span className="font-mono text-[11px] text-indigo-400 bg-indigo-950 px-2 py-1 rounded">
                      {entry.passkey}
                    </span>
                  </div>
                ))}
              </div>
              <form onSubmit={handleAddVaultEntry} className="flex gap-2 pt-3 border-t border-slate-800">
                <input
                  type="text"
                  value={newSite}
                  onChange={(e) => setNewSite(e.target.value)}
                  placeholder="Thêm tên miền dịch vụ mới (ví dụ: congthuong.gov.vn)..."
                  className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded"
                >
                  Lưu Passkey
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
