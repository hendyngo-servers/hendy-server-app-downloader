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

test('default deployment config declares separate Portal/Admin routes and Cloudflare API', () => {
  const config = getDefaultDeploymentConfig();
  assert.equal(config.routes.length, 2);
  assert.equal(config.routes[0].targetView, 'studio');
  assert.equal(config.routes[1].targetView, 'downloads');
  assert.notEqual(config.routes[0].subdomain, config.routes[1].subdomain);
  assert.equal(config.apiEndpoint, '/api/v1/admin/domain-routes');
  assert.match(config.kvNamespace, /Cloudflare D1/);
});

test('Worker config uses Cloudflare assets, D1 and R2 without an origin backend', () => {
  const toml = generateWranglerConfig(getDefaultDeploymentConfig());
  assert.match(toml, /main = "worker\/index\.ts"/);
  assert.match(toml, /\[\[d1_databases\]\]/);
  assert.match(toml, /binding = "DB"/);
  assert.match(toml, /migrations\/d1/);
  assert.match(toml, /\[\[r2_buckets\]\]/);
  assert.match(toml, /binding = "ARTIFACTS"/);
  assert.doesNotMatch(toml, /BACKEND_ORIGIN|DATABASE_URL|Render|PostgreSQL/);
});

test('Pages Functions execute the same native D1/R2 API', () => {
  const code = generatePagesFunctionsRoute();
  assert.match(code, /dispatchApi/);
  assert.match(code, /worker\/api-core/);
  assert.doesNotMatch(code, /BACKEND_ORIGIN|fetch\(new Request/);
});

test('Cloudflare workflow template validates and deploys Pages without external backend', () => {
  const yaml = generateGitHubWorkflowYaml(getDefaultDeploymentConfig());
  assert.match(yaml, /cloudflare\/wrangler-action/);
  assert.match(yaml, /pages deploy dist/);
  assert.match(yaml, /CLOUDFLARE_API_TOKEN/);
  assert.doesNotMatch(yaml, /RENDER_BACKEND_ORIGIN|Render|PostgreSQL/);
});

test('directory tree describes the Cloudflare-native architecture', () => {
  const tree = getWorkersPagesDirectoryTree();
  assert.equal(tree.type, 'directory');
  const fileNames = tree.children?.map(c => c.name);
  assert.ok(fileNames?.includes('wrangler.toml'));
  assert.ok(fileNames?.includes('functions'));
  assert.ok(fileNames?.includes('worker'));
  assert.ok(fileNames?.includes('.github'));
  assert.ok(fileNames?.includes('migrations/d1'));
});

test('architecture description documents native Cloudflare data services', () => {
  const md = generateSystemArchitectureMarkdown(getDefaultDeploymentConfig());
  assert.match(md, /Cloudflare Worker/);
  assert.match(md, /Cloudflare D1 metadata/);
  assert.match(md, /Cloudflare R2 private artifact bucket/);
  assert.doesNotMatch(md, /Render Free|PostgreSQL/);
});

test('security report describes real controls without unsupported guarantees', () => {
  const audit = getSecurityAuditReport();
  assert.match(audit.sourceEncryption, /Cloudflare encrypted Worker secrets/);
  assert.match(audit.interfaceIsolation, /mandatory API session authorization/);
  assert.match(audit.apiGatewayProtection, /Bearer sessions/);
  assert.match(audit.distributionStorage, /Cloudflare D1 metadata.*Cloudflare R2/);
  assert.doesNotMatch(audit.sourceCodeExposureRisk, /0\.00%/);
});
