import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { DbtResourceType, DbtMaterialization } from "../../types";

interface ModelNodeData {
  name: string;
  resourceType: DbtResourceType;
  materialization: DbtMaterialization | null;
  [key: string]: unknown;
}

const RESOURCE_COLORS: Record<DbtResourceType, string> = {
  model: "#3182ce",
  source: "#38a169",
  seed: "#dd6b20",
  snapshot: "#805ad5",
};

const RESOURCE_ICONS: Record<DbtResourceType, string> = {
  model: "\u{1F4CA}",
  source: "\u{1F4E5}",
  seed: "\u{1F331}",
  snapshot: "\u{1F4F7}",
};

export function ModelNode({ data }: NodeProps) {
  const nodeData = data as unknown as ModelNodeData;
  const color = RESOURCE_COLORS[nodeData.resourceType];

  return (
    <>
      <Handle type="target" position={Position.Left} />
      <div
        style={{
          padding: "8px 12px",
          borderRadius: 6,
          border: `2px solid ${color}`,
          background: "#fff",
          fontSize: 13,
          minWidth: 140,
        }}
      >
        <div style={{ fontWeight: 600 }}>
          {RESOURCE_ICONS[nodeData.resourceType]} {nodeData.name}
        </div>
        <div style={{ fontSize: 11, color: "#718096", marginTop: 2 }}>
          {nodeData.resourceType}
          {nodeData.materialization ? ` \u00B7 ${nodeData.materialization}` : ""}
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </>
  );
}
