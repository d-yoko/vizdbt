import type {
  DbtProject,
  DbtModelInfo,
  DbtColumnInfo,
  DbtResourceType,
  DbtMaterialization,
  DagNode,
  DagEdge,
} from "./types";

interface RawManifest {
  metadata: {
    dbt_schema_version: string;
    dbt_version: string;
    project_name: string | null;
    adapter_type: string | null;
  };
  nodes: Record<string, RawNode>;
  sources: Record<string, RawSource>;
  parent_map: Record<string, string[]>;
}

interface RawNode {
  unique_id: string;
  name: string;
  resource_type: string;
  depends_on: { nodes: string[] };
  config: { materialized?: string; enabled?: boolean; tags?: string[] };
  database: string | null;
  schema: string;
  description: string;
  tags: string[];
  columns: Record<string, { name: string; data_type: string | null; description: string }>;
  compiled_code?: string;
}

interface RawSource {
  unique_id: string;
  name: string;
  source_name: string;
  resource_type: "source";
  database: string | null;
  schema: string;
  description: string;
  columns: Record<string, { name: string; data_type: string | null; description: string }>;
}

const SUPPORTED_RESOURCE_TYPES = new Set<string>(["model", "seed", "snapshot"]);

function extractSchemaVersion(schemaVersion: string): number {
  const match = schemaVersion.match(/v(\d+)/);
  if (!match?.[1]) return 0;
  return parseInt(match[1], 10);
}

function toColumns(
  raw: Record<string, { name: string; data_type: string | null; description: string }>
): DbtColumnInfo[] {
  return Object.values(raw).map((col) => ({
    name: col.name,
    dataType: col.data_type,
    description: col.description,
  }));
}

export async function parseManifest(path: string): Promise<DbtProject> {
  const raw: RawManifest = await Bun.file(path).json();

  const version = extractSchemaVersion(raw.metadata.dbt_schema_version);
  if (version < 7) {
    throw new Error(
      `manifest schema v${version} はサポート対象外です。dbt 1.3 以上が必要です。`
    );
  }

  const models = new Map<string, DbtModelInfo>();
  const nodeIds = new Set<string>();

  // nodes（model, seed, snapshot）
  for (const node of Object.values(raw.nodes)) {
    if (!SUPPORTED_RESOURCE_TYPES.has(node.resource_type)) continue;
    if (node.config.enabled === false) continue;

    const resourceType = node.resource_type as DbtResourceType;
    const materialization = (node.config.materialized as DbtMaterialization) ?? null;

    models.set(node.unique_id, {
      uniqueId: node.unique_id,
      name: node.name,
      resourceType,
      materialization,
      database: node.database,
      schema: node.schema,
      description: node.description,
      tags: node.tags,
      dependsOn: node.depends_on.nodes,
      columns: toColumns(node.columns),
      compiledCode: node.compiled_code ?? null,
    });
    nodeIds.add(node.unique_id);
  }

  // sources
  for (const source of Object.values(raw.sources)) {
    models.set(source.unique_id, {
      uniqueId: source.unique_id,
      name: source.name,
      resourceType: "source",
      materialization: null,
      database: source.database,
      schema: source.schema,
      description: source.description,
      tags: [],
      dependsOn: [],
      columns: toColumns(source.columns),
      compiledCode: null,
    });
    nodeIds.add(source.unique_id);
  }

  // DAG 構築（parent_map ベース）
  const dagNodes: DagNode[] = [];
  const dagEdges: DagEdge[] = [];

  for (const model of models.values()) {
    dagNodes.push({
      id: model.uniqueId,
      name: model.name,
      resourceType: model.resourceType,
      materialization: model.materialization,
    });
  }

  for (const [childId, parentIds] of Object.entries(raw.parent_map)) {
    if (!nodeIds.has(childId)) continue;
    for (const parentId of parentIds) {
      if (!nodeIds.has(parentId)) continue;
      dagEdges.push({ source: parentId, target: childId });
    }
  }

  return {
    metadata: {
      dbtVersion: raw.metadata.dbt_version,
      projectName: raw.metadata.project_name ?? "unknown",
      adapterType: raw.metadata.adapter_type ?? null,
    },
    models,
    dag: { nodes: dagNodes, edges: dagEdges },
  };
}
