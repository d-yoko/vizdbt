import type { ModelLineageResponse } from "../types";

const API_BASE = "";

export async function fetchLineage(
  select?: string,
  depth?: number
): Promise<ModelLineageResponse> {
  const params = new URLSearchParams();
  if (select) params.set("select", select);
  if (depth !== undefined) params.set("depth", String(depth));

  const query = params.toString();
  const url = `${API_BASE}/api/lineage/model${query ? `?${query}` : ""}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`API エラー: ${res.status}`);
  return res.json();
}
