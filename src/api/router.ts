import type { DbtProject } from "../core/types";
import { handleModels, handleModel, handleLineage } from "./handlers";

export function handleRequest(req: Request, project: DbtProject): Response {
  const url = new URL(req.url);

  if (url.pathname === "/api/lineage/model") {
    return handleLineage(url, project);
  }

  if (url.pathname === "/api/models") {
    return handleModels(project);
  }

  if (url.pathname.startsWith("/api/models/")) {
    return handleModel(url, project);
  }

  // 静的ファイル配信（TODO: ui/dist から配信）
  return new Response("vizdbt", {
    headers: { "Content-Type": "text/html" },
  });
}
