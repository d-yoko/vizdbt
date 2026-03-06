export type DbtResourceType = "model" | "source" | "seed" | "snapshot";
export type DbtMaterialization = "view" | "table" | "incremental" | "ephemeral";

export interface DagNode {
  id: string;
  name: string;
  resourceType: DbtResourceType;
  materialization: DbtMaterialization | null;
}

export interface DagEdge {
  source: string;
  target: string;
}

export interface ModelLineageResponse {
  nodes: DagNode[];
  edges: DagEdge[];
}
