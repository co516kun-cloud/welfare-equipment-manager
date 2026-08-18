import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

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

    return {
      content: [
        {
          type: "text",
          text:
            `登録しました: ${a.id}（${(product as any).name ?? a.product_id}）status=${status} 場所=${a.location}` +
            (histErr ? `\n⚠️ 本体は登録済みだが履歴の記録に失敗: ${histErr}` : "\n履歴も1行残しました"),
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
    action: z.string().optional().describe("履歴に残す操作名（既定: ステータス更新）"),
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

    const { error } = await supabase.from("product_items").update(patch).eq("id", a.item_id);
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };

    const histErr = await writeHistory({
      itemId: a.item_id,
      action: a.action ?? "ステータス更新",
      fromStatus: from,
      toStatus: a.status,
      performedBy,
      location: patch.location ?? (current as any).location,
      condition: patch.condition ?? (current as any).condition,
      customerName: patch.customer_name ?? (current as any).customer_name ?? null,
      notes: a.condition_notes ?? null,
    });

    return {
      content: [
        {
          type: "text",
          text:
            `更新しました: ${a.item_id} ${from} → ${a.status}` +
            (histErr ? `\n⚠️ 本体は更新済みだが履歴の記録に失敗: ${histErr}` : "\n履歴も1行残しました"),
        },
      ],
    };
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
