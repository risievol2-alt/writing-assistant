import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { createLaunchPlan, getBrowserCommand } from "./launch.mjs";

const projectRoot = resolve("test-workspace", "writing-assistant");

test("统一启动器为开发和应用模式生成正确计划", () => {
  const development = createLaunchPlan("dev", projectRoot);
  assert.equal(development.browserUrl, "http://127.0.0.1:5173");
  assert.equal(development.prepare, null);
  assert.equal(development.processes.length, 2);
  assert.ok(development.processes[0].args.includes("--watch"));

  const production = createLaunchPlan("start", projectRoot);
  assert.equal(production.browserUrl, "http://127.0.0.1:8787");
  assert.equal(production.processes.length, 1);
  assert.ok(production.prepare.args.includes("build"));
});

test("统一启动器能够生成各平台的浏览器打开命令", () => {
  const url = "http://127.0.0.1:8787";
  assert.equal(getBrowserCommand(url, "win32").command, "cmd.exe");
  assert.deepEqual(getBrowserCommand(url, "darwin"), {
    command: "open",
    args: [url],
  });
  assert.deepEqual(getBrowserCommand(url, "linux"), {
    command: "xdg-open",
    args: [url],
  });
});

test("统一启动器拒绝未知模式", () => {
  assert.throws(() => createLaunchPlan("unknown", projectRoot), /不支持的启动模式/);
});
