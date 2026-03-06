import { useState, useEffect, useCallback } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { DagGraph } from "./components/DagGraph";
import { fetchLineage } from "./api/client";
import type { ModelLineageResponse } from "./types";

import "@xyflow/react/dist/style.css";

export function App() {
  const [lineage, setLineage] = useState<ModelLineageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selector, setSelector] = useState<string>("");
  const [activeSelector, setActiveSelector] = useState<string | undefined>(undefined);

  const loadLineage = useCallback(async (select?: string) => {
    try {
      setError(null);
      const data = await fetchLineage(select);
      setLineage(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "データの読み込みに失敗しました");
    }
  }, []);

  useEffect(() => {
    loadLineage();
  }, [loadLineage]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = selector.trim();
      const select = trimmed || undefined;
      setActiveSelector(select);
      loadLineage(select);
    },
    [selector, loadLineage]
  );

  const handleReset = useCallback(() => {
    setSelector("");
    setActiveSelector(undefined);
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
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            value={selector}
            onChange={(e) => setSelector(e.target.value)}
            placeholder="+model_name+"
            style={{
              padding: "4px 8px",
              border: "1px solid #cbd5e0",
              borderRadius: 4,
              fontSize: 13,
              width: 220,
            }}
          />
          <button type="submit" style={{ padding: "4px 12px", fontSize: 13, cursor: "pointer" }}>
            Filter
          </button>
          {activeSelector && (
            <button
              type="button"
              onClick={handleReset}
              style={{ padding: "4px 12px", fontSize: 13, cursor: "pointer" }}
            >
              Reset
            </button>
          )}
        </form>
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
