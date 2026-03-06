import { describe, test, expect, beforeAll } from "bun:test";
import { parseManifest } from "../src/core/manifest-parser";
import { buildFullDag, buildFilteredDag } from "../src/core/graph-builder";
import type { DbtProject } from "../src/core/types";

let project: DbtProject;

beforeAll(async () => {
  project = await parseManifest("tests/fixtures/manifest-v12.json");
});

describe("buildFullDag", () => {
  test("全ノードと全エッジを返す", () => {
    const dag = buildFullDag(project);
    expect(dag.nodes).toHaveLength(15);
    expect(dag.edges).toHaveLength(13);
  });
});

describe("buildFilteredDag", () => {
  test("モデル名のみ指定でノード単体を返す", () => {
    const dag = buildFilteredDag(project, "stg_customers");
    expect(dag.nodes).toHaveLength(1);
    expect(dag.nodes[0]!.name).toBe("stg_customers");
    expect(dag.edges).toHaveLength(0);
  });

  test("+model で upstream を含む", () => {
    const dag = buildFilteredDag(project, "+stg_customers");
    const names = dag.nodes.map((n) => n.name);
    expect(names).toContain("stg_customers");
    expect(names).toContain("customers"); // source
    expect(dag.edges.length).toBeGreaterThanOrEqual(1);
  });

  test("model+ で downstream を含む", () => {
    const dag = buildFilteredDag(project, "stg_customers+");
    const names = dag.nodes.map((n) => n.name);
    expect(names).toContain("stg_customers");
    expect(names).toContain("mart_sales_overview");
    expect(names).toContain("mart_customer_summary");
  });

  test("+model+ で upstream と downstream の両方を含む", () => {
    const dag = buildFilteredDag(project, "+int_orders_enriched+");
    const names = dag.nodes.map((n) => n.name);
    // upstream
    expect(names).toContain("stg_orders");
    expect(names).toContain("orders"); // source
    // target
    expect(names).toContain("int_orders_enriched");
    // downstream
    expect(names).toContain("mart_sales_overview");
    expect(names).toContain("mart_customer_summary");
  });

  test("depth を指定すると範囲を制限できる", () => {
    const dag = buildFilteredDag(project, "+mart_sales_overview", 1);
    const names = dag.nodes.map((n) => n.name);
    expect(names).toContain("mart_sales_overview");
    expect(names).toContain("int_orders_enriched");
    expect(names).toContain("stg_customers");
    // depth 1 なので source までは辿らない
    expect(names).not.toContain("customers");
    expect(names).not.toContain("orders");
  });

  test("存在しないモデル名は空を返す", () => {
    const dag = buildFilteredDag(project, "+nonexistent+");
    expect(dag.nodes).toHaveLength(0);
    expect(dag.edges).toHaveLength(0);
  });
});
