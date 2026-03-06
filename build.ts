import { $ } from "bun";

console.log("vizdbt: ビルドを開始します...");

// 1. フロントエンドビルド
console.log("vizdbt: フロントエンドをビルド中...");
await $`cd ui && bun run build`;

// 2. 単一バイナリ生成
console.log("vizdbt: 単一バイナリを生成中...");
await $`bun build --compile --minify --bytecode src/index.ts --outfile vizdbt`;

console.log("vizdbt: ビルド完了 → ./vizdbt");
