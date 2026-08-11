import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("发布流程必须签名并验证 Windows 安装包后才能公开 Release", async () => {
  const workflow = await readFile(
    path.join(projectRoot, ".github", "workflows", "release-tauri.yml"),
    "utf8",
  );

  assert.match(workflow, /secrets\.WINDOWS_CERTIFICATE\b/);
  assert.match(workflow, /secrets\.WINDOWS_CERTIFICATE_PASSWORD\b/);
  assert.match(workflow, /Import-PfxCertificate/);
  assert.match(workflow, /certificateThumbprint/);
  assert.match(workflow, /releaseDraft: true/);
  assert.match(workflow, /Get-AuthenticodeSignature/);
  assert.match(workflow, /SignatureStatus\]::Valid/);
  assert.match(workflow, /gh release edit .* --draft=false/);

  const importStep = workflow.indexOf("Import Windows code-signing certificate");
  const buildStep = workflow.indexOf("Build signed Windows installer");
  const verifyStep = workflow.indexOf("Verify Authenticode signatures");
  const publishStep = workflow.indexOf("Publish verified release");

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
