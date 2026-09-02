import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
// 🔴 QRスキャン画面と**同じ遷移表**。手で写さない（scripts/sync-shared.mjs が生成する）。
//   src/lib/item-status.ts が正。2026-08-20 に「同じ switch が2箇所にあってずれた」
//   事故を直したファイルなので、ここで写し直すと元の木阿弥になる。
import { getAvailableActions, recordName, STATUS_LABEL } from "./shared/item-status.js";

// Load .env from parent directory (welfare-equipment-manager)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 読み取り専用ユーザーでログインする（2026-07-30 追加）
// RLS が anon を全て拒否するため、認証しないと 200 で 0 件しか返らない。
// 認証情報は .env のみ（このファイルに書かない＝git に鍵を載せない）。
const MCP_EMAIL = process.env.MCP_USER_EMAIL;
const MCP_PASS = process.env.MCP_USER_PASSWORD;
async function signInIfConfigured() {
  if (!MCP_EMAIL || !MCP_PASS) {
    console.error("[auth] MCP_USER_EMAIL / MCP_USER_PASSWORD が未設定。anon のままなので RLS で 0 件になります");
    return;
  }
  const { error } = await supabase.auth.signInWithPassword({ email: MCP_EMAIL, password: MCP_PASS });
  if (error) console.error("[auth] ログイン失敗:", error.message);
  else console.error("[auth] ログイン成功:", MCP_EMAIL);
}

const server = new McpServer({
  name: "welfare-equipment-manager",
  version: "1.0.0",
});

// ============================================================
// 集計専用モード（MCP_AGGREGATE_ONLY=1・2026-07-30 追加）
// ============================================================
// このDBの product_items / item_histories / users は利用者の氏名を持つ。
// アクト軸の外（3軸共通層・パーソナル・やどりぎ）からは台数しか要らないので、
// 「呼ばせない」のではなく **ツール自体を登録しない**。
// 権限リストや CLAUDE.md の注意書きは advisory で守られないが、
// 存在しないツールは呼べない。強制力はここが一番強い。
const AGGREGATE_ONLY = process.env.MCP_AGGREGATE_ONLY === "1";
const AGGREGATE_SAFE = new Set(["get_disinfection_backlog"]);

const _rawTool = (server as any).tool.bind(server);
(server as any).tool = (name: string, ...rest: any[]) => {
  if (AGGREGATE_ONLY && !AGGREGATE_SAFE.has(name)) {
    console.error(`[aggregate-only] ${name} は登録しない（氏名を含む可能性があるため）`);
    return undefined;
  }
  return _rawTool(name, ...rest);
};

// ============================================================
// Tools
// ============================================================

// --- カテゴリ一覧 ---
server.tool("get_categories", "商品カテゴリ一覧を取得", {}, async () => {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name");
  if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// --- 商品一覧 ---
server.tool(
  "get_products",
  "商品マスタ一覧を取得。category_idでフィルタ可能",
  { category_id: z.string().optional().describe("カテゴリIDでフィルタ") },
  async ({ category_id }) => {
    let query = supabase.from("products").select("*").order("name");
    if (category_id) query = query.eq("category_id", category_id);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// --- 商品アイテム（個別管理品）一覧 ---
server.tool(
  "get_product_items",
  "個別管理の商品アイテム一覧を取得。status/product_idでフィルタ可能。上限500件",
  {
    status: z
      .enum([
        "available",
        "reserved",
        "ready_for_delivery",
        "rented",
        "returned",
        "cleaning",
        "maintenance",
        "demo_cancelled",
        "out_of_order",
        "unknown",
      ])
      .optional()
      .describe("ステータスでフィルタ"),
    product_id: z.string().optional().describe("商品IDでフィルタ"),
    limit: z.number().optional().describe("取得件数上限 (デフォルト500)"),
  },
  async ({ status, product_id, limit }) => {
    const max = Math.min(limit ?? 500, 2000);
    let query = supabase
      .from("product_items")
      .select("*")
      .order("created_at", { ascending: false })
      .range(0, max - 1);
    if (status) query = query.eq("status", status);
    if (product_id) query = query.eq("product_id", product_id);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return {
      content: [
        { type: "text", text: `${data?.length ?? 0}件取得\n${JSON.stringify(data, null, 2)}` },
      ],
    };
  }
);

// --- 商品アイテム詳細 ---
server.tool(
  "get_product_item_detail",
  "管理番号(ID)で商品アイテムの詳細を取得",
  { item_id: z.string().describe("商品アイテムID (例: RP-001)") },
  async ({ item_id }) => {
    const { data, error } = await supabase
      .from("product_items")
      .select("*")
      .eq("id", item_id)
      .single();
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// --- 発注一覧 ---
server.tool(
  "get_orders",
  "発注一覧を取得。statusでフィルタ可能",
  {
    status: z
      .enum(["pending", "partial_approved", "approved", "cancelled"])
      .optional()
      .describe("発注ステータスでフィルタ"),
    limit: z.number().optional().describe("取得件数上限 (デフォルト100)"),
  },
  async ({ status, limit }) => {
    const max = Math.min(limit ?? 100, 500);
    let query = supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .range(0, max - 1);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// --- 発注明細 ---
server.tool(
  "get_order_items",
  "指定した発注IDの明細(order_items)を取得",
  { order_id: z.string().describe("発注ID") },
  async ({ order_id }) => {
    const { data, error } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", order_id);
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// --- 履歴 ---
server.tool(
  "get_item_history",
  "商品アイテムの操作履歴を取得。item_idまたはactionでフィルタ可能",
  {
    item_id: z.string().optional().describe("商品アイテムIDでフィルタ"),
    action: z.string().optional().describe("アクション種別でフィルタ"),
    limit: z.number().optional().describe("取得件数上限 (デフォルト100)"),
  },
  async ({ item_id, action, limit }) => {
    const max = Math.min(limit ?? 100, 1000);
    let query = supabase
      .from("item_histories")
      .select("*")
      .order("timestamp", { ascending: false })
      .range(0, max - 1);
    if (item_id) query = query.eq("item_id", item_id);
    if (action) query = query.eq("action", action);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// --- デモ機材 ---
server.tool(
  "get_demo_equipment",
  "デモ用機材一覧を取得",
  {
    status: z.enum(["available", "demo"]).optional().describe("ステータスでフィルタ"),
  },
  async ({ status }) => {
    let query = supabase.from("demo_equipment").select("*").order("name");
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// --- 預かり品 ---
// 預かり品。テーブル名は deposit_items（2026-07-31 修正）。
// 以前 "deposits" を見ており relation does not exist で毎回エラーだった。
// アプリ側（src/pages/deposits.tsx / stores）は deposit_items を使っている＝そちらが正。
server.tool("get_deposits", "預かり品一覧を取得", {}, async () => {
  const { data, error } = await supabase
    .from("deposit_items")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// --- 消毒待ちの集計＋月平均の返却台数（個人情報を返さない専用ツール・2026-07-30） ---
// product_items と item_histories には customer_name（利用者の氏名）が含まれるため、
// select("*") 系のツールは AI に使わせない。ここは status / product_id / item_id / timestamp しか読まない。
server.tool(
  "get_disinfection_backlog",
  "消毒待ち台数と月平均の返却台数を返す。個人情報は一切返さない（氏名の列を読まない）。消毒スケジュールの計算に使う",
  {
    category_name: z.string().optional().describe('カテゴリ名（既定: 特殊寝台）。完全一致。省略時は特殊寝台'),
    months: z.number().optional().describe("月平均を出す対象月数（既定6）。最新の未完月は自動で除外"),
  },
  async ({ category_name, months }) => {
    await signInIfConfigured();
    const catName = category_name || "特殊寝台";
    const win = months && months > 0 ? Math.floor(months) : 6;

    const { data: cats, error: ce } = await supabase.from("categories").select("id,name");
    if (ce) return { content: [{ type: "text", text: `Error(categories): ${ce.message}` }] };
    const cat = (cats || []).find((c: any) => c.name === catName);
    if (!cat) {
      const names = (cats || []).map((c: any) => c.name).join(" / ");
      return { content: [{ type: "text", text: `カテゴリ「${catName}」が見つかりません。実在するのは: ${names}` }] };
    }
    const { data: prods, error: pe } = await supabase.from("products").select("id").eq("category_id", cat.id);
    if (pe) return { content: [{ type: "text", text: `Error(products): ${pe.message}` }] };
    const pids = (prods || []).map((p: any) => p.id);
    if (!pids.length) return { content: [{ type: "text", text: `カテゴリ「${catName}」に商品が登録されていません` }] };

    const { data: items, error: ie } = await supabase
      .from("product_items").select("id,status").in("product_id", pids).range(0, 9999);
    if (ie) return { content: [{ type: "text", text: `Error(product_items): ${ie.message}` }] };
    const itemIds = new Set((items || []).map((i: any) => i.id));
    const byStatus: Record<string, number> = {};
    for (const i of (items || []) as any[]) byStatus[i.status] = (byStatus[i.status] || 0) + 1;

    // 返却イベントの月別件数（item_id と timestamp のみ読む）
    const hist: any[] = [];
    for (let off = 0; ; off += 1000) {
      const { data, error } = await supabase
        .from("item_histories").select("item_id,timestamp").eq("action", "返却")
        .order("timestamp", { ascending: true }).range(off, off + 999);
      if (error) return { content: [{ type: "text", text: `Error(item_histories): ${error.message}` }] };
      hist.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    const perMonth: Record<string, number> = {};
    for (const h of hist) {
      if (!itemIds.has(h.item_id)) continue;
      const k = String(h.timestamp).slice(0, 7);
      perMonth[k] = (perMonth[k] || 0) + 1;
    }
    const keys = Object.keys(perMonth).sort();
    const closed = keys.slice(0, -1).slice(-win);   // 最新月は未完なので除外
    const avg = closed.length ? closed.reduce((a, k) => a + perMonth[k], 0) / closed.length : 0;

    const body = {
      対象カテゴリ: catName,
      個体数: (items || []).length,
      消毒待ち: byStatus["returned"] || 0,
      消毒中: byStatus["cleaning"] || 0,
      月平均の返却台数: Number(avg.toFixed(1)),
      月平均の算出期間: closed.length ? `${closed[0]}〜${closed[closed.length - 1]}（${closed.length}ヶ月）` : "データ不足",
      ステータス内訳: byStatus,
      注意: "returned ステータスが入力されていない個体は含まれない",
    };
    return { content: [{ type: "text", text: JSON.stringify(body, null, 2) }] };
  }
);

// --- 在庫サマリ ---
server.tool(
  "get_inventory_summary",
  "在庫のステータス別サマリを取得（available, rented, maintenance等の件数）",
  {},
  async () => {
    const { data, error } = await supabase
      .from("product_items")
      .select("status")
      .range(0, 9999);
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };

    const summary: Record<string, number> = {};
    for (const item of data || []) {
      summary[item.status] = (summary[item.status] || 0) + 1;
    }
    const total = data?.length ?? 0;
    return {
      content: [
        {
          type: "text",
          text: `合計: ${total}件\n${JSON.stringify(summary, null, 2)}`,
        },
      ],
    };
  }
);

// --- 顧客名で検索 ---
server.tool(
  "search_by_customer",
  "顧客名で貸与中の商品アイテムを検索",
  { customer_name: z.string().describe("顧客名（部分一致）") },
  async ({ customer_name }) => {
    const { data, error } = await supabase
      .from("product_items")
      .select("*")
      .ilike("customer_name", `%${customer_name}%`)
      .order("loan_start_date", { ascending: false });
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return {
      content: [
        { type: "text", text: `${data?.length ?? 0}件ヒット\n${JSON.stringify(data, null, 2)}` },
      ],
    };
  }
);

// --- ラベル印刷キュー ---
server.tool(
  "get_label_queue",
  "ラベル印刷キューを取得",
  {
    status: z
      .enum(["pending", "printing", "completed", "failed"])
      .optional()
      .describe("印刷ステータスでフィルタ"),
  },
  async ({ status }) => {
    let query = supabase
      .from("label_print_queue")
      .select("*")
      .order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// --- ユーザー一覧 ---
server.tool("get_users", "ユーザー一覧を取得", {}, async () => {
  const { data, error } = await supabase.from("users").select("*").order("name");
  if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ============================================================
// 書き込み（2026-08-18 追加）
// ============================================================
//
// 🔴 なぜ MCP に足すのか
//   Supabase MCP で DB を直接書くこともできるが、それだと**アプリと同じ手順**にならない。
//   このアプリは status を変えるたびに item_histories に1行残す設計で、履歴が
//   「いつ・誰が・何から何へ」の唯一の記録になっている。直書きはそれを飛ばす。
//   → 書き込みは必ずここを通し、**本体の更新と履歴を必ずセット**にする。
//
// 🔴 MCP_AGGREGATE_ONLY=1 のセッション（共通層・他の軸）では、この2本も登録されない。
//   AGGREGATE_SAFE に入れていないため上のラッパーが弾く。読みと同じ境界が自動で効く。

const ITEM_STATUS = [
  "available",
  "reserved",
  "ready_for_delivery",
  "rented",
  "returned",
  "cleaning",
  "maintenance",
  "demo_cancelled",
  "out_of_order",
  "unknown",
] as const;

const ITEM_CONDITION = ["good", "fair", "caution", "needs_repair", "unknown"] as const;

/** 履歴を1行残す。本体の更新が成功した後にだけ呼ぶ。 */
async function writeHistory(args: {
  itemId: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  performedBy: string;
  location?: string | null;
  condition?: string | null;
  customerName?: string | null;
  notes?: string | null;
}): Promise<string | null> {
  const { error } = await supabase.from("item_histories").insert({
    item_id: args.itemId,
    action: args.action,
    from_status: args.fromStatus,
    to_status: args.toStatus,
    performed_by: args.performedBy,
    timestamp: new Date().toISOString(),
    location: args.location ?? null,
    condition: args.condition ?? null,
    customer_name: args.customerName ?? null,
    notes: args.notes ?? null,
  });
  return error ? error.message : null;
}

/**
 * ラベル印刷キューに1行入れる。成功なら error=null。
 *
 * 🔴 2026-08-18 田口さんの指示:「新規登録や入庫処理をしたときはラベル印刷はオンにしてほしい」
 *   → 呼び出し側が明示しない限り、新規登録と入庫処理では**既定でここを通る**。
 *   キューに入れるだけで印刷はしない。実際の印刷はアプリの「ラベル印刷待ち」ページから。
 */
async function queueLabel(args: {
  itemId: string;
  productName?: string | null;
  conditionNotes?: string | null;
  createdBy: string;
}): Promise<{ error: string | null; productName: string; id: string | null }> {
  let productName = args.productName ?? "";
  // 商品名はキューの表示に使う。取れなくても登録は止めない（管理番号だけでも印刷できる）
  if (!productName) {
    const { data: item } = await supabase
      .from("product_items")
      .select("product_id")
      .eq("id", args.itemId)
      .maybeSingle();
    if (item) {
      const { data: product } = await supabase
        .from("products")
        .select("name")
        .eq("id", (item as any).product_id)
        .maybeSingle();
      productName = ((product as any)?.name as string) || "";
    }
  }

  const { data, error } = await supabase
    .from("label_print_queue")
    .insert({
      item_id: args.itemId,
      product_name: productName,
      management_id: args.itemId,
      condition_notes: args.conditionNotes ?? "",
      status: "pending",
      created_by: args.createdBy,
    })
    .select("id")
    .single();
  return { error: error ? error.message : null, productName, id: (data as any)?.id ?? null };
}

/**
 * キューに入れて、そのまま印刷まで行く。返すのは Slack にそのまま出せる1行。
 *
 * 2026-08-18 田口さん「これからの入庫処理や新規登録の際は指示せずとも自動でラベル印刷までいって」
 * → **キューに入れる／印刷する を分けない。**分けると「入れたのに刷っていない」が溜まる。
 *   刷りたくない時だけ print_label=false で止める。
 */
async function queueAndPrint(args: {
  itemId: string;
  productName?: string | null;
  conditionNotes?: string | null;
  by: string;
}): Promise<string> {
  // 🔴 ラベルで登録・更新ごと落とさない。
  //   本体の登録は成功しているのに「エラー」と返ると、田口さんは登録し直そうとして重複する。
  //   アプリ側も同じ考え方（new-item-dialog.tsx「ラベル印刷キューの追加に失敗してもアイテム登録は成功」）。
  try {
    return await queueAndPrintInner(args);
  } catch (e: any) {
    return `⚠️ 本体は反映済み。ラベルだけ失敗: ${e?.message ?? String(e)}`;
  }
}

async function queueAndPrintInner(args: {
  itemId: string;
  productName?: string | null;
  conditionNotes?: string | null;
  by: string;
}): Promise<string> {
  const { error, productName, id } = await queueLabel({
    itemId: args.itemId,
    productName: args.productName ?? null,
    conditionNotes: args.conditionNotes ?? null,
    createdBy: args.by,
  });
  if (error) return `⚠️ ラベル印刷キューへの追加に失敗: ${error}`;
  if (!id) return "ラベル印刷キューに追加しました（印刷は print_label_queue で）";

  return await printQueueRow(
    {
      id,
      management_id: args.itemId,
      product_name: productName,
      condition_notes: args.conditionNotes ?? null,
    },
    args.by
  );
}

// --- 新規登録 ---
server.tool(
  "create_product_item",
  "商品アイテム（個体）を新規登録する。管理番号の重複と product_id の存在を先に確認し、履歴も1行残す",
  {
    id: z.string().describe("個別管理番号（例: RP-001）。既存と重複したら登録しない"),
    product_id: z.string().describe("商品ID。存在しなければ登録しない"),
    location: z.string().describe("倉庫での管理場所"),
    status: z.enum(ITEM_STATUS).optional().describe("初期ステータス（既定: available）"),
    condition: z.enum(ITEM_CONDITION).optional().describe("状態（既定: good）"),
    qr_code: z.string().optional().describe("QRコード（既定: id と同じ）"),
    condition_notes: z.string().optional().describe("状態メモ"),
    performed_by: z.string().optional().describe("実行者名（既定: MCP）"),
    print_label: z
      .boolean()
      .optional()
      .describe("ラベルを**印刷まで**するか。**既定 true**（田口さん指示・2026-08-18）。要らない時だけ false"),
  },
  async (a) => {
    const performedBy = a.performed_by ?? "MCP";
    const status = a.status ?? "available";

    const { data: dup } = await supabase
      .from("product_items")
      .select("id")
      .eq("id", a.id)
      .maybeSingle();
    if (dup) {
      return { content: [{ type: "text", text: `中止: 管理番号 ${a.id} は既に存在します` }] };
    }

    const { data: product, error: pErr } = await supabase
      .from("products")
      .select("id, name")
      .eq("id", a.product_id)
      .maybeSingle();
    if (pErr) return { content: [{ type: "text", text: `Error: ${pErr.message}` }] };
    if (!product) {
      return { content: [{ type: "text", text: `中止: product_id ${a.product_id} が存在しません` }] };
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from("product_items").insert({
      id: a.id,
      product_id: a.product_id,
      status,
      condition: a.condition ?? "good",
      location: a.location,
      qr_code: a.qr_code ?? a.id,
      // ⚠️ 型定義(src/types)には current_setting があるが、**本番DBの列には無い**（2026-08-18 実測）。
      //    書くと "Could not find the 'current_setting' column" で insert ごと失敗する。
      //    型と実DBがずれている。足すなら先にマイグレーションから。
      condition_notes: a.condition_notes ?? null,
      created_at: now,
      updated_at: now,
    });
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };

    const histErr = await writeHistory({
      itemId: a.id,
      action: "新規登録",
      // ⚠️ item_histories.from_status は NOT NULL（2026-08-18 実測）。
      //    新規登録には「前の状態」が無いので空文字を入れる。null だと insert が落ちる。
      fromStatus: "",
      toStatus: status,
      performedBy,
      location: a.location,
      condition: a.condition ?? "good",
      notes: a.condition_notes ?? null,
    });

    // 新規登録は既定でラベルを**印刷まで**する（田口さん指示・2026-08-18）
    let labelLine = "";
    if (a.print_label ?? true) {
      labelLine =
        "\n" +
        (await queueAndPrint({
          itemId: a.id,
          productName: (product as any).name ?? null,
          conditionNotes: a.condition_notes ?? null,
          by: performedBy,
        }));
    }

    return {
      content: [
        {
          type: "text",
          text:
            `登録しました: ${a.id}（${(product as any).name ?? a.product_id}）status=${status} 場所=${a.location}` +
            (histErr ? `\n⚠️ 本体は登録済みだが履歴の記録に失敗: ${histErr}` : "\n履歴も1行残しました") +
            labelLine,
        },
      ],
    };
  }
);

// --- ステータス更新 ---
server.tool(
  "update_item_status",
  "商品アイテムのステータス等を更新する。現在値を読んでから更新し、履歴（from→to）を1行残す",
  {
    item_id: z.string().describe("個別管理番号（例: RP-001）"),
    status: z.enum(ITEM_STATUS).describe("新しいステータス"),
    condition: z.enum(ITEM_CONDITION).optional().describe("状態も変える場合"),
    location: z.string().optional().describe("保管場所も変える場合"),
    customer_name: z.string().optional().describe("貸与先。返却時は空文字を渡すとクリアされる"),
    loan_start_date: z.string().optional().describe("貸与開始日 YYYY-MM-DD。空文字でクリア"),
    condition_notes: z.string().optional().describe("状態メモ"),
    performed_by: z.string().optional().describe("実行者名（既定: MCP）"),
    action: z.string().optional().describe("履歴に残す操作名（既定: ステータス更新）。倉庫に戻す時は「入庫処理」"),
    // 🔴 2026-08-31 追加。累計貸与日数は scan_action の「返却」でしか増えない＝**直す道が無かった。**
    //    誤って入った値（試験・二重計上・移行時のずれ）を戻せるようにする。
    //    増やす用途では使わない。増やすのは返却だけ。
    total_rental_days: z.number().int().min(0).optional()
      .describe("累計貸与日数を**上書き**する。訂正専用。通常は触らない（増えるのは scan_action の返却のみ）"),
    print_label: z
      .boolean()
      .optional()
      .describe("ラベルを**印刷まで**するか。**既定は action に「入庫」を含む時 true**（田口さん指示・2026-08-18）"),
  },
  async (a) => {
    const performedBy = a.performed_by ?? "MCP";

    const { data: current, error: cErr } = await supabase
      .from("product_items")
      .select("*")
      .eq("id", a.item_id)
      .maybeSingle();
    if (cErr) return { content: [{ type: "text", text: `Error: ${cErr.message}` }] };
    if (!current) {
      return { content: [{ type: "text", text: `中止: ${a.item_id} が見つかりません` }] };
    }

    const from = (current as any).status as string;
    const patch: Record<string, any> = { status: a.status, updated_at: new Date().toISOString() };
    if (a.condition !== undefined) patch.condition = a.condition;
    if (a.location !== undefined) patch.location = a.location;
    if (a.condition_notes !== undefined) patch.condition_notes = a.condition_notes;
    // 空文字はクリア（返却で貸与先を消す用途）
    if (a.customer_name !== undefined) patch.customer_name = a.customer_name === "" ? null : a.customer_name;
    if (a.loan_start_date !== undefined)
      patch.loan_start_date = a.loan_start_date === "" ? null : a.loan_start_date;
    if (a.total_rental_days !== undefined) patch.total_rental_days = a.total_rental_days;

    const { error } = await supabase.from("product_items").update(patch).eq("id", a.item_id);
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };

    const action = a.action ?? "ステータス更新";
    const histErr = await writeHistory({
      itemId: a.item_id,
      action,
      fromStatus: from,
      toStatus: a.status,
      performedBy,
      location: patch.location ?? (current as any).location,
      condition: patch.condition ?? (current as any).condition,
      customerName: patch.customer_name ?? (current as any).customer_name ?? null,
      notes: a.condition_notes ?? null,
    });

    // 入庫処理は既定でラベルを**印刷まで**する（アプリのスキャン画面が
    // 入庫のあとに「ラベルを印刷しますか？」を出すのと同じ場面）
    let labelLine = "";
    if (a.print_label ?? /入庫/.test(action)) {
      labelLine =
        "\n" +
        (await queueAndPrint({
          itemId: a.item_id,
          conditionNotes: a.condition_notes ?? (current as any).condition_notes ?? null,
          by: performedBy,
        }));
    }

    return {
      content: [
        {
          type: "text",
          text:
            `更新しました: ${a.item_id} ${from} → ${a.status}` +
            (histErr ? `\n⚠️ 本体は更新済みだが履歴の記録に失敗: ${histErr}` : "\n履歴も1行残しました") +
            labelLine,
        },
      ],
    };
  }
);

// --- QRスキャンで出せる操作の一覧 ---
//
// 2026-08-31 追加。田口さん「返却・消毒・メンテ・入庫は単にステータスを書き換えるのでは
// なく QRスキャン時のフローに従って行ってほしい」。
// **何ができるかは呼ぶ側が数え上げない。**ここに聞く。
server.tool(
  "list_scan_actions",
  "その個体に対していま実行できる操作（QRスキャン画面と同じ）を返す。scan_action の前に必ず呼ぶ",
  { item_id: z.string().describe("個別管理番号（例: SL-128）") },
  async ({ item_id }) => {
    const { data: item, error } = await supabase
      .from("product_items").select("id, status, condition, customer_name, loan_start_date, location, total_rental_days")
      .eq("id", item_id).maybeSingle();
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    if (!item) return { content: [{ type: "text", text: `中止: ${item_id} が見つかりません` }] };
    const st = (item as any).status as string;
    const actions = getAvailableActions(st);
    const lines = actions.map(
      (a) => `- ${a.key} … ${a.label} → ${STATUS_LABEL[a.nextStatus] ?? a.nextStatus} (${a.nextStatus})` +
             (a.danger ? "  ⚠️ 確認が要る操作" : "")
    );
    return { content: [{ type: "text", text:
      `${item_id} はいま「${STATUS_LABEL[st as keyof typeof STATUS_LABEL] ?? st}」(${st})` +
      `${(item as any).customer_name ? " / 貸与先 " + (item as any).customer_name : ""}` +
      `${(item as any).loan_start_date ? " / 貸与開始 " + (item as any).loan_start_date : ""}\n` +
      (lines.length ? `いまできる操作:\n${lines.join("\n")}` :
        "いまできる操作はありません（遷移表にこの状態からの道がない）") }] };
  }
);

// --- QRスキャンと同じ流れで動かす ---
//
// 🔴 update_item_status との違い: **こちらは流れに従う。**
//   ① いまの状態から行ける操作しか受け付けない（遷移表はアプリと共有）
//   ② 履歴の action 名を固定のものにする（集計の軸。ラベル文言を変えても途切れない）
//   ③ 返却では貸与日数を計算して total_rental_days に足し、貸与先と開始日を消す
//   ④ condition が needs_repair なら status を out_of_order に倒す（廃棄は優先）
//   ⑤ 状態メモはメンテナンス・修理完了のときだけ保存する
//   ⑥ 入庫はラベルを印刷まで行く
//   ここは src/components/scan-action-dialog.tsx の handleActionSubmit と同じ挙動。
server.tool(
  "scan_action",
  "QRスキャン画面と同じ流れで個体を動かす。返却・消毒・メンテ・入庫はこちらを使う（update_item_status は流れを通らない）",
  {
    item_id: z.string().describe("個別管理番号（例: SL-128）"),
    action_key: z.string().describe("操作キー。list_scan_actions で確認してから渡す（return / clean / maintenance / storage 等）"),
    condition: z.enum(ITEM_CONDITION).optional().describe("状態も変える場合。needs_repair なら故障中へ倒れる"),
    condition_notes: z.string().optional().describe("状態メモ。メンテナンス完了・修理完了のときだけ保存される"),
    location: z.string().optional().describe("保管場所も変える場合"),
    performed_by: z.string().optional().describe("実行者名（既定: MCP）"),
    print_label: z.boolean().optional().describe("ラベルを印刷まで行くか。既定は操作名に「入庫」を含む時 true"),
  },
  async (a) => {
    const performedBy = a.performed_by ?? "MCP";
    const { data: item, error: iErr } = await supabase
      .from("product_items").select("*").eq("id", a.item_id).maybeSingle();
    if (iErr) return { content: [{ type: "text", text: `Error: ${iErr.message}` }] };
    if (!item) return { content: [{ type: "text", text: `中止: ${a.item_id} が見つかりません` }] };

    const cur = item as any;
    const from = cur.status as string;
    const actions = getAvailableActions(from);
    const action = actions.find((x) => x.key === a.action_key);
    if (!action) {
      return { content: [{ type: "text", text:
        `中止: 「${from}」から ${a.action_key} には行けません。` +
        `いまできるのは ${actions.length ? actions.map((x) => `${x.key}(${x.label})`).join(" / ") : "なし"}` }] };
    }

    // ④ 要修理なら故障中へ倒す。ただし廃棄が優先（アプリと同じ）
    const newCondition = (a.condition ?? cur.condition) as string;
    const finalStatus = (action.nextStatus === "disposed" || newCondition !== "needs_repair")
      ? action.nextStatus : "out_of_order";

    // ⑤ 状態メモはメンテナンス完了・修理完了のときだけ
    const savesNotes = ["maintenance", "repair"].includes(action.key);
    const notes = savesNotes ? (a.condition_notes ?? cur.condition_notes ?? null) : (cur.condition_notes ?? null);

    const patch: Record<string, any> = {
      status: finalStatus,
      condition: newCondition,
      location: a.location ?? cur.location,
      condition_notes: notes,
      updated_at: new Date().toISOString(),
    };

    // ③ 返却は貸与日数を足して、貸与先と開始日を消す
    let rentalLine = "";
    if (action.key === "return") {
      if (cur.loan_start_date) {
        const start = new Date(cur.loan_start_date); start.setHours(0, 0, 0, 0);
        const end = new Date(); end.setHours(0, 0, 0, 0);
        const days = Math.ceil(Math.abs(end.getTime() - start.getTime()) / 86400000);
        patch.total_rental_days = (cur.total_rental_days || 0) + days;
        rentalLine = `\n貸与 ${days}日を加算（累計 ${patch.total_rental_days}日）`;
      }
      patch.customer_name = null;
      patch.loan_start_date = null;
    }

    const { error } = await supabase.from("product_items").update(patch).eq("id", a.item_id);
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };

    // ② 履歴の操作名は固定。要修理で倒れた時だけアプリと同じく「故障中へ変更」
    const record = newCondition === "needs_repair" && finalStatus === "out_of_order"
      ? "故障中へ変更" : recordName(action);
    // 🔴 返却で消すものを、消す前に履歴へ残す（2026-09-02・実際に失って直した）。
    //
    //   それまでは返却時に customerName に null を渡していた（アプリと同じ作り）。
    //   その結果、誤って返却処理を流した個体（AU-003）の**貸与先と貸与開始日が
    //   完全に消え、履歴のどこにも残らなかった。**復元の道が無くなる。
    //
    //   「誰にいつ貸していたか」は**消す前にしか書けない。消す側が残す。**
    const clearedNote = action.key === "return"
      ? [`貸与先 ${cur.customer_name || "（記録なし）"}`,
         cur.loan_start_date ? `貸与開始 ${cur.loan_start_date}` : null,
         rentalLine ? rentalLine.replace(/^\n/, "") : null].filter(Boolean).join(" / ")
      : null;
    const histErr = await writeHistory({
      itemId: a.item_id, action: record, fromStatus: from, toStatus: finalStatus, performedBy,
      location: patch.location, condition: newCondition,
      // 返却でも**消す前の貸与先を残す。**null を入れると辿れなくなる
      customerName: cur.customer_name ?? null,
      notes: clearedNote ?? (savesNotes ? (a.condition_notes ?? null) : null),
    });

    // ⑥ 入庫はラベルまで（田口さん 2026-08-31「新規登録と入庫処理をした場合はラベルは常に印刷」）
    let labelLine = "";
    if (a.print_label ?? /入庫/.test(record)) {
      labelLine = "\n" + (await queueAndPrint({ itemId: a.item_id, conditionNotes: notes, by: performedBy }));
    }

    return { content: [{ type: "text", text:
      `${record}: ${a.item_id} ${from} → ${finalStatus}` +
      (finalStatus !== action.nextStatus ? `（要修理のため ${action.nextStatus} ではなく故障中へ）` : "") +
      rentalLine +
      (histErr ? `\n⚠️ 本体は更新済みだが履歴の記録に失敗: ${histErr}` : "\n履歴も1行残しました") +
      labelLine }] };
  }
);

// --- ラベル印刷キューに追加 ---
//
// 2026-08-18 追加。**足した理由を残しておく:**
// Slack の L4 から「返却→消毒→入庫→ラベル追加」を1本で頼まれた時、ステータス3段は
// update_item_status で通ったが、ラベル追加のツールが無かったので **Bash から DB を直接叩いた。**
// 結果は正しかったが、それは「直書きは禁止」と自分で書いた経路そのもの。
// **よく使う流れがツールで閉じていないと、直書きに逃げる。**だからここに足す。
server.tool(
  "queue_label_print",
  "ラベル印刷キューに1件追加する。個体の存在と商品名を先に引いてから登録する",
  {
    item_id: z.string().describe("個別管理番号（例: RA-069）"),
    condition_notes: z.string().optional().describe("状態メモ（既定: 空）"),
    created_by: z.string().optional().describe("登録者名（既定: MCP）"),
  },
  async ({ item_id, condition_notes, created_by }) => {
    const { data: item, error: iErr } = await supabase
      .from("product_items")
      .select("id, product_id")
      .eq("id", item_id)
      .maybeSingle();
    if (iErr) return { content: [{ type: "text", text: `Error: ${iErr.message}` }] };
    if (!item) return { content: [{ type: "text", text: `中止: ${item_id} が見つかりません` }] };

    // 商品名はキューの表示に使う。取れなくても登録は止めない（管理番号だけでも印刷できる）
    let productName = "";
    const { data: product } = await supabase
      .from("products")
      .select("name")
      .eq("id", (item as any).product_id)
      .maybeSingle();
    if (product) productName = (product as any).name || "";

    const { error } = await supabase.from("label_print_queue").insert({
      item_id,
      product_name: productName,
      management_id: item_id,
      condition_notes: condition_notes ?? "",
      status: "pending",
      created_by: created_by ?? "MCP",
    });
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };

    return {
      content: [
        { type: "text", text: `ラベルキューに追加しました: ${item_id}（${productName || "商品名なし"}）status=pending` },
      ],
    };
  }
);

// --- 実際に印刷する ---
//
// 2026-08-18 追加。田口さん「作って」。
// アプリ側（src/lib/label-printer.ts）は b-PAC の **ブラウザ拡張**を呼ぶので、
// 画面を開いて人が押さないと刷れない。ここは同じ b-PAC を **COM** で叩くため、
// WSL のリスナー（L4）から powershell.exe 越しに印刷できる。
//
// 🔴 プリンタのオンライン確認はしない。
//   USB が消えていてもジョブは Windows のスプーラに溜まり、電源を入れると出る
//   （田口さん「プリンタが落ちてても電源を入れたときに出てくる仕様じゃないの？」）。
//   だから「送った」と「出た」を分けて記録する:
//     printing  = スプーラに渡した（まだ紙は出ていないかもしれない）
//     completed = スプーラからジョブが消えた＝出た
//     failed    = ジョブが止まった / 例外
const execFileAsync = promisify(execFile);
const POWERSHELL = "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe";
const PRINTER_NAME = "Brother QL-800";
const PRINT_SCRIPT_WIN =
  "C:\\Users\\taguchi\\Desktop\\claude-kanri\\welfare-equipment-manager\\scripts\\print-label.ps1";

type PrintResult = { ok: boolean; stage: string; message?: string; states?: string[] };

async function printOne(row: {
  management_id: string;
  product_name: string | null;
  condition_notes: string | null;
}): Promise<PrintResult> {
  try {
    const { stdout } = await execFileAsync(
      POWERSHELL,
      [
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", PRINT_SCRIPT_WIN,
        "-ManagementId", row.management_id,
        "-ProductName", row.product_name ?? "",
        "-ConditionNotes", row.condition_notes ?? "",
      ],
      { timeout: 90_000, maxBuffer: 4 * 1024 * 1024 }
    );
    // PowerShell が BOM や改行を混ぜることがあるので JSON の部分だけ取る
    const m = stdout.match(/\{[\s\S]*\}/);
    if (!m) return { ok: false, stage: "parse", message: `想定外の出力: ${stdout.slice(0, 200)}` };
    return JSON.parse(m[0]) as PrintResult;
  } catch (e: any) {
    const msg = e?.code === "ENOENT" ? `powershell.exe が見つかりません: ${POWERSHELL}` : e?.message ?? String(e);
    return { ok: false, stage: "spawn", message: msg };
  }
}

/**
 * 前回 printing のまま止まった行を拾い直す。
 *
 * ⚠️ 2026-08-18 実測: SL-119 が printing で残った。12秒待っても消えなかっただけで、
 *   実際にはラベルは出ていた（田口さん確認・スプーラも空）。
 *   **待ち時間を延ばしても同じことは起きる。**待つのではなく、後から辻褄を合わせる。
 *   スプーラが空 = 送った分は全部出た、と見なせる。
 */
async function reconcilePrinting(): Promise<void> {
  try {
    const { stdout } = await execFileAsync(
      POWERSHELL,
      ["-NoProfile", "-Command", `@(Get-PrintJob -PrinterName '${PRINTER_NAME}' -ErrorAction SilentlyContinue).Count`],
      { timeout: 20_000 }
    );
    const n = Number.parseInt(stdout.trim(), 10);
    if (!Number.isFinite(n) || n > 0) return; // まだ待ちがいる間は触らない
    await supabase
      .from("label_print_queue")
      .update({ status: "completed", printed_at: new Date().toISOString() })
      .eq("status", "printing");
  } catch {
    // 見に行けなかっただけ。次の印刷でまた拾う
  }
}

/** キューの1行を印刷して status を更新する。返すのは Slack にそのまま出せる1行。 */
async function printQueueRow(
  row: { id: string; management_id: string; product_name: string | null; condition_notes: string | null },
  by: string
): Promise<string> {
  const name = row.product_name || "商品名なし";
  await reconcilePrinting(); // 前回の取りこぼしを先に片づける
  await supabase.from("label_print_queue").update({ status: "printing" }).eq("id", row.id);

  const res = await printOne(row);

  if (!res.ok) {
    await supabase
      .from("label_print_queue")
      .update({ status: "failed", error_message: `${res.stage}: ${res.message ?? ""}`.slice(0, 500) })
      .eq("id", row.id);
    return `❌ ラベル ${row.management_id}（${name}）… ${res.message ?? res.stage}`;
  }

  if (res.stage === "queued") {
    // スプーラで待っている。status は printing のまま（出たかどうかまだ分からない）
    await supabase.from("label_print_queue").update({ printed_by: by }).eq("id", row.id);
    return `🕒 ラベル ${row.management_id}（${name}）… プリンタに送信済み。電源が入れば出ます`;
  }

  await supabase
    .from("label_print_queue")
    .update({ status: "completed", printed_at: new Date().toISOString(), printed_by: by, error_message: null })
    .eq("id", row.id);
  return `✅ ラベル ${row.management_id}（${name}）… 印刷しました`;
}

server.tool(
  "print_label_queue",
  "ラベル印刷キューの pending を実際に印刷する（Brother QL-800・b-PAC COM 経由。ブラウザ不要）",
  {
    item_id: z.string().optional().describe("この個体の分だけ印刷する。省略すると pending を古い順に処理"),
    limit: z.number().int().min(1).max(50).optional().describe("一度に印刷する上限（既定: 10）"),
    performed_by: z.string().optional().describe("実行者名（既定: MCP）"),
  },
  async ({ item_id, limit, performed_by }) => {
    const by = performed_by ?? "MCP";
    let q = supabase
      .from("label_print_queue")
      .select("id, item_id, management_id, product_name, condition_notes")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(limit ?? 10);
    if (item_id) q = q.eq("item_id", item_id);

    const { data: rows, error } = await q;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    if (!rows || rows.length === 0) {
      return {
        content: [
          { type: "text", text: item_id ? `${item_id} の未印刷ラベルはありません` : "未印刷のラベルはありません" },
        ],
      };
    }

    const lines: string[] = [];
    for (const r of rows as any[]) {
      lines.push(await printQueueRow(r, by));
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

// ============================================================
// Start server
// ============================================================
async function main() {
  // 🔴 起動時に1回ログインする（2026-07-31 修正）
  //
  // これまで signInIfConfigured() は get_disinfection_backlog の中でしか呼んでいなかった。
  // 2026-07-30 に認証を足したとき、作っていたツール1本にしか入れなかったのが原因。
  // 残り13本は anon のまま走り、**RLS に弾かれて HTTP 200 + 空配列**を返していた
  // （`get_inventory_summary` → 「合計: 0件 {}」）。
  //
  // 「在庫DBが読めない」の正体はこれ。**ツールごとではなく、ここで1回だけ認証する。**
  // 以後ツールを足しても、認証を書き忘れて空を返す事故が起きない。
  await signInIfConfigured();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Welfare Equipment MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
