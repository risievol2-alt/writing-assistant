import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const defaultProjectRoot = resolve(currentDir, "..");

export function createLaunchPlan(mode, projectRoot = defaultProjectRoot) {
  const frontendDir = resolve(projectRoot, "frontend");
  const viteEntry = resolve(frontendDir, "node_modules", "vite", "bin", "vite.js");
  const backendEntry = resolve(projectRoot, "backend", "src", "server.js");

  if (mode === "dev") {
    return {
      mode,
      browserUrl: "http://127.0.0.1:5173",
      healthUrls: [
        "http://127.0.0.1:8787/api/health",
        "http://127.0.0.1:5173",
      ],
      requiredFiles: [viteEntry, backendEntry],
      prepare: null,
      processes: [
        {
          label: "后端",
          command: process.execPath,
          args: ["--watch", backendEntry],
          cwd: projectRoot,
        },
        {
          label: "前端",
          command: process.execPath,
          args: [viteEntry, "--host", "127.0.0.1", "--port", "5173"],
          cwd: frontendDir,
        },
      ],
    };
  }

  if (mode === "start") {
    return {
      mode,
      browserUrl: "http://127.0.0.1:8787",
      healthUrls: ["http://127.0.0.1:8787/api/health"],
      requiredFiles: [viteEntry, backendEntry],
      prepare: {
        label: "前端构建",
        command: process.execPath,
        args: [viteEntry, "build"],
        cwd: frontendDir,
      },
      processes: [
        {
          label: "砚习",
          command: process.execPath,
          args: [backendEntry],
          cwd: projectRoot,
        },
      ],
    };
  }

  throw new Error(`不支持的启动模式：${mode}`);
}

export function getBrowserCommand(url, platform = process.platform) {
  if (platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", `start "" "${url}"`],
    };
  }
  if (platform === "darwin") {
    return { command: "open", args: [url] };
  }
  return { command: "xdg-open", args: [url] };
}

function assertRequiredFiles(plan) {
  const missing = plan.requiredFiles.filter((file) => !existsSync(file));
  if (missing.length) {
    throw new Error(
      `启动所需文件不存在，请先运行 pnpm setup：\n${missing.join("\n")}`,
    );
  }
}

function runCommand(spec) {
  console.log(`\n[${spec.label}] 正在执行…`);
  return new Promise((resolvePromise, reject) => {
    const child = spawn(spec.command, spec.args, {
      cwd: spec.cwd,
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`${spec.label}执行失败（${signal || `退出码 ${code}`}）。`));
    });
  });
}

function startProcess(spec) {
  const child = spawn(spec.command, spec.args, {
    cwd: spec.cwd,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });
  child.launchLabel = spec.label;
  return child;
}

async function waitForUrl(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_500) });
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }

  throw new Error(`等待服务超时：${url}（${lastError?.message || "无响应"}）`);
}

function createExitMonitor(children) {
  let settled = false;
  let resolveExit;
  const promise = new Promise((resolvePromise) => {
    resolveExit = resolvePromise;
  });

  const finish = (result) => {
    if (settled) return;
    settled = true;
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    resolveExit(result);
  };
  const onSignal = () => finish({ code: 0, requested: true });

  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  for (const child of children) {
    child.once("error", (error) => finish({ code: 1, error }));
    child.once("exit", (code, signal) => {
      finish({
        code: code ?? (signal ? 1 : 0),
        label: child.launchLabel,
        signal,
      });
    });
  }

  return promise;
}

async function stopProcesses(children) {
  const pending = children.map((child) => {
    if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
    return new Promise((resolvePromise) => {
      const timer = setTimeout(resolvePromise, 2_000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolvePromise();
      });
      child.kill();
    });
  });
  await Promise.all(pending);
}

function openBrowser(url) {
  const spec = getBrowserCommand(url);
  const child = spawn(spec.command, spec.args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.once("error", (error) => {
    console.warn(`无法自动打开浏览器：${error.message}`);
  });
  child.unref();
}

export async function launch(mode, options = {}) {
  const plan = createLaunchPlan(mode, options.projectRoot);
  assertRequiredFiles(plan);

  if (plan.prepare) await runCommand(plan.prepare);

  console.log(`\n[砚习] 正在以${mode === "dev" ? "开发" : "应用"}模式启动…`);
  const children = plan.processes.map(startProcess);
  const exitPromise = createExitMonitor(children);

  try {
    const readiness = Promise.all(plan.healthUrls.map((url) => waitForUrl(url)));
    const firstResult = await Promise.race([
      readiness.then(() => null),
      exitPromise.then((result) => ({ exit: result })),
    ]);
    if (firstResult?.exit) {
      const { exit } = firstResult;
      throw exit.error || new Error(`${exit.label || "服务"}在启动完成前退出。`);
    }

    console.log(`[砚习] 已就绪：${plan.browserUrl}`);
    if (!options.noOpen) openBrowser(plan.browserUrl);

    const result = await exitPromise;
    if (!result.requested && result.code !== 0) {
      console.error(`[砚习] ${result.label || "服务"}意外停止。`);
    }
    await stopProcesses(children);
    return result.code;
  } catch (error) {
    await stopProcesses(children);
    throw error;
  }
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const mode = process.argv[2] || "start";
  const noOpen = process.argv.includes("--no-open") || process.env.INKSTONE_NO_OPEN === "1";
  launch(mode, { noOpen })
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`\n[砚习] 启动失败：${error.message}`);
      process.exitCode = 1;
    });
}
