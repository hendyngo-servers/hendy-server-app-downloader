/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SourceFile } from '../../types/index.ts';

interface CodeEditorProps {
  activeFile: SourceFile | null;
  onUpdateContent: (content: string) => void;
  onQuickRun: () => void;
  isCompiling: boolean;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  activeFile,
  onUpdateContent,
  onQuickRun,
  isCompiling
}) => {
  const [content, setContent] = useState('');
  const [lineCount, setLineCount] = useState(1);

  useEffect(() => {
    if (activeFile) {
      setContent(activeFile.content);
      setLineCount(activeFile.content.split('\n').length);
    }
  }, [activeFile]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    setLineCount(val.split('\n').length);
    onUpdateContent(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newText = content.substring(0, start) + '  ' + content.substring(end);
      setContent(newText);
      onUpdateContent(newText);
      setTimeout(() => {
        if (e.currentTarget) {
          e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  if (!activeFile) {
    return (
      <div className="flex-1 bg-slate-950 flex items-center justify-center text-slate-500 text-sm">
        Vui lòng chọn một tệp từ Cấu Trúc Mã Nguồn bên trái để bắt đầu chỉnh sửa.
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-950 flex flex-col h-full overflow-hidden">
      {/* Thanh tác vụ trên của trình soạn thảo */}
      <div className="h-10 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-300 font-medium">
            {activeFile.path}
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-[11px] text-slate-500 font-mono">
            {activeFile.language.toUpperCase()}
          </span>
          {activeFile.encrypted && (
            <>
              <span className="text-slate-600">·</span>
              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60">
                AES-256 Đã Niêm Phong
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-500 font-mono">
            {lineCount} dòng · {content.length} ký tự
          </span>
          <button
            onClick={onQuickRun}
            disabled={isCompiling}
            className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              isCompiling
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
            }`}
          >
            <span>{isCompiling ? 'Đang kiểm tra & biên dịch...' : 'Kiểm Tra Cú Pháp & Biên Dịch Thử'}</span>
          </button>
        </div>
      </div>

      {/* Vùng soạn thảo mã nguồn và số dòng */}
      <div className="flex-1 flex overflow-hidden font-mono text-xs">
        {/* Cột đánh số dòng */}
        <div className="w-12 bg-slate-950/70 border-r border-slate-800/80 text-right pr-3 pt-3 text-slate-600 select-none overflow-hidden shrink-0">
          {Array.from({ length: Math.max(lineCount, 1) }).map((_, idx) => (
            <div key={idx} className="leading-5 h-5 text-[11px] font-mono">
              {idx + 1}
            </div>
          ))}
        </div>

        {/* Khung nhập liệu mã nguồn */}
        <textarea
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          className="flex-1 bg-transparent text-slate-200 p-3 leading-5 h-5 resize-none outline-none overflow-auto font-mono selection:bg-indigo-500/30 whitespace-pre font-normal"
          style={{ height: '100%', lineHeight: '1.25rem' }}
        />
      </div>
    </div>
  );
};
