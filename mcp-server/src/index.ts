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

const supabaseUrl =
  process.env.VITE_SUPABASE_URL ||
  "https://xbltuzyazsafxbacrzfs.supabase.co";
const supabaseKey =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhibHR1enlhenNhZnhiYWNyemZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMjU5NjMsImV4cCI6MjA2ODkwMTk2M30.RwlAsXQ_sj9k9-5Zxs3aP0pC3seKOVe-NVVi-ioSykw";

const supabase = createClient(supabaseUrl, supabaseKey);

const server = new McpServer({
  name: "welfare-equipment-manager",
  version: "1.0.0",
});

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
      .from("item_history")
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
server.tool("get_deposits", "預かり品一覧を取得", {}, async () => {
  const { data, error } = await supabase
    .from("deposits")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

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
// Start server
// ============================================================
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Welfare Equipment MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
