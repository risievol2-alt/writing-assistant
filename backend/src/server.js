import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const staticDir = resolve(currentDir, "..", "..", "frontend", "dist");
const port = Number(process.env.PORT) || 8787;
const { app } = createApp({ staticDir });

app.listen(port, "127.0.0.1", () => {
  console.log(`砚习服务已启动：http://127.0.0.1:${port}`);
});
