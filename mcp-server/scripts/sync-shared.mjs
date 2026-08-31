// アプリの遷移表を MCP 側にも持ってくる。**書き写さない。生成する。**
//
// 🔴 なぜ生成か（2026-08-31）:
//   src/lib/item-status.ts の冒頭にこう書いてある——
//   「以前は scan.tsx と scan-action-dialog.tsx が同じ switch を別々に持っていて、
//     内容がずれていた」。同じことを MCP でやり直さないため、手で写さない。
//   tsconfig の rootDir が ./src なので直接 import できない。だからビルド時に写す。
//
// 変換するのは冒頭2行だけ:
//   import type { ProductItem } from '../types'      → 消す
//   export type ItemStatus = ProductItem['status']   → STATUS_LABEL のキーから作った合併型
// STATUS_LABEL は Record<ItemStatus, string> なので、アプリ側の tsc が
// 「キーが ProductItem['status'] と一致すること」を保証している。だからずれない。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "../../src/lib/item-status.ts");
const OUT = path.resolve(here, "../src/shared/item-status.ts");

const src = fs.readFileSync(SRC, "utf8");

// STATUS_LABEL のキーを拾って合併型を作る
const block = src.match(/STATUS_LABEL[^=]*=\s*\{([\s\S]*?)\n\}/);
if (!block) throw new Error("STATUS_LABEL が見つからない。src/lib/item-status.ts の形が変わった");
const keys = [...block[1].matchAll(/^\s*([a-z_]+)\s*:/gm)].map((m) => m[1]);
if (keys.length < 5) throw new Error(`STATUS_LABEL のキーが少なすぎる（${keys.length}件）。取りこぼしている`);

let out = src
  .replace(/^import type \{ ProductItem \} from ['"]\.\.\/types['"]\r?\n/m, "")
  .replace(/^export type ItemStatus = ProductItem\['status'\]\r?$/m,
           keys.map((k) => `  | '${k}'`).join("\n").replace(/^/, "export type ItemStatus =\n"));

if (out.includes("ProductItem")) throw new Error("ProductItem への参照が残っている。変換が効いていない");

out = `// 🔴 このファイルは生成物。**直接編集しない。**
// 元: src/lib/item-status.ts ／ 生成: mcp-server/scripts/sync-shared.mjs
// 直すときは元のファイルを直して \`npm run build\` する。
// アプリの QR スキャン画面と MCP が同じ遷移表を見るためのもの。

${out}`;

const before = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : null;
fs.writeFileSync(OUT, out);
console.error(before === out ? "shared/item-status.ts 変化なし" : `shared/item-status.ts を更新（status ${keys.length}種）`);
