import { useState, useEffect, useCallback } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import { ModelNode } from "./nodes/ModelNode";
import { calculateLayout } from "../lib/elk-layout";
import type { ModelLineageResponse } from "../types";

const nodeTypes = { model: ModelNode };

interface DagGraphProps {
  lineage: ModelLineageResponse;
}

export function DagGraph({ lineage }: DagGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [layoutDone, setLayoutDone] = useState(false);

  useEffect(() => {
    const rfNodes: Node[] = lineage.nodes.map((n) => ({
      id: n.id,
      type: "model",
      position: { x: 0, y: 0 },
      data: {
        name: n.name,
        resourceType: n.resourceType,
        materialization: n.materialization,
      },
    }));

    const rfEdges: Edge[] = lineage.edges.map((e, i) => ({
      id: `e-${i}`,
      source: e.source,
      target: e.target,
    }));

    calculateLayout(rfNodes, rfEdges).then((layoutedNodes) => {
      setNodes(layoutedNodes);
      setEdges(rfEdges);
      setLayoutDone(true);
    });
  }, [lineage, setNodes, setEdges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView={layoutDone}
      proOptions={{ hideAttribution: true }}
    >
      <MiniMap />
      <Controls />
    </ReactFlow>
  );
}
