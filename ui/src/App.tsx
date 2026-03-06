import { useState, useEffect, useCallback } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { DagGraph } from "./components/DagGraph";
import { fetchLineage } from "./api/client";
import type { ModelLineageResponse } from "./types";

import "@xyflow/react/dist/style.css";

export function App() {
  const [lineage, setLineage] = useState<ModelLineageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadLineage = useCallback(async () => {
    try {
      const data = await fetchLineage();
      setLineage(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "データの読み込みに失敗しました");
    }
  }, []);

  useEffect(() => {
    loadLineage();
  }, [loadLineage]);

  if (error) {
    return <div style={{ padding: 24, color: "#e53e3e" }}>{error}</div>;
  }

  if (!lineage) {
    return <div style={{ padding: 24 }}>読み込み中...</div>;
  }

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          padding: "8px 16px",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <strong>vizdbt</strong>
        <span style={{ color: "#718096", fontSize: 14 }}>
          {lineage.nodes.length} models
        </span>
      </header>
      <div style={{ flex: 1 }}>
        <ReactFlowProvider>
          <DagGraph lineage={lineage} />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
