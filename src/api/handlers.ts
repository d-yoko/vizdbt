import type { DbtProject } from "../core/types";
import { buildFullDag, buildFilteredDag } from "../core/graph-builder";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function handleModels(project: DbtProject): Response {
  const models = Array.from(project.models.values());
  return json(models);
}

export function handleModel(url: URL, project: DbtProject): Response {
  const id = decodeURIComponent(url.pathname.replace("/api/models/", ""));
  const model = project.models.get(id);
  if (!model) {
    return json({ error: "Model not found" }, 404);
  }
  return json(model);
}

export function handleLineage(url: URL, project: DbtProject): Response {
  const selector = url.searchParams.get("select");
  const depthParam = url.searchParams.get("depth");
  const depth = depthParam ? parseInt(depthParam, 10) : undefined;

  if (!selector) {
    return json(buildFullDag(project));
  }

  return json(buildFilteredDag(project, selector, depth));
}
