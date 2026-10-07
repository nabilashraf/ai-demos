import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface OrderItem {
  sku: string;
  qty: number;
  price: number;
}

export interface Order {
  id: string;
  customer: string;
  email: string;
  total: number;
  currency: string;
  status: string;
  items: OrderItem[];
  refunded: boolean;
}

interface StoreFile {
  orders: Order[];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_PATH = path.resolve(__dirname, "..", "data", "orders.json");

const INITIAL: StoreFile = {
  orders: [
    {
      id: "ORD-1001",
      customer: "Amina Khan",
      email: "amina@example.com",
      total: 89.5,
      currency: "USD",
      status: "delivered",
      items: [{ sku: "NB-CASE", qty: 1, price: 89.5 }],
      refunded: false,
    },
    {
      id: "ORD-1002",
      customer: "Leo Martins",
      email: "leo@example.com",
      total: 240.0,
      currency: "USD",
      status: "shipped",
      items: [
        { sku: "DESK-MAT", qty: 2, price: 45.0 },
        { sku: "USB-HUB", qty: 1, price: 150.0 },
      ],
      refunded: false,
    },
    {
      id: "ORD-1003",
      customer: "Priya Shah",
      email: "priya@example.com",
      total: 32.0,
      currency: "USD",
      status: "delivered",
      items: [{ sku: "CABLE-USB-C", qty: 2, price: 16.0 }],
      refunded: true,
    },
  ],
};

let cache: StoreFile | null = null;

async function load(): Promise<StoreFile> {
  if (cache) return cache;
  try {
    const raw = await readFile(DATA_PATH, "utf8");
    cache = JSON.parse(raw) as StoreFile;
  } catch {
    cache = structuredClone(INITIAL);
    await persist(cache);
  }
  return cache;
}

async function persist(store: StoreFile): Promise<void> {
  cache = store;
  await writeFile(DATA_PATH, JSON.stringify(store, null, 2) + "\n");
}

export async function getOrder(orderId: string): Promise<Order | null> {
  const store = await load();
  return store.orders.find((o) => o.id === orderId) ?? null;
}

export async function listOrders(): Promise<Order[]> {
  const store = await load();
  return store.orders;
}

export async function refundOrder(
  orderId: string,
  reason: string
): Promise<{ ok: boolean; order?: Order; error?: string; reason?: string }> {
  const store = await load();
  const order = store.orders.find((o) => o.id === orderId);
  if (!order) return { ok: false, error: `Order ${orderId} not found` };
  if (order.refunded) return { ok: false, error: `Order ${orderId} already refunded` };
  if (order.status === "cancelled") {
    return { ok: false, error: `Order ${orderId} is cancelled` };
  }
  order.refunded = true;
  order.status = "refunded";
  await persist(store);
  return { ok: true, order: { ...order }, reason };
}

/** Reset to initial demo fixture. */
export async function resetDemoState(): Promise<void> {
  cache = null;
  await persist(structuredClone(INITIAL));
}
