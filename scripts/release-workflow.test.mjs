import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("main push 和 PR 只测试构建而不发布", async () => {
  const workflow = await readFile(
    path.join(projectRoot, ".github", "workflows", "ci.yml"),
    "utf8",
  );

  assert.match(workflow, /push:/);
  assert.match(workflow, /- main/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /pnpm test/);
  assert.match(workflow, /pnpm desktop:build --no-sign/);
  assert.doesNotMatch(workflow, /tauri-apps\/tauri-action/);
  assert.doesNotMatch(workflow, /gh release/);
});

test("Beta 允许 unsigned Pre-release，正式版必须签名后发布", async () => {
  const workflow = await readFile(
    path.join(projectRoot, ".github", "workflows", "release-tauri.yml"),
    "utf8",
  );

  assert.match(workflow, /-beta\(\?:\\\.\\d\+\)\?\$/);
  assert.match(workflow, /Build unsigned beta pre-release/);
  assert.match(workflow, /prerelease: true/);
  assert.match(workflow, /--no-sign/);
  assert.match(workflow, /secrets\.WINDOWS_CERTIFICATE\b/);
  assert.match(workflow, /secrets\.WINDOWS_CERTIFICATE_PASSWORD\b/);
  assert.match(workflow, /Import-PfxCertificate/);
  assert.match(workflow, /certificateThumbprint/);
  assert.match(workflow, /releaseDraft: true/);
  assert.match(workflow, /Get-AuthenticodeSignature/);
  assert.match(workflow, /SignatureStatus\]::Valid/);
  assert.match(workflow, /gh release edit .* --draft=false/);

  const importStep = workflow.indexOf("Import Windows code-signing certificate");
  const buildStep = workflow.indexOf("Build signed stable release");
  const verifyStep = workflow.indexOf("Verify stable Authenticode signatures");
  const publishStep = workflow.indexOf("Publish verified stable release");

  assert.ok(importStep < buildStep);
  assert.ok(buildStep < verifyStep);
  assert.ok(verifyStep < publishStep);
});

test("Tauri 使用 SHA-256 和 RFC 3161 时间戳作为签名默认值", async () => {
  const config = JSON.parse(
    await readFile(path.join(projectRoot, "src-tauri", "tauri.conf.json"), "utf8"),
  );
  const windowsBundle = config.bundle.windows;

  assert.equal(windowsBundle.digestAlgorithm, "sha256");
  assert.match(windowsBundle.timestampUrl, /^https?:\/\//);
  assert.equal(windowsBundle.tsp, true);
});
