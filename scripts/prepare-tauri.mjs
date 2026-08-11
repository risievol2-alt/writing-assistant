import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const defaultProjectRoot = resolve(currentDir, "..");

export function createTauriStagingPlan(projectRoot = defaultProjectRoot) {
  const root = resolve(projectRoot);
  const resourceRoot = resolve(root, "src-tauri", "resources");
  return {
    projectRoot: root,
    resourceRoot,
    copies: [
      [resolve(root, "frontend", "dist"), resolve(resourceRoot, "frontend", "dist")],
      [resolve(root, "backend", "src"), resolve(resourceRoot, "backend", "src")],
      [resolve(root, "backend", "package.json"), resolve(resourceRoot, "backend", "package.json")],
      [resolve(root, "backend", "pnpm-lock.yaml"), resolve(resourceRoot, "backend", "pnpm-lock.yaml")],
      [resolve(root, "database", "schema.sql"), resolve(resourceRoot, "database", "schema.sql")],
      [resolve(root, "database", "seed-prompts.json"), resolve(resourceRoot, "database", "seed-prompts.json")],
      [resolve(root, "database", "seed-character-fields.json"), resolve(resourceRoot, "database", "seed-character-fields.json")],
      [process.execPath, resolve(resourceRoot, "runtime", process.platform === "win32" ? "node.exe" : "node")],
    ],
  };
}

function installProductionDependencies(backendDirectory) {
  const pnpmEntry = process.env.npm_execpath;
  if (!pnpmEntry) {
    throw new Error("无法定位 pnpm，请通过 pnpm tauri:prepare 运行资源准备。");
  }

  const args = [
    pnpmEntry,
    "install",
    "--dir",
    backendDirectory,
    "--prod",
    "--offline",
    "--frozen-lockfile",
    "--ignore-scripts",
    "--config.node-linker=hoisted",
  ];

  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: backendDirectory,
      env: { ...process.env, CI: "1" },
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`生产依赖暂存失败（${signal || `退出码 ${code}`}）。`));
    });
  });
}

export function assertSafeResourceRoot(projectRoot, resourceRoot) {
  const expected = resolve(projectRoot, "src-tauri", "resources");
  if (resolve(resourceRoot) !== expected || relative(projectRoot, expected).startsWith("..")) {
    throw new Error(`拒绝清理非预期资源目录：${resourceRoot}`);
  }
}

async function assertSourceExists(source) {
  await stat(source);
}

export async function stageTauriResources(projectRoot = defaultProjectRoot) {
  const plan = createTauriStagingPlan(projectRoot);
  assertSafeResourceRoot(plan.projectRoot, plan.resourceRoot);

  for (const [source] of plan.copies) await assertSourceExists(source);

  await rm(plan.resourceRoot, { recursive: true, force: true });
  await mkdir(plan.resourceRoot, { recursive: true });

  for (const [source, destination] of plan.copies) {
    await mkdir(dirname(destination), { recursive: true });
    await cp(source, destination, { recursive: true, dereference: true, force: true });
  }

  await installProductionDependencies(resolve(plan.resourceRoot, "backend"));

  const packageData = JSON.parse(
    await readFile(resolve(plan.projectRoot, "package.json"), "utf8"),
  );
  const manifest = {
    appVersion: packageData.version,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
  };
  await writeFile(
    resolve(plan.resourceRoot, "desktop-resources.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  return plan;
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  stageTauriResources()
    .then((plan) => {
      console.log(`Tauri resources prepared: ${plan.resourceRoot}`);
    })
    .catch((error) => {
      console.error(`Tauri resource preparation failed: ${error.message}`);
      process.exitCode = 1;
    });
}
