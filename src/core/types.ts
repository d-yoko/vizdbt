/** リソースタイプ（DAG に表示するもの） */
export type DbtResourceType = "model" | "source" | "seed" | "snapshot";

/** マテリアライゼーション */
export type DbtMaterialization = "view" | "table" | "incremental" | "ephemeral";

/** カラム情報 */
export interface DbtColumnInfo {
  name: string;
  dataType: string | null;
  description: string;
}

/** モデル情報（API 応答用） */
export interface DbtModelInfo {
  uniqueId: string;
  name: string;
  resourceType: DbtResourceType;
  materialization: DbtMaterialization | null;
  database: string | null;
  schema: string;
  description: string;
  tags: string[];
  dependsOn: string[];
  columns: DbtColumnInfo[];
  compiledCode: string | null;
}

/** DAG ノード（グラフ表示用） */
export interface DagNode {
  id: string;
  name: string;
  resourceType: DbtResourceType;
  materialization: DbtMaterialization | null;
}

/** DAG エッジ（グラフ表示用） */
export interface DagEdge {
  source: string;
  target: string;
}

/** モデル DAG 応答 */
export interface ModelLineageResponse {
  nodes: DagNode[];
  edges: DagEdge[];
}

/** プロジェクト全体のデータ */
export interface DbtProject {
  metadata: {
    dbtVersion: string;
    projectName: string;
    adapterType: string | null;
  };
  models: Map<string, DbtModelInfo>;
  dag: { nodes: DagNode[]; edges: DagEdge[] };
}
