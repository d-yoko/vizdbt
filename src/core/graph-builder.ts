import type { DbtProject, ModelLineageResponse, DagNode, DagEdge } from "./types";

export function buildFullDag(project: DbtProject): ModelLineageResponse {
  return { nodes: project.dag.nodes, edges: project.dag.edges };
}

export function buildFilteredDag(
  project: DbtProject,
  selector: string,
  depth?: number
): ModelLineageResponse {
  const maxDepth = depth ?? Infinity;

  // セレクター解析: +model_name+, +model_name, model_name+, model_name
  const upstream = selector.startsWith("+");
  const downstream = selector.endsWith("+");
  const modelName = selector.replace(/^\+/, "").replace(/\+$/, "");

  // 対象モデルを検索
  const targetNode = project.dag.nodes.find((n) => n.name === modelName);
  if (!targetNode) {
    return { nodes: [], edges: [] };
  }

  const includedIds = new Set<string>([targetNode.id]);

  // 隣接リスト構築
  const childrenMap = new Map<string, string[]>();
  const parentMap = new Map<string, string[]>();
  for (const edge of project.dag.edges) {
    if (!childrenMap.has(edge.source)) childrenMap.set(edge.source, []);
    childrenMap.get(edge.source)!.push(edge.target);
    if (!parentMap.has(edge.target)) parentMap.set(edge.target, []);
    parentMap.get(edge.target)!.push(edge.source);
  }

  // BFS でノードを収集
  function bfs(startId: string, adjacency: Map<string, string[]>): void {
    const queue: Array<{ id: string; currentDepth: number }> = [
      { id: startId, currentDepth: 0 },
    ];
    while (queue.length > 0) {
      const { id, currentDepth } = queue.shift()!;
      if (currentDepth >= maxDepth) continue;
      const neighbors = adjacency.get(id) ?? [];
      for (const neighborId of neighbors) {
        if (!includedIds.has(neighborId)) {
          includedIds.add(neighborId);
          queue.push({ id: neighborId, currentDepth: currentDepth + 1 });
        }
      }
    }
  }

  if (upstream) bfs(targetNode.id, parentMap);
  if (downstream) bfs(targetNode.id, childrenMap);

  // セレクターに +/+ がない場合はノード単体
  if (!upstream && !downstream) {
    // ノード単体のみ返す
  }

  const filteredNodes = project.dag.nodes.filter((n) => includedIds.has(n.id));
  const filteredEdges = project.dag.edges.filter(
    (e) => includedIds.has(e.source) && includedIds.has(e.target)
  );

  return { nodes: filteredNodes, edges: filteredEdges };
}
