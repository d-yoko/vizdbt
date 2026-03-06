import { describe, test, expect } from "bun:test";
import { parseManifest } from "../src/core/manifest-parser";

const FIXTURE_PATH = "tests/fixtures/manifest-v12.json";

describe("parseManifest", () => {
  test("metadata を正しくパースする", async () => {
    const project = await parseManifest(FIXTURE_PATH);
    expect(project.metadata.projectName).toBe("sample_shop");
    expect(project.metadata.dbtVersion).toBe("1.10.0");
    expect(project.metadata.adapterType).toBe("duckdb");
  });

  test("model, source, seed を読み込み、test は除外する", async () => {
    const project = await parseManifest(FIXTURE_PATH);
    const types = new Set(
      Array.from(project.models.values()).map((m) => m.resourceType)
    );
    expect(types).toContain("model");
    expect(types).toContain("source");
    expect(types).toContain("seed");
    expect(types).not.toContain("test");
  });

  test("正しい数のノードとエッジを構築する", async () => {
    const project = await parseManifest(FIXTURE_PATH);
    // 9 models + 4 sources + 2 seeds = 15
    expect(project.dag.nodes).toHaveLength(15);
    expect(project.dag.edges).toHaveLength(13);
  });

  test("モデルのカラム情報を読み込む", async () => {
    const project = await parseManifest(FIXTURE_PATH);
    const model = project.models.get("model.sample_shop.stg_customers");
    expect(model).toBeDefined();
    expect(model!.columns).toHaveLength(3);
    expect(model!.columns[0]!.name).toBe("customer_id");
  });

  test("compiled_code を読み込む", async () => {
    const project = await parseManifest(FIXTURE_PATH);
    const model = project.models.get("model.sample_shop.stg_customers");
    expect(model!.compiledCode).toContain("select");
  });

  test("source は compiledCode が null", async () => {
    const project = await parseManifest(FIXTURE_PATH);
    const source = project.models.get("source.sample_shop.shop_raw.customers");
    expect(source).toBeDefined();
    expect(source!.compiledCode).toBeNull();
  });

  test("v7 未満の manifest でエラーを投げる", async () => {
    // v6 相当の一時ファイルを作成
    const tmpPath = "tests/fixtures/manifest-v6-tmp.json";
    await Bun.write(
      tmpPath,
      JSON.stringify({
        metadata: {
          dbt_schema_version: "https://schemas.getdbt.com/dbt/manifest/v6.json",
          dbt_version: "1.2.0",
          project_name: "old_project",
          adapter_type: "duckdb",
        },
        nodes: {},
        sources: {},
        parent_map: {},
      })
    );

    expect(parseManifest(tmpPath)).rejects.toThrow("v6");

    // 一時ファイル削除
    const { unlinkSync } = await import("node:fs");
    unlinkSync(tmpPath);
  });
});
