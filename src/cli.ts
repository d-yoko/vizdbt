import { Command } from "commander";
import { parseManifest } from "./core/manifest-parser";
import { buildFullDag } from "./core/graph-builder";
import { startServer } from "./server";

interface CliOptions {
  manifest: string;
  port: number;
  open: boolean;
  select?: string;
}

export function createCli(): Command {
  const program = new Command();

  program
    .name("vizdbt")
    .description("dbt のデータリネージュをブラウザで可視化する CLI ツール")
    .version("0.1.0")
    .option("--manifest <path>", "manifest.json のパス", "target/manifest.json")
    .option("--port <number>", "サーバーポート", (v) => parseInt(v, 10), 3456)
    .option("--no-open", "ブラウザを自動で開かない")
    .option("--select <selector>", "表示するモデルの絞り込み")
    .action(async (options: CliOptions) => {
      const manifestPath = options.manifest;
      const file = Bun.file(manifestPath);

      if (!(await file.exists())) {
        console.error(
          `エラー: ${manifestPath} が見つかりません。\n` +
            "`dbt compile` または `dbt parse` を実行して manifest.json を生成してください。"
        );
        process.exit(1);
      }

      let project;
      try {
        project = await parseManifest(manifestPath);
      } catch (e) {
        console.error(
          `エラー: manifest.json のパースに失敗しました。\nファイル: ${manifestPath}`
        );
        if (e instanceof Error) console.error(e.message);
        process.exit(2);
      }

      const dag = buildFullDag(project);
      console.log(
        `vizdbt: ${dag.nodes.length} モデルを読み込みました (${project.metadata.projectName})`
      );

      await startServer({
        port: options.port,
        open: options.open,
        project,
        select: options.select,
      });
    });

  return program;
}
