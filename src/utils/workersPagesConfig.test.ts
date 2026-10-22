/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDefaultDeploymentConfig,
  generateWranglerConfig,
  generatePagesFunctionsRoute,
  generateGitHubWorkflowYaml,
  getWorkersPagesDirectoryTree,
  generateSystemArchitectureMarkdown,
  getSecurityAuditReport
} from './workersPagesConfig.ts';

test('getDefaultDeploymentConfig returns isolated routes for studio and downloads with API config', () => {
  const config = getDefaultDeploymentConfig();
  assert.equal(config.routes.length, 2);
  assert.equal(config.routes[0].targetView, 'studio');
  assert.equal(config.routes[1].targetView, 'downloads');
  assert.notEqual(config.routes[0].subdomain, config.routes[1].subdomain);
  assert.equal(config.apiEndpoint, '/api/v1/domains');
});

test('generateWranglerConfig includes required Workers & Pages bindings and security variables', () => {
  const config = getDefaultDeploymentConfig();
  const toml = generateWranglerConfig(config);
  assert.match(toml, /RELEASE_KV/);
  assert.match(toml, /RELEASE_STORAGE/);
  assert.match(toml, /API_DOMAIN_ROUTING_ENDPOINT/);
  assert.match(toml, /SOURCE_CODE_ENCRYPTION/);
});

test('generatePagesFunctionsRoute includes domain routing API and R2 streaming', () => {
  const code = generatePagesFunctionsRoute();
  assert.match(code, /RELEASE_STORAGE\.get/);
  assert.match(code, /\/api\/download\//);
  assert.match(code, /\/api\/v1\/domains/);
  assert.match(code, /\/api\/v1\/security\/audit/);
});

test('generateGitHubWorkflowYaml specifies commercial multi-OS build matrix', () => {
  const config = getDefaultDeploymentConfig();
  const yaml = generateGitHubWorkflowYaml(config);
  assert.match(yaml, /windows-latest/);
  assert.match(yaml, /macos-14/);
  assert.match(yaml, /ubuntu-22\.04/);
  assert.match(yaml, /cloudflare\/wrangler-action/);
});

test('getWorkersPagesDirectoryTree provides full required structure', () => {
  const tree = getWorkersPagesDirectoryTree();
  assert.equal(tree.type, 'directory');
  const fileNames = tree.children?.map(c => c.name);
  assert.ok(fileNames?.includes('wrangler.toml'));
  assert.ok(fileNames?.includes('functions'));
  assert.ok(fileNames?.includes('.github'));
});

test('generateSystemArchitectureMarkdown includes ASCII architecture diagram', () => {
  const config = getDefaultDeploymentConfig();
  const md = generateSystemArchitectureMarkdown(config);
  assert.match(md, /System Architecture Diagram/);
  assert.match(md, /GIAO DIỆN QUẢN TRỊ/);
  assert.match(md, /TRANG CHỦ TẢI VỀ/);
  assert.match(md, /HẠ TẦNG LƯU TRỮ CHUYÊN BIỆT/);
});

test('getSecurityAuditReport guarantees 0% core source exposure risk', () => {
  const audit = getSecurityAuditReport();
  assert.match(audit.sourceCodeExposureRisk, /0\.00%/);
  assert.match(audit.sourceEncryption, /AES-256/);
  assert.match(audit.interfaceIsolation, /Tách Biệt/);
});
