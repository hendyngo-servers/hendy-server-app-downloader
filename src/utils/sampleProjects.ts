/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProjectTemplate } from '../types/index.ts';

export const SAMPLE_PROJECTS: ProjectTemplate[] = [
  {
    id: 'proj-hyperterminal',
    name: 'HyperTerminal Pro',
    slug: 'hyperterminal',
    tagline: 'Phần Mềm Giám Sát Hệ Thống & Giả Lập Terminal Đa Nền Tảng Tăng Tốc Phần Cứng',
    description: 'Ứng dụng giám sát tài nguyên CPU/GPU, luồng mạng thời gian thực và quản lý dòng lệnh đa phiên bản với độ trễ cực thấp cho mọi hệ điều hành máy tính và web.',
    category: 'Công Cụ Hệ Thống & Quản Trị',
    framework: 'Rust + Tauri',
    currentVersion: 'v2.4.0',
    bundleIdentifier: 'vn.forgeos.hyperterminal',
    publisher: 'ForgeOS Enterprise Việt Nam',
    websiteUrl: 'https://hyperterminal.forgeos.vn',
    githubRepo: 'https://github.com/forgeos-enterprise/hyperterminal-core',
    securityLevel: 'Enterprise High',
    files: [
      {
        id: 'file-tauri-conf',
        name: 'tauri.conf.json',
        path: '/src-tauri/tauri.conf.json',
        language: 'json',
        encrypted: true,
        securityHash: 'sha256-a19e83f2001c9a',
        content: `{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/tooling/cli/schema.json",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:3000",
    "distDir": "../dist"
  },
  "package": {
    "productName": "HyperTerminal",
    "version": "2.4.0"
  },
  "tauri": {
    "bundle": {
      "active": true,
      "targets": ["msi", "nsis", "dmg", "deb", "appimage"],
      "identifier": "vn.forgeos.hyperterminal",
      "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.icns", "icons/icon.ico"],
      "windows": {
        "certificateThumbprint": "EV_COMMERCIAL_CERT_VN_2026",
        "digestAlgorithm": "sha256",
        "wix": { "language": "vi-VN" }
      },
      "macOS": {
        "entitlements": "./entitlements.plist",
        "minimumSystemVersion": "11.0",
        "hardenedRuntime": true
      }
    },
    "windows": [
      {
        "title": "HyperTerminal Pro - Tiêu Chuẩn Thương Mại",
        "width": 1100,
        "height": 720,
        "resizable": true,
        "fullscreen": false
      }
    ]
  }
}`
      },
      {
        id: 'file-main-rs',
        name: 'main.rs',
        path: '/src-tauri/src/main.rs',
        language: 'rust',
        isEntry: true,
        encrypted: true,
        securityHash: 'sha256-b84719fbc901a',
        content: `// Ngăn chặn cửa sổ console phụ trên Windows trong bản phát hành thương mại
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{command, State};
use std::sync::Mutex;

struct TerminalState {
    active_sessions: Mutex<u32>,
}

#[command]
fn get_system_telemetry() -> serde_json::Value {
    serde_json::json!({
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "cores": num_cpus::get(),
        "status": "hoạt động ổn định",
        "security": "EV Signature Verified"
    })
}

#[command]
fn spawn_pty_session(shell: String) -> Result<String, String> {
    println!("Khởi tạo phiên PTY với shell bảo mật: {}", shell);
    Ok("session_pty_001_ready".into())
}

fn main() {
    tauri::Builder::default()
        .manage(TerminalState { active_sessions: Mutex::new(0) })
        .invoke_handler(tauri::generate_handler![get_system_telemetry, spawn_pty_session])
        .run(tauri::generate_context!())
        .expect("Lỗi trong quá trình khởi chạy phần mềm HyperTerminal");
}`
      },
      {
        id: 'file-cargo-toml',
        name: 'Cargo.toml',
        path: '/src-tauri/Cargo.toml',
        language: 'toml',
        content: `[package]
name = "hyperterminal"
version = "2.4.0"
description = "Phần mềm terminal đa nền tảng tăng tốc phần cứng"
edition = "2021"

[build-dependencies]
tauri-build = { version = "2.0.0", features = [] }

[dependencies]
tauri = { version = "2.0.0", features = ["tray-icon", "notification"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
num_cpus = "1.16"
portable-pty = "0.8"
`
      },
      {
        id: 'file-frontend-app',
        name: 'App.tsx',
        path: '/src/App.tsx',
        language: 'typescript',
        content: `import React, { useState } from 'react';

export default function HyperTerminalUI() {
  const [history, setHistory] = useState<string[]>([
    'HyperTerminal Pro v2.4.0 [x86_64/arm64-apple-darwin]',
    'Kết nối máy chủ: pty.local.0 - Trạng thái bảo mật cao',
    'Nhập "help", "sysinfo", "kiem-tra" hoặc "top" để bắt đầu.'
  ]);
  const [command, setCommand] = useState('');

  const executeCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;
    setHistory(prev => [...prev, \`$ \${command}\`, \`Thực thi lệnh '\${command}' thành công.\`]);
    setCommand('');
  };

  return (
    <div className="bg-slate-950 text-emerald-400 font-mono p-4 rounded-lg h-full flex flex-col">
      <div className="flex-1 overflow-y-auto space-y-1">
        {history.map((line, idx) => (
          <div key={idx}>{line}</div>
        ))}
      </div>
      <form onSubmit={executeCommand} className="flex gap-2 pt-2 border-t border-slate-800">
        <span className="text-slate-500">$</span>
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Nhập lệnh thực thi..."
          className="bg-transparent border-none outline-none flex-1 text-slate-100"
        />
      </form>
    </div>
  );
}`
      }
    ],
    platforms: [
      {
        platform: 'windows',
        displayName: 'Windows (10 / 11 / Server 64-bit)',
        iconName: 'windows',
        enabled: true,
        selectedArch: 'x86_64',
        selectedFormat: '.exe',
        signingEnabled: true,
        formats: [
          { format: '.exe', name: 'Trình Cài Đặt NSIS Tự Động', description: 'Gói cài đặt độc lập với lối tắt Desktop và Menu Start', defaultSelected: true, architectures: ['x86_64', 'arm64'] },
          { format: '.msi', name: 'Gói Doanh Nghiệp Windows (MSI)', description: 'Triển khai hàng loạt qua Active Directory / GPO', defaultSelected: false, architectures: ['x86_64'] }
        ]
      },
      {
        platform: 'macos',
        displayName: 'macOS (Apple Silicon & Intel Universal)',
        iconName: 'apple',
        enabled: true,
        selectedArch: 'universal',
        selectedFormat: '.dmg',
        signingEnabled: true,
        entitlements: ['com.apple.security.network.client', 'com.apple.security.files.user-selected.read-write'],
        formats: [
          { format: '.dmg', name: 'Đĩa Ảnh Apple Disk Image (DMG)', description: 'Kéo thả ứng dụng với hình nền hướng dẫn chuẩn Apple', defaultSelected: true, architectures: ['universal', 'arm64', 'x86_64'] },
          { format: '.pkg', name: 'Bộ Cài Đặt Hệ Thống (.pkg)', description: 'Cài đặt tự động không cần can thiệp cho quản trị viên MDM', defaultSelected: false, architectures: ['universal'] }
        ]
      },
      {
        platform: 'linux',
        displayName: 'Linux (Ubuntu, Debian, Fedora, Arch)',
        iconName: 'linux',
        enabled: true,
        selectedArch: 'x86_64',
        selectedFormat: '.AppImage',
        signingEnabled: false,
        formats: [
          { format: '.AppImage', name: 'Gói Chạy Mọi Nơi AppImage', description: 'Nhấp đúp chuột để chạy ngay, tích hợp sẵn thư viện độc lập', defaultSelected: true, architectures: ['x86_64', 'arm64'] },
          { format: '.deb', name: 'Gói Cài Đặt Debian / Ubuntu (.deb)', description: 'Tích hợp kho quản trị apt-get và dpkg', defaultSelected: false, architectures: ['x86_64', 'arm64'] },
          { format: '.tar.gz', name: 'Tệp Nén Nhị Phân (.tar.gz)', description: 'Mã nhị phân trực tiếp cho máy chủ và môi trường CLI', defaultSelected: false, architectures: ['x86_64'] }
        ]
      },
      {
        platform: 'android',
        displayName: 'Android (Gói Cài Đặt Di Động)',
        iconName: 'android',
        enabled: true,
        selectedArch: 'arm64',
        selectedFormat: '.apk',
        signingEnabled: true,
        formats: [
          { format: '.apk', name: 'Tệp Ứng Dụng Android APK', description: 'Cài đặt trực tiếp hoặc nạp qua ADB/Google Play', defaultSelected: true, architectures: ['arm64'] }
        ]
      },
      {
        platform: 'web',
        displayName: 'Trình Duyệt Web (WASM & PWA)',
        iconName: 'globe',
        enabled: true,
        selectedArch: 'wasm',
        selectedFormat: '.wasm',
        signingEnabled: false,
        formats: [
          { format: '.wasm', name: 'Môi Trường Trực Tiếp WebAssembly', description: 'Chạy trực tiếp trong hộp cát trình duyệt, không cần cài đặt', defaultSelected: true, architectures: ['wasm'] }
        ]
      }
    ],
    releases: [
      {
        version: 'v2.4.0',
        tag: 'v2.4.0',
        releaseDate: '22 Tháng 10, 2026',
        channel: 'stable',
        title: 'Nâng Cấp Hiệu Năng GPU & Tương Thích Đa Nền Tảng Thương Mại',
        changelog: [
          'Hỗ trợ nhị phân Universal ARM64 cho Apple Silicon M-Series và Intel x86_64.',
          'Nâng cấp nhân PTY Rust 0.8 giảm 60% độ trễ nhập liệu dòng lệnh.',
          'Tích hợp chứng chỉ ký số thương mại EV Code Signing, loại bỏ cảnh báo SmartScreen.',
          'Đối soát mã băm SHA-256 tự động trên mọi tệp cài đặt phân phối.'
        ],
        published: true,
        artifacts: [
          {
            id: 'art-win-1',
            platform: 'windows',
            format: '.exe',
            arch: 'x86_64',
            filename: 'hyperterminal-v2.4.0-x86_64-setup.exe',
            sizeBytes: 42104832,
            sha256: '9f83a4c2810f4438b919a7384a205128dfac90348a274910cf981fcae0471b02',
            downloadUrl: '/api/download/hyperterminal-v2.4.0-x86_64-setup.exe',
            createdAt: '2026-10-22T08:00:00Z',
            verified: true,
            signatureInfo: {
              issuer: 'DigiCert EV Code Signing CA G3',
              certificateType: 'Extended Validation (EV)',
              timestamp: '2026-10-22T08:02:15Z',
              serialNumber: '7A49-8F12-BC34-99DE'
            }
          },
          {
            id: 'art-mac-1',
            platform: 'macos',
            format: '.dmg',
            arch: 'universal',
            filename: 'hyperterminal-v2.4.0-universal.dmg',
            sizeBytes: 51380224,
            sha256: 'a140d34b9213456cb049e29a3fa8d39201948fc20194bc028190283940192841',
            downloadUrl: '/api/download/hyperterminal-v2.4.0-universal.dmg',
            createdAt: '2026-10-22T08:05:00Z',
            verified: true,
            signatureInfo: {
              issuer: 'Apple Developer ID Application: ForgeOS VN',
              certificateType: 'Notarized by Apple Cloud (Ticket Attached)',
              timestamp: '2026-10-22T08:06:40Z',
              serialNumber: 'APPL-9921-X812-4412'
            }
          },
          {
            id: 'art-linux-1',
            platform: 'linux',
            format: '.AppImage',
            arch: 'x86_64',
            filename: 'hyperterminal-v2.4.0-x86_64.AppImage',
            sizeBytes: 47185920,
            sha256: '729b40128374a2b9102849182374918237498127394812374918273941823749',
            downloadUrl: '/api/download/hyperterminal-v2.4.0-x86_64.AppImage',
            createdAt: '2026-10-22T08:10:00Z',
            verified: true
          }
        ]
      }
    ]
  },
  {
    id: 'proj-omnicanvas',
    name: 'OmniCanvas Studio',
    slug: 'omnicanvas',
    tagline: 'Bộ Phần Mềm Thiết Kế Đồ Họa Vector & Dàn Trang Giao Diện Chuẩn Doanh Nghiệp',
    description: 'Công cụ vẽ vector chính xác cao, chỉnh sửa đường cong Bezier và thiết kế hệ thống UI/UX được biên dịch ra nhị phân máy tính và WebAssembly chạy mượt mà 60 FPS.',
    category: 'Đồ Họa & Thiết Kế Giao Diện',
    framework: 'C++ / Wasm',
    currentVersion: 'v1.8.2',
    bundleIdentifier: 'vn.forgeos.omnicanvas',
    publisher: 'Omni Design Systems VN',
    websiteUrl: 'https://omnicanvas.forgeos.vn',
    githubRepo: 'https://github.com/forgeos-enterprise/omnicanvas',
    securityLevel: 'Commercial Standard',
    files: [
      {
        id: 'file-cmakelists',
        name: 'CMakeLists.txt',
        path: '/CMakeLists.txt',
        language: 'cmake',
        content: `cmake_minimum_required(VERSION 3.22)
project(OmniCanvas VERSION 1.8.2 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(EMSCRIPTEN)
  add_executable(omnicanvas src/core/engine.cpp)
  set_target_properties(omnicanvas PROPERTIES LINK_FLAGS "-s WASM=1 -s USE_SDL=2 -O3")
else()
  add_executable(omnicanvas src/core/engine.cpp)
endif()
`
      },
      {
        id: 'file-engine-cpp',
        name: 'engine.cpp',
        path: '/src/core/engine.cpp',
        language: 'cpp',
        isEntry: true,
        encrypted: true,
        securityHash: 'sha256-c7719283749182',
        content: `#include <iostream>
#include <vector>

struct VectorNode {
    float x, y;
    float control_x1, control_y1;
    float control_x2, control_y2;
};

class CanvasEngine {
public:
    void render_path(const std::vector<VectorNode>& nodes) {
        std::cout << "Rendering Bezier curve with " << nodes.size() << " control points." << std::endl;
    }
};

int main() {
    std::cout << "OmniCanvas Vector Engine v1.8.2 khoi dong thanh cong." << std::endl;
    return 0;
}`
      }
    ],
    platforms: [
      {
        platform: 'windows',
        displayName: 'Windows (.exe / .msi)',
        iconName: 'windows',
        enabled: true,
        selectedArch: 'x86_64',
        selectedFormat: '.exe',
        signingEnabled: true,
        formats: [{ format: '.exe', name: 'Trình Cài Đặt NSIS', description: 'Bộ cài đặt chính thức cho Windows', defaultSelected: true, architectures: ['x86_64'] }]
      },
      {
        platform: 'macos',
        displayName: 'macOS (.dmg Universal)',
        iconName: 'apple',
        enabled: true,
        selectedArch: 'universal',
        selectedFormat: '.dmg',
        signingEnabled: true,
        formats: [{ format: '.dmg', name: 'Đĩa Ảnh DMG', description: 'Universal binary cho Apple Silicon và Intel', defaultSelected: true, architectures: ['universal'] }]
      },
      {
        platform: 'web',
        displayName: 'WebAssembly Trình Duyệt',
        iconName: 'globe',
        enabled: true,
        selectedArch: 'wasm',
        selectedFormat: '.wasm',
        signingEnabled: false,
        formats: [{ format: '.wasm', name: 'Gói WebAssembly', description: 'Chạy trực tiếp không cần cài đặt', defaultSelected: true, architectures: ['wasm'] }]
      }
    ],
    releases: [
      {
        version: 'v1.8.2',
        tag: 'v1.8.2',
        releaseDate: '20 Tháng 10, 2026',
        channel: 'stable',
        title: 'Tăng Tốc Đồ Họa Skia & Xuất Bản WebAssembly',
        changelog: [
          'Tăng tốc phần cứng Skia trên Metal (macOS) và DirectX 12 (Windows).',
          'Mô-đun WebAssembly tối ưu 60 FPS trong môi trường trình duyệt an toàn.'
        ],
        published: true,
        artifacts: [
          {
            id: 'art-omni-win',
            platform: 'windows',
            format: '.exe',
            arch: 'x86_64',
            filename: 'omnicanvas-v1.8.2-x86_64-setup.exe',
            sizeBytes: 68157440,
            sha256: '3819283749182739481928374918273948192837491827394819283749182739',
            downloadUrl: '/api/download/omnicanvas-v1.8.2-x86_64-setup.exe',
            createdAt: '2026-10-20T10:00:00Z',
            verified: true
          },
          {
            id: 'art-omni-mac',
            platform: 'macos',
            format: '.dmg',
            arch: 'universal',
            filename: 'omnicanvas-v1.8.2-universal.dmg',
            sizeBytes: 73400320,
            sha256: '4918273948192837491827394819283749182739481928374918273948192837',
            downloadUrl: '/api/download/omnicanvas-v1.8.2-universal.dmg',
            createdAt: '2026-10-20T10:05:00Z',
            verified: true
          }
        ]
      }
    ]
  },
  {
    id: 'proj-vaultkey',
    name: 'VaultKey Enterprise',
    slug: 'vaultkey',
    tagline: 'Két Sắt Bảo Mật Khóa Xác Thực Passkey & Bí Mật Doanh Nghiệp (Không Lưu Mật Khẩu Thô)',
    description: 'Hệ thống quản lý passkey sinh trắc học phần cứng FIDO2, mã hóa đầu cuối AES-256-GCM bảo vệ an toàn danh tính kỹ thuật số cho mọi hệ điều hành.',
    category: 'An Toàn Thông Tin & Bảo Mật',
    framework: 'Go / Wails',
    currentVersion: 'v3.1.0',
    bundleIdentifier: 'vn.forgeos.vaultkey',
    publisher: 'Forge Security Labs VN',
    websiteUrl: 'https://vaultkey.forgeos.vn',
    githubRepo: 'https://github.com/forgeos-enterprise/vaultkey',
    securityLevel: 'Military Grade',
    files: [
      {
        id: 'file-main-go',
        name: 'main.go',
        path: '/main.go',
        language: 'go',
        isEntry: true,
        encrypted: true,
        securityHash: 'sha256-991201948fc0',
        content: `package main

import (
	"embed"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()

	err := wails.Run(&options.App{
		Title:  "VaultKey Enterprise - Bao Mat Tuyet Doi",
		Width:  1024,
		Height: 700,
		Assets: assets,
		OnStartup: app.startup,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Loi:", err.Error())
	}
}
`
      }
    ],
    platforms: [
      {
        platform: 'windows',
        displayName: 'Windows (Tích Hợp Windows Hello TPM)',
        iconName: 'windows',
        enabled: true,
        selectedArch: 'x86_64',
        selectedFormat: '.exe',
        signingEnabled: true,
        formats: [{ format: '.exe', name: 'Gói Cài Đặt NSIS', description: 'Tích hợp mô-đun phần cứng TPM 2.0', defaultSelected: true, architectures: ['x86_64'] }]
      },
      {
        platform: 'macos',
        displayName: 'macOS (Tích Hợp Touch ID Secure Enclave)',
        iconName: 'apple',
        enabled: true,
        selectedArch: 'universal',
        selectedFormat: '.dmg',
        signingEnabled: true,
        formats: [{ format: '.dmg', name: 'Đĩa Ảnh DMG Universal', description: 'Bảo vệ bằng Apple Secure Enclave', defaultSelected: true, architectures: ['universal'] }]
      },
      {
        platform: 'linux',
        displayName: 'Linux (Hỗ Trợ libsecret / KeepassXC)',
        iconName: 'linux',
        enabled: true,
        selectedArch: 'x86_64',
        selectedFormat: '.AppImage',
        signingEnabled: false,
        formats: [{ format: '.AppImage', name: 'Gói AppImage', description: 'Chạy độc lập an toàn trên Linux', defaultSelected: true, architectures: ['x86_64'] }]
      }
    ],
    releases: [
      {
        version: 'v3.1.0',
        tag: 'v3.1.0',
        releaseDate: '18 Tháng 10, 2026',
        channel: 'stable',
        title: 'Đồng Bộ Hóa Khóa Xác Thực FIDO2 WebAuthn',
        changelog: [
          'Hỗ trợ khóa bảo mật phần cứng FIDO2 (YubiKey, Titan Key).',
          'Mã hóa két sắt tại máy khách bằng chuẩn AES-256-GCM với độ an toàn cao nhất.'
        ],
        published: true,
        artifacts: [
          {
            id: 'art-vault-win',
            platform: 'windows',
            format: '.exe',
            arch: 'x86_64',
            filename: 'vaultkey-v3.1.0-x86_64-setup.exe',
            sizeBytes: 31457280,
            sha256: '5819283749182739481928374918273948192837491827394819283749182739',
            downloadUrl: '/api/download/vaultkey-v3.1.0-x86_64-setup.exe',
            createdAt: '2026-10-18T09:00:00Z',
            verified: true
          }
        ]
      }
    ]
  }
];
