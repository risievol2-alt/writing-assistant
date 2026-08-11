import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  assertSafeResourceRoot,
  createTauriStagingPlan,
} from "./prepare-tauri.mjs";

test("Tauri 资源计划包含前端、后端、数据库和 Node 运行时", () => {
  const projectRoot = resolve("test-workspace", "writing-assistant");
  const plan = createTauriStagingPlan(projectRoot);
  const destinations = plan.copies.map(([, destination]) => destination);

  assert.equal(plan.resourceRoot, resolve(projectRoot, "src-tauri", "resources"));
  assert.ok(destinations.some((path) => path.endsWith(join("frontend", "dist"))));
  assert.ok(destinations.some((path) => path.endsWith(join("backend", "src"))));
  assert.ok(destinations.some((path) => path.endsWith(join("backend", "pnpm-lock.yaml"))));
  assert.ok(destinations.some((path) => path.endsWith(join("database", "schema.sql"))));
  assert.ok(destinations.some((path) => /runtime[\\/]node(?:\.exe)?$/.test(path)));
});

test("Tauri 资源清理只允许命中固定暂存目录", () => {
  const projectRoot = resolve("test-workspace", "writing-assistant");
  const resourceRoot = resolve(projectRoot, "src-tauri", "resources");

  assert.doesNotThrow(() => assertSafeResourceRoot(projectRoot, resourceRoot));
  assert.throws(
    () => assertSafeResourceRoot(projectRoot, resolve(projectRoot, "src-tauri")),
    /拒绝清理非预期资源目录/,
  );
});
