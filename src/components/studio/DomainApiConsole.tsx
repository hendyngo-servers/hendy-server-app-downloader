/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CloudflareWorkersPagesConfig } from '../../types/index.ts';

interface DomainApiConsoleProps {
  config: CloudflareWorkersPagesConfig;
  onNotify: (msg: string) => void;
}

export const DomainApiConsole: React.FC<DomainApiConsoleProps> = ({
  config,
  onNotify
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'GET' | 'POST' | 'DELETE'>('GET');
  const [endpoint, setEndpoint] = useState<string>('/api/v1/domains');
  const [simulatedHost, setSimulatedHost] = useState<string>('quan-tri.forgeos.vn');
  const [responseStatus, setResponseStatus] = useState<number>(200);
  const [responseTimeMs, setResponseTimeMs] = useState<number>(12);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [requestBody, setRequestBody] = useState<string>(
    JSON.stringify(
      {
        subdomain: 'app',
        domain: 'doanhnghiep.vn',
        targetView: 'downloads',
        purpose: 'Cổng tải về riêng cho khách hàng doanh nghiệp'
      },
      null,
      2
    )
  );

  const [responseBody, setResponseBody] = useState<string>(
    JSON.stringify(
      {
        success: true,
        host: 'quan-tri.forgeos.vn',
        targetView: 'studio',
        isolation: {
          airGapped: true,
          accessRole: 'ADMIN_DEVELOPER_ONLY',
          sourceCodeSealed: true
        },
        dnsTarget: 'pages.forgeos.vn',
        ssl: 'ACTIVE_TLS_1_3',
        timestamp: new Date().toISOString()
      },
      null,
      2
    )
  );

  const handleSendRequest = () => {
    setIsExecuting(true);
    setTimeout(() => {
      setIsExecuting(false);
      setResponseTimeMs(Math.floor(Math.random() * 8) + 8);

      if (selectedMethod === 'GET') {
        if (endpoint === '/api/v1/domains') {
          setResponseStatus(200);
          setResponseBody(
            JSON.stringify(
              {
                success: true,
                count: config.routes.length,
                simulatedIncomingHost: simulatedHost,
                matchedRoute: config.routes.find(r => r.subdomain + '.' + r.domain === simulatedHost) || {
                  route: simulatedHost,
                  targetView: simulatedHost.includes('quan-tri') ? 'studio' : 'downloads',
                  isolation: 'AIR_GAPPED'
                },
                routes: config.routes
              },
              null,
              2
            )
          );
        } else {
          setResponseStatus(200);
          setResponseBody(
            JSON.stringify(
              {
                success: true,
                route: config.routes[0],
                edgeRegion: 'sin01 (Singapore / Edge PoP VN)'
              },
              null,
              2
            )
          );
        }
      } else if (selectedMethod === 'POST') {
        try {
          const parsed = JSON.parse(requestBody);
          setResponseStatus(201);
          setResponseBody(
            JSON.stringify(
              {
                success: true,
                message: 'Đã tạo bản ghi định tuyến API thành công trên Cloudflare Workers KV',
                createdRoute: {
                  ...parsed,
                  id: `route-custom-${Date.now()}`,
                  dnsType: 'CNAME',
                  dnsTarget: 'pages.forgeos.vn',
                  status: 'active',
                  sslStatus: 'active',
                  createdAt: new Date().toISOString()
                }
              },
              null,
              2
            )
          );
          onNotify(`Đã tạo cấu hình định tuyến cho ${parsed.subdomain}.${parsed.domain}!`);
        } catch {
          setResponseStatus(400);
          setResponseBody(
            JSON.stringify(
              {
                error: true,
                message: 'Cú pháp JSON Payload không hợp lệ. Vui lòng kiểm tra lại.'
              },
              null,
              2
            )
          );
        }
      } else {
        setResponseStatus(200);
        setResponseBody(
          JSON.stringify(
            {
              success: true,
              message: 'Đã vô hiệu hóa quy tắc định tuyến tên miền thành công.'
            },
            null,
            2
          )
        );
      }
    }, 450);
  };

  return (
    <div className="flex-1 bg-slate-950 p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Tiêu đề */}
        <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <span className="text-indigo-400">🌐</span>
              <span>Bảng Điều Khiển API Quản Trị Tên Miền & Phân Luồng</span>
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Thực thi và kiểm thử trực tiếp các API điều khiển tên miền, chứng chỉ SSL và quy tắc cách ly giao diện trên Cloudflare Workers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">Xác Thực:</span>
            <span className="px-2.5 py-1 rounded bg-indigo-950 border border-indigo-800 text-indigo-300 font-mono text-xs">
              Bearer forgesec_live_token
            </span>
          </div>
        </div>

        {/* Thanh yêu cầu HTTP (URL bar) */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center gap-3">
          <select
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value as any)}
            className="bg-slate-950 text-white font-mono text-xs px-3 py-2 rounded-lg border border-slate-700 font-bold focus:outline-none focus:border-indigo-500"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="DELETE">DELETE</option>
          </select>

          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            className="flex-1 bg-slate-950 text-slate-200 font-mono text-xs px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500 min-w-[200px]"
            placeholder="/api/v1/domains"
          />

          <button
            onClick={handleSendRequest}
            disabled={isExecuting}
            className={`px-5 py-2 rounded-lg text-xs font-bold text-white shadow-sm flex items-center gap-2 transition-colors ${
              isExecuting
                ? 'bg-indigo-900 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700'
            }`}
          >
            {isExecuting ? 'Đang gửi...' : 'Gửi Yêu Cầu API'}
          </button>
        </div>

        {/* Cấu hình tham số Header & Body */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cột trái: Request parameters */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center justify-between">
              <span>Tham Số Yêu Cầu (Request Setup)</span>
              <span className="text-[11px] font-mono text-slate-400">HTTP/2 Edge Stream</span>
            </h3>

            {/* Giả lập Host Header */}
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1">
                Giả lập Header [Host]:
              </label>
              <select
                value={simulatedHost}
                onChange={(e) => setSimulatedHost(e.target.value)}
                className="w-full bg-slate-950 text-white font-mono text-xs p-2.5 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
              >
                <option value="quan-tri.forgeos.vn">quan-tri.forgeos.vn (Giao Diện Quản Trị & Mã Nguồn)</option>
                <option value="tai-ve.forgeos.vn">tai-ve.forgeos.vn (Giao Diện Tải Về Công Khai)</option>
                <option value="app.customdomain.vn">app.customdomain.vn (Tên Miền Tùy Chỉnh)</option>
              </select>
            </div>

            {/* Request Body khi POST */}
            {selectedMethod === 'POST' && (
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">
                  JSON Body (Thêm Quy Tắc Tên Miền):
                </label>
                <textarea
                  rows={8}
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  className="w-full bg-slate-950 text-emerald-400 font-mono text-xs p-3 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            )}

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-2 text-xs text-slate-400">
              <div className="font-semibold text-slate-300">Quy Chuẩn An Toàn Tên Miền:</div>
              <ul className="list-disc list-inside space-y-1">
                <li>Tự động xác thực CNAME / A Record qua DNS-over-HTTPS.</li>
                <li>Khởi tạo chứng chỉ SSL Universal TLS 1.3 trong vòng 15 giây.</li>
                <li>Giao diện Quản trị yêu cầu xác thực JWT qua Cookie HttpOnly.</li>
              </ul>
            </div>
          </div>

          {/* Cột phải: Response Output */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white">Kết Quả Phản Hồi (Response)</h3>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    responseStatus < 300
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-rose-950 text-rose-400 border border-rose-800'
                  }`}
                >
                  {responseStatus} OK
                </span>
              </div>
              <span className="text-xs font-mono text-indigo-400">
                Độ trễ: {responseTimeMs}ms
              </span>
            </div>

            <pre className="bg-slate-950 text-indigo-200 font-mono text-xs p-4 rounded-xl border border-slate-800 overflow-x-auto max-h-[360px] leading-relaxed">
              {responseBody}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
