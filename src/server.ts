import type { DbtProject } from "./core/types";
import { handleRequest } from "./api/router";

interface ServerOptions {
  port: number;
  open: boolean;
  project: DbtProject;
  select?: string;
}

export async function startServer(options: ServerOptions): Promise<void> {
  const { port, open, project } = options;

  const server = Bun.serve({
    port,
    fetch(req) {
      return handleRequest(req, project);
    },
  });

  const url = `http://localhost:${server.port}`;
  console.log(`vizdbt: サーバーを起動しました ${url}`);

  if (open) {
    const command =
      process.platform === "darwin" ? "open" : "xdg-open";
    Bun.spawn([command, url]);
  }

  // サーバーが停止するまで待機
  process.on("SIGINT", () => {
    console.log("\nvizdbt: サーバーを停止します");
    server.stop();
    process.exit(0);
  });
}
