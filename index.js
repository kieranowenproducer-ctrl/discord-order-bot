// index.js
// Discord Shop Bot (discord.js v14 + Postgres)
// Features:
// - shop
// - verification system
// - stock control
// - duplicate order protection
// - mark as dispatched
// - staff admin panel
// - database driven categories and products

const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  EmbedBuilder,
} = require("discord.js");

const { Pool } = require("pg");

/* ----------------------------- ENV / CONFIG ----------------------------- */

const TOKEN = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const DATABASE_URL = process.env.DATABASE_URL;

const GUILD_ID = process.env.GUILD_ID;
const MENU_CHANNEL_ID = process.env.MENU_CHANNEL_ID;
const ORDERS_CATEGORY_ID = process.env.ORDERS_CATEGORY_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;

const VERIFY_CHANNEL_ID = process.env.VERIFY_CHANNEL_ID;
const VERIFICATION_LOG_CHANNEL_ID = process.env.VERIFICATION_LOG_CHANNEL_ID;
const VERIFIED_ROLE_ID = process.env.VERIFIED_ROLE_ID;
const STAFF_ONLY_CHANNEL_ID = process.env.STAFF_ONLY_CHANNEL_ID;

// Bank details via env vars
const BANK_ACCOUNT_NAME = process.env.BANK_ACCOUNT_NAME || "YOUR COMPANY LTD";
const BANK_SORT_CODE = process.env.BANK_SORT_CODE || "00-00-00";
const BANK_ACCOUNT_NUMBER = process.env.BANK_ACCOUNT_NUMBER || "00000000";
const BANK_BANK_NAME = process.env.BANK_BANK_NAME || "YOUR BANK";
const BANK_IBAN = process.env.BANK_IBAN || "";
const BANK_SWIFT = process.env.BANK_SWIFT || "";

const STORE_NAME = "Bodymarket Labs Store";

const DEFAULT_SIZE = "Standard";
const DEFAULT_COLOR = "Standard";

const WELCOME_CODE = "WELCOME10";
const WELCOME_DISCOUNT_PERCENT = 10;

function requireEnv(name, value) {
  if (!value) throw new Error(`Missing required env var: ${name}`);
}

requireEnv("DISCORD_TOKEN or BOT_TOKEN", TOKEN);
requireEnv("CLIENT_ID", CLIENT_ID);
requireEnv("DATABASE_URL", DATABASE_URL);
requireEnv("GUILD_ID", GUILD_ID);
requireEnv("MENU_CHANNEL_ID", MENU_CHANNEL_ID);
requireEnv("ORDERS_CATEGORY_ID", ORDERS_CATEGORY_ID);
requireEnv("STAFF_ROLE_ID", STAFF_ROLE_ID);
requireEnv("VERIFY_CHANNEL_ID", VERIFY_CHANNEL_ID);
requireEnv("VERIFICATION_LOG_CHANNEL_ID", VERIFICATION_LOG_CHANNEL_ID);
requireEnv("VERIFIED_ROLE_ID", VERIFIED_ROLE_ID);
requireEnv("STAFF_ONLY_CHANNEL_ID", STAFF_ONLY_CHANNEL_ID);

/* --------------------- LEGACY CATALOG FOR INITIAL SEED -------------------- */

const LEGACY_CATALOG = {
  "cat 1": [
    { sku: "A01", name: "uuu", price_pence: 14000, stock_qty: 10 },
    { sku: "A02", name: "ttt", price_pence: 12000, stock_qty: 10 },
    { sku: "A03", name: "sss", price_pence: 14000, stock_qty: 10 },
    { sku: "A04", name: "rrr", price_pence: 11000, stock_qty: 10 },
    { sku: "A05", name: "qqq", price_pence: 16000, stock_qty: 10 },
    { sku: "A06", name: "ppp", price_pence: 17000, stock_qty: 10 },
    { sku: "A07", name: "ooo", price_pence: 15000, stock_qty: 10 },
    { sku: "A08", name: "nnn", price_pence: 16000, stock_qty: 10 },
    { sku: "A09", name: "mmm", price_pence: 11000, stock_qty: 10 },
    { sku: "A10", name: "lll", price_pence: 11000, stock_qty: 10 },
    { sku: "A11", name: "kkk", price_pence: 10000, stock_qty: 10 },
    { sku: "A12", name: "jjj", price_pence: 7000, stock_qty: 10 },
    { sku: "A13", name: "iii", price_pence: 7000, stock_qty: 10 },
    { sku: "A14", name: "hhh", price_pence: 6000, stock_qty: 10 },
    { sku: "A15", name: "ggg", price_pence: 8500, stock_qty: 10 },
    { sku: "A16", name: "fff", price_pence: 14000, stock_qty: 10 },
    { sku: "A17", name: "eee", price_pence: 5000, stock_qty: 10 },
    { sku: "A18", name: "ddd", price_pence: 3500, stock_qty: 10 },
  ],
  "cat 2": [
    { sku: "B01", name: "ccc", price_pence: 13000, stock_qty: 10 },
    { sku: "B02", name: "bbb", price_pence: 5000, stock_qty: 10 },
    { sku: "B03", name: "aaa", price_pence: 9000, stock_qty: 10 },
    { sku: "B04", name: "zz", price_pence: 2000, stock_qty: 10 },
  ],
  "cat 3": [
    { sku: "C01", name: "yy", price_pence: 6000, stock_qty: 10 },
    { sku: "C02", name: "xx", price_pence: 5500, stock_qty: 10 },
    { sku: "C03", name: "ww", price_pence: 7000, stock_qty: 10 },
  ],
  "cat 4": [
    { sku: "D01", name: "vv", price_pence: 3000, stock_qty: 10 },
    { sku: "D02", name: "uu", price_pence: 4000, stock_qty: 10 },
    { sku: "D03", name: "tt", price_pence: 6500, stock_qty: 10 },
  ],
  "cat 5": [
    { sku: "E01", name: "ss", price_pence: 14000, stock_qty: 10, default_size: "Standard", default_color: "Default" },
    { sku: "E02", name: "rr", price_pence: 11500, stock_qty: 10, default_size: "Standard", default_color: "Default" },
    { sku: "E03", name: "qq", price_pence: 13000, stock_qty: 10, default_size: "Standard", default_color: "Default" },
    { sku: "E04", name: "pp", price_pence: 5000, stock_qty: 10, default_size: "Standard", default_color: "Default" },
    { sku: "E05", name: "oo", price_pence: 9000, stock_qty: 10, default_size: "Standard", default_color: "Default" },
    { sku: "E06", name: "nn", price_pence: 3500, stock_qty: 10, default_size: "Standard", default_color: "Default" },
    { sku: "E07", name: "mm", price_pence: 3000, stock_qty: 10, default_size: "Standard", default_color: "Default" },
    { sku: "E08", name: "ll", price_pence: 3500, stock_qty: 10, default_size: "Standard", default_color: "Default" },
  ],
  "cat 6": [
    { sku: "F01", name: "kk", price_pence: 1500, stock_qty: 10, default_size: "Standard", default_color: "Default" },
    { sku: "F02", name: "jj", price_pence: 4000, stock_qty: 10, default_size: "Standard", default_color: "Default" },
    { sku: "F03", name: "ii", price_pence: 1000, stock_qty: 10, default_size: "Standard", default_color: "Default" },
    { sku: "F04", name: "hh", price_pence: 2500, stock_qty: 10, default_size: "Standard", default_color: "Default" },
    { sku: "F05", name: "gg", price_pence: 5000, stock_qty: 10, default_size: "Standard", default_color: "Default" },
    { sku: "F06", name: "ff", price_pence: 6000, stock_qty: 10, default_size: "Standard", default_color: "Default" },
    { sku: "F07", name: "ee", price_pence: 6000, stock_qty: 10, default_size: "Standard", default_color: "Default" },
  ],
  "cat 7": [
    { sku: "G01", name: "dd", price_pence: 4500, stock_qty: 10, default_size: "Standard", default_color: "Default" },
    { sku: "G02", name: "cc", price_pence: 6500, stock_qty: 10, default_size: "Standard", default_color: "Default" },
    { sku: "G03", name: "bb", price_pence: 5500, stock_qty: 10, default_size: "Standard", default_color: "Default" },
    { sku: "G04", name: "aa", price_pence: 4500, stock_qty: 10, default_size: "Standard", default_color: "Default" },
    { sku: "G05", name: "z", price_pence: 2500, stock_qty: 10, default_size: "Standard", default_color: "Default" },
    { sku: "G06", name: "y", price_pence: 2500, stock_qty: 10, default_size: "Standard", default_color: "Default" },
    { sku: "G07", name: "x", price_pence: 2000, stock_qty: 10, default_size: "Standard", default_color: "Default" },
  ],
  "cat 8": [
    { sku: "H01", name: "w", price_pence: 3500, stock_qty: 10, default_size: "Standard", default_color: "Default" },
    { sku: "H02", name: "v", price_pence: 3000, stock_qty: 10, default_size: "Standard", default_color: "Default" },
    { sku: "H03", name: "u", price_pence: 3000, stock_qty: 10, default_size: "Standard", default_color: "Default" },
    { sku: "H04", name: "t", price_pence: 2500, stock_qty: 10, default_size: "Standard", default_color: "Default" },
    { sku: "H05", name: "s", price_pence: 3000, stock_qty: 10, default_size: "Standard", default_color: "Default" },
    { sku: "H06", name: "r", price_pence: 3500, stock_qty: 10, default_size: "Standard", default_color: "Default" },
    { sku: "H07", name: "q", price_pence: 3500, stock_qty: 10, default_size: "Standard", default_color: "Default" },
    { sku: "H08", name: "p", price_pence: 3500, stock_qty: 10, default_size: "Standard", default_color: "Default" },
  ],
  "cat 9": [
    { sku: "I01", name: "o", price_pence: 1000, stock_qty: 10 },
    { sku: "I02", name: "n", price_pence: 3500, stock_qty: 10 },
    { sku: "I03", name: "m", price_pence: 3500, stock_qty: 10 },
    { sku: "I04", name: "l", price_pence: 1000, stock_qty: 10 },
  ],
  "cat 10": [
    { sku: "J01", name: "k", price_pence: 2500, stock_qty: 10 },
    { sku: "J02", name: "j", price_pence: 2500, stock_qty: 10 },
    { sku: "J03", name: "i", price_pence: 2500, stock_qty: 10 },
    { sku: "J04", name: "h", price_pence: 2000, stock_qty: 10 },
    { sku: "J05", name: "g", price_pence: 2500, stock_qty: 10 },
  ],
  "cat 11": [
    { sku: "K01", name: "f", price_pence: 4500, stock_qty: 10 },
    { sku: "K02", name: "e", price_pence: 2500, stock_qty: 10 },
    { sku: "K03", name: "d", price_pence: 500, stock_qty: 10 },
    { sku: "K04", name: "c", price_pence: 500, stock_qty: 10 },
    { sku: "K05", name: "b", price_pence: 4500, stock_qty: 10 },
    { sku: "K06", name: "a", price_pence: 2000, stock_qty: 10 },
  ],
};

/* ----------------------------- DATABASE SETUP ---------------------------- */

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

const SUBMIT_LOCKS = new Map();
const SUBMIT_LOCK_MS = 15000;

function isSubmitLocked(userId) {
  const expiresAt = SUBMIT_LOCKS.get(userId);
  return expiresAt && expiresAt > Date.now();
}

function setSubmitLock(userId) {
  SUBMIT_LOCKS.set(userId, Date.now() + SUBMIT_LOCK_MS);
}

function clearSubmitLock(userId) {
  SUBMIT_LOCKS.delete(userId);
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY,
      full_name TEXT,
      email TEXT,
      phone TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shipping_profiles (
      user_id TEXT PRIMARY KEY REFERENCES user_profiles(user_id) ON DELETE CASCADE,
      full_address TEXT,
      country TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS carts (
      cart_id BIGSERIAL PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      discount_code TEXT,
      discount_percent INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id BIGSERIAL PRIMARY KEY,
      cart_id BIGINT NOT NULL REFERENCES carts(cart_id) ON DELETE CASCADE,
      product_id BIGINT,
      sku TEXT NOT NULL,
      name TEXT NOT NULL,
      size TEXT NOT NULL,
      color TEXT NOT NULL,
      qty INT NOT NULL CHECK (qty > 0),
      price_pence INT NOT NULL CHECK (price_pence >= 0)
    );
  `);

  await pool.query(`ALTER TABLE IF EXISTS cart_items ADD COLUMN IF NOT EXISTS product_id BIGINT;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      order_id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      full_name TEXT,
      email TEXT,
      phone TEXT,
      full_address TEXT,
      country TEXT,
      subtotal_pence INT NOT NULL,
      shipping_pence INT NOT NULL,
      total_pence INT NOT NULL,
      discount_code TEXT,
      discount_percent INT NOT NULL DEFAULT 0,
      discount_amount_pence INT NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      receipt_channel_id TEXT,
      payment_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
      product_id BIGINT,
      sku TEXT NOT NULL,
      name TEXT NOT NULL,
      size TEXT NOT NULL,
      color TEXT NOT NULL,
      qty INT NOT NULL CHECK (qty > 0),
      price_pence INT NOT NULL CHECK (price_pence >= 0)
    );
  `);

  await pool.query(`ALTER TABLE IF EXISTS order_items ADD COLUMN IF NOT EXISTS product_id BIGINT;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS discount_codes (
      code TEXT PRIMARY KEY,
      discount_percent INT NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      one_use_per_user BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS discount_code_uses (
      id BIGSERIAL PRIMARY KEY,
      code TEXT NOT NULL,
      user_id TEXT NOT NULL,
      order_id BIGINT,
      used_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (code, user_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shop_categories (
      category_id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      sort_order INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shop_products (
      product_id BIGSERIAL PRIMARY KEY,
      category_id BIGINT NOT NULL REFERENCES shop_categories(category_id) ON DELETE RESTRICT,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      price_pence INT NOT NULL CHECK (price_pence >= 0),
      stock_qty INT NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
      default_size TEXT NOT NULL DEFAULT 'Standard',
      default_color TEXT NOT NULL DEFAULT 'Standard',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(
    `
    INSERT INTO discount_codes (code, discount_percent, is_active, one_use_per_user, created_at, updated_at)
    VALUES ($1, $2, TRUE, TRUE, NOW(), NOW())
    ON CONFLICT (code) DO NOTHING
    `,
    [String(WELCOME_CODE).toUpperCase(), Number(WELCOME_DISCOUNT_PERCENT || 0)]
  );

  await seedCatalogIfNeeded();
}

async function seedCatalogIfNeeded() {
  const existingProducts = await pool.query(`SELECT COUNT(*)::int AS count FROM shop_products`);
  if (Number(existingProducts.rows[0]?.count || 0) > 0) return;

  let sortOrder = 1;

  for (const [categoryName, items] of Object.entries(LEGACY_CATALOG)) {
    const catRes = await pool.query(
      `
      INSERT INTO shop_categories (name, sort_order, is_active, created_at, updated_at)
      VALUES ($1, $2, TRUE, NOW(), NOW())
      RETURNING category_id
      `,
      [categoryName, sortOrder]
    );

    const categoryId = catRes.rows[0].category_id;
    sortOrder += 1;

    for (const item of items) {
      await pool.query(
        `
        INSERT INTO shop_products (
          category_id, sku, name, price_pence, stock_qty,
          default_size, default_color, is_active, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW(), NOW())
        `,
        [
          categoryId,
          item.sku,
          item.name,
          item.price_pence,
          item.stock_qty,
          item.default_size || DEFAULT_SIZE,
          item.default_color || DEFAULT_COLOR,
        ]
      );
    }
  }
}

/* ------------------------------ HELPERS ------------------------------ */

function money(pence) {
  return `£${(Number(pence || 0) / 100).toFixed(2)}`;
}

function isStaff(member) {
  return member?.roles?.cache?.has(STAFF_ROLE_ID);
}

function isStaffChannel(interaction) {
  return interaction.channelId === STAFF_ONLY_CHANNEL_ID;
}

function safeChannelName(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
}

function calculateDiscountedTotals(subtotal, shipping, discountPercent) {
  const safePercent = Math.max(0, Math.min(100, Number(discountPercent || 0)));
  const discountAmount = Math.round(Number(subtotal || 0) * (safePercent / 100));
  const total = Number(subtotal || 0) - discountAmount + Number(shipping || 0);

  return {
    discountPercent: safePercent,
    discountAmount,
    total,
  };
}

function normalizeDiscountCode(code) {
  return String(code || "").trim().toUpperCase();
}

function normalizeSku(code) {
  return String(code || "").trim().toUpperCase();
}

function chunkOptions(options, size = 25) {
  const chunks = [];
  for (let i = 0; i < options.length; i += size) {
    chunks.push(options.slice(i, i + size));
  }
  return chunks;
}

async function createDiscountCodeRecord(code, discountPercent) {
  const normalized = normalizeDiscountCode(code);
  const percent = Math.max(0, Math.min(100, Number(discountPercent || 0)));

  await pool.query(
    `
    INSERT INTO discount_codes (code, discount_percent, is_active, one_use_per_user, created_at, updated_at)
    VALUES ($1, $2, TRUE, TRUE, NOW(), NOW())
    ON CONFLICT (code) DO UPDATE
    SET discount_percent = EXCLUDED.discount_percent,
        is_active = TRUE,
        updated_at = NOW()
    `,
    [normalized, percent]
  );
}

async function getDiscountCodeRecord(code) {
  const normalized = normalizeDiscountCode(code);
  if (!normalized) return null;

  const res = await pool.query(
    `
    SELECT code, discount_percent, is_active, one_use_per_user
    FROM discount_codes
    WHERE code = $1
    `,
    [normalized]
  );

  return res.rows[0] || null;
}

async function setDiscountCodeActiveState(code, isActive) {
  const normalized = normalizeDiscountCode(code);

  const res = await pool.query(
    `
    UPDATE discount_codes
    SET is_active = $2,
        updated_at = NOW()
    WHERE code = $1
    RETURNING code, discount_percent, is_active, one_use_per_user
    `,
    [normalized, !!isActive]
  );

  return res.rows[0] || null;
}

async function hasUserUsedDiscountCode(userId, code) {
  const normalized = normalizeDiscountCode(code);

  const res = await pool.query(
    `
    SELECT 1
    FROM discount_code_uses
    WHERE user_id = $1 AND code = $2
    LIMIT 1
    `,
    [userId, normalized]
  );

  return res.rows.length > 0;
}

async function validateDiscountCodeForUser(userId, code) {
  const normalized = normalizeDiscountCode(code);

  if (!normalized) {
    return { valid: false, reason: "Please enter a code." };
  }

  const record = await getDiscountCodeRecord(normalized);
  if (!record) {
    return { valid: false, reason: "That discount code is invalid." };
  }

  if (!record.is_active) {
    return { valid: false, reason: "That discount code is currently inactive." };
  }

  const isWelcome = normalized === normalizeDiscountCode(WELCOME_CODE);

  if (isWelcome) {
    const hasOrderedBefore = await hasUserPlacedOrderBefore(userId);
    if (hasOrderedBefore) {
      return { valid: false, reason: "This code is only valid on your first order." };
    }
  }

  if (record.one_use_per_user) {
    const alreadyUsed = await hasUserUsedDiscountCode(userId, normalized);
    if (alreadyUsed) {
      return { valid: false, reason: "You have already used that discount code." };
    }
  }

  return {
    valid: true,
    code: normalized,
    discount_percent: Number(record.discount_percent || 0),
    is_active: !!record.is_active,
    one_use_per_user: !!record.one_use_per_user,
  };
}

async function getActiveCategories() {
  const res = await pool.query(
    `
    SELECT category_id, name, sort_order
    FROM shop_categories
    WHERE is_active = TRUE
    ORDER BY sort_order ASC, name ASC
    `
  );

  return res.rows;
}

async function getAllCategoriesForStaff() {
  const res = await pool.query(
    `
    SELECT category_id, name, sort_order, is_active
    FROM shop_categories
    ORDER BY is_active DESC, sort_order ASC, name ASC
    `
  );

  return res.rows;
}

async function getCategoryById(categoryId) {
  const res = await pool.query(
    `
    SELECT category_id, name, sort_order, is_active
    FROM shop_categories
    WHERE category_id = $1
    `,
    [categoryId]
  );

  return res.rows[0] || null;
}

async function createCategory(name) {
  const safeName = String(name || "").trim();
  if (!safeName) throw new Error("Category name is required.");

  const maxRes = await pool.query(`SELECT COALESCE(MAX(sort_order), 0)::int AS max_sort FROM shop_categories`);
  const nextSort = Number(maxRes.rows[0]?.max_sort || 0) + 1;

  const res = await pool.query(
    `
    INSERT INTO shop_categories (name, sort_order, is_active, created_at, updated_at)
    VALUES ($1, $2, TRUE, NOW(), NOW())
    RETURNING category_id, name
    `,
    [safeName, nextSort]
  );

  return res.rows[0];
}

async function renameCategory(categoryId, newName) {
  const safeName = String(newName || "").trim();
  if (!safeName) throw new Error("New category name is required.");

  const res = await pool.query(
    `
    UPDATE shop_categories
    SET name = $2,
        updated_at = NOW()
    WHERE category_id = $1
    RETURNING category_id, name
    `,
    [categoryId, safeName]
  );

  return res.rows[0] || null;
}

async function archiveCategory(categoryId) {
  const activeProductsRes = await pool.query(
    `
    SELECT COUNT(*)::int AS count
    FROM shop_products
    WHERE category_id = $1 AND is_active = TRUE
    `,
    [categoryId]
  );

  const activeCount = Number(activeProductsRes.rows[0]?.count || 0);
  if (activeCount > 0) {
    throw new Error("Cannot archive a category while it still has active products. Archive the products first.");
  }

  const res = await pool.query(
    `
    UPDATE shop_categories
    SET is_active = FALSE,
        updated_at = NOW()
    WHERE category_id = $1
    RETURNING category_id, name
    `,
    [categoryId]
  );

  return res.rows[0] || null;
}

async function getActiveProductsByCategoryId(categoryId) {
  const res = await pool.query(
    `
    SELECT
      p.product_id,
      p.category_id,
      p.sku,
      p.name,
      p.price_pence,
      p.stock_qty,
      p.default_size,
      p.default_color,
      p.is_active,
      c.name AS category_name
    FROM shop_products p
    JOIN shop_categories c ON c.category_id = p.category_id
    WHERE p.category_id = $1
      AND p.is_active = TRUE
      AND c.is_active = TRUE
    ORDER BY p.name ASC, p.sku ASC
    `,
    [categoryId]
  );

  return res.rows;
}

async function getAllActiveProductsForStaff() {
  const res = await pool.query(
    `
    SELECT
      p.product_id,
      p.category_id,
      p.sku,
      p.name,
      p.price_pence,
      p.stock_qty,
      p.default_size,
      p.default_color,
      p.is_active,
      c.name AS category_name
    FROM shop_products p
    JOIN shop_categories c ON c.category_id = p.category_id
    WHERE p.is_active = TRUE
      AND c.is_active = TRUE
    ORDER BY c.sort_order ASC, c.name ASC, p.name ASC, p.sku ASC
    `
  );

  return res.rows;
}

async function getProductById(productId) {
  const res = await pool.query(
    `
    SELECT
      p.product_id,
      p.category_id,
      p.sku,
      p.name,
      p.price_pence,
      p.stock_qty,
      p.default_size,
      p.default_color,
      p.is_active,
      c.name AS category_name
    FROM shop_products p
    JOIN shop_categories c ON c.category_id = p.category_id
    WHERE p.product_id = $1
    `,
    [productId]
  );

  return res.rows[0] || null;
}

async function getProductBySku(sku) {
  const safeSku = normalizeSku(sku);

  const res = await pool.query(
    `
    SELECT
      p.product_id,
      p.category_id,
      p.sku,
      p.name,
      p.price_pence,
      p.stock_qty,
      p.default_size,
      p.default_color,
      p.is_active,
      c.name AS category_name
    FROM shop_products p
    JOIN shop_categories c ON c.category_id = p.category_id
    WHERE p.sku = $1
    `,
    [safeSku]
  );

  return res.rows[0] || null;
}

async function createProduct({
  categoryId,
  sku,
  name,
  pricePence,
  stockQty,
  defaultSize,
  defaultColor,
}) {
  const safeSku = normalizeSku(sku);
  const safeName = String(name || "").trim();
  const safePrice = Number(pricePence || 0);
  const safeStock = Number(stockQty || 0);

  if (!categoryId) throw new Error("Category is required.");
  if (!safeSku) throw new Error("SKU is required.");
  if (!safeName) throw new Error("Product name is required.");
  if (!Number.isFinite(safePrice) || safePrice < 0) throw new Error("Price must be 0 or more.");
  if (!Number.isFinite(safeStock) || safeStock < 0) throw new Error("Stock must be 0 or more.");

  const res = await pool.query(
    `
    INSERT INTO shop_products (
      category_id, sku, name, price_pence, stock_qty,
      default_size, default_color, is_active, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW(), NOW())
    RETURNING product_id, sku, name
    `,
    [
      categoryId,
      safeSku,
      safeName,
      safePrice,
      safeStock,
      String(defaultSize || DEFAULT_SIZE).trim() || DEFAULT_SIZE,
      String(defaultColor || DEFAULT_COLOR).trim() || DEFAULT_COLOR,
    ]
  );

  return res.rows[0];
}

async function updateProductName(productId, newName) {
  const safeName = String(newName || "").trim();
  if (!safeName) throw new Error("New product name is required.");

  const res = await pool.query(
    `
    UPDATE shop_products
    SET name = $2,
        updated_at = NOW()
    WHERE product_id = $1
    RETURNING product_id, sku, name
    `,
    [productId, safeName]
  );

  return res.rows[0] || null;
}

async function updateProductPrice(productId, newPricePence) {
  const safePrice = Number(newPricePence);
  if (!Number.isFinite(safePrice) || safePrice < 0) {
    throw new Error("Price must be 0 or more.");
  }

  const res = await pool.query(
    `
    UPDATE shop_products
    SET price_pence = $2,
        updated_at = NOW()
    WHERE product_id = $1
    RETURNING product_id, sku, name, price_pence
    `,
    [productId, safePrice]
  );

  return res.rows[0] || null;
}

async function updateProductStock(productId, newStockQty) {
  const safeStock = Number(newStockQty);
  if (!Number.isFinite(safeStock) || safeStock < 0) {
    throw new Error("Stock must be 0 or more.");
  }

  const res = await pool.query(
    `
    UPDATE shop_products
    SET stock_qty = $2,
        updated_at = NOW()
    WHERE product_id = $1
    RETURNING product_id, sku, name, stock_qty
    `,
    [productId, safeStock]
  );

  return res.rows[0] || null;
}

async function archiveProduct(productId) {
  const res = await pool.query(
    `
    UPDATE shop_products
    SET is_active = FALSE,
        updated_at = NOW()
    WHERE product_id = $1
    RETURNING product_id, sku, name
    `,
    [productId]
  );

  return res.rows[0] || null;
}

async function getCartQtyForProduct(userId, productId) {
  const res = await pool.query(
    `
    SELECT COALESCE(SUM(ci.qty), 0) AS qty
    FROM carts c
    JOIN cart_items ci ON ci.cart_id = c.cart_id
    WHERE c.user_id = $1
      AND c.status = 'open'
      AND ci.product_id = $2
    `,
    [userId, productId]
  );

  return Number(res.rows[0]?.qty || 0);
}

async function upsertProfile(userId, fullName, email, phone, shipping) {
  await pool.query(
    `
    INSERT INTO user_profiles (user_id, full_name, email, phone, updated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        updated_at = NOW()
    `,
    [userId, fullName, email, phone]
  );

  await pool.query(
    `
    INSERT INTO shipping_profiles (user_id, full_address, country, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET full_address = EXCLUDED.full_address,
        country = EXCLUDED.country,
        updated_at = NOW()
    `,
    [userId, shipping.full_address, shipping.country]
  );
}

async function getOrCreateCart(userId) {
  const existing = await pool.query(
    `SELECT cart_id FROM carts WHERE user_id = $1 AND status = 'open'`,
    [userId]
  );

  if (existing.rows.length) return existing.rows[0].cart_id;

  const created = await pool.query(
    `
    INSERT INTO carts (user_id, status, discount_code, discount_percent, updated_at)
    VALUES ($1, 'open', NULL, 0, NOW())
    RETURNING cart_id
    `,
    [userId]
  );

  return created.rows[0].cart_id;
}

async function addCartItem(userId, product, qty) {
  const existingCartQty = await getCartQtyForProduct(userId, product.product_id);

  if (existingCartQty + qty > Number(product.stock_qty || 0)) {
    throw new Error(`Only ${product.stock_qty} in stock for ${product.name}.`);
  }

  const cartId = await getOrCreateCart(userId);

  await pool.query(
    `
    INSERT INTO cart_items (cart_id, product_id, sku, name, size, color, qty, price_pence)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [
      cartId,
      product.product_id,
      product.sku,
      product.name,
      product.default_size || DEFAULT_SIZE,
      product.default_color || DEFAULT_COLOR,
      qty,
      product.price_pence,
    ]
  );
}

async function clearCart(userId) {
  const cart = await pool.query(
    `SELECT cart_id FROM carts WHERE user_id = $1 AND status = 'open'`,
    [userId]
  );

  if (!cart.rows.length) return;

  const cartId = cart.rows[0].cart_id;
  await pool.query(`DELETE FROM cart_items WHERE cart_id = $1`, [cartId]);
  await pool.query(`DELETE FROM carts WHERE cart_id = $1`, [cartId]);
}

async function getCartSummary(userId) {
  const cart = await pool.query(
    `SELECT cart_id FROM carts WHERE user_id = $1 AND status = 'open'`,
    [userId]
  );

  if (!cart.rows.length) {
    return { items: [], subtotal_pence: 0 };
  }

  const cartId = cart.rows[0].cart_id;

  const itemsRes = await pool.query(
    `
    SELECT product_id, sku, name, size, color, qty, price_pence
    FROM cart_items
    WHERE cart_id = $1
    ORDER BY id ASC
    `,
    [cartId]
  );

  const items = itemsRes.rows;
  const subtotal_pence = items.reduce(
    (sum, it) => sum + Number(it.qty) * Number(it.price_pence),
    0
  );

  return { items, subtotal_pence };
}

async function getCartDiscount(userId) {
  const res = await pool.query(
    `
    SELECT discount_code, discount_percent
    FROM carts
    WHERE user_id = $1 AND status = 'open'
    `,
    [userId]
  );

  if (!res.rows.length) {
    return { discount_code: null, discount_percent: 0 };
  }

  return {
    discount_code: res.rows[0].discount_code || null,
    discount_percent: Number(res.rows[0].discount_percent || 0),
  };
}

async function setCartDiscount(userId, code, percent) {
  const cartId = await getOrCreateCart(userId);

  await pool.query(
    `
    UPDATE carts
    SET discount_code = $1,
        discount_percent = $2,
        updated_at = NOW()
    WHERE cart_id = $3
    `,
    [normalizeDiscountCode(code), Number(percent || 0), cartId]
  );
}

async function clearCartDiscount(userId) {
  await pool.query(
    `
    UPDATE carts
    SET discount_code = NULL,
        discount_percent = 0,
        updated_at = NOW()
    WHERE user_id = $1 AND status = 'open'
    `,
    [userId]
  );
}

async function hasUserPlacedOrderBefore(userId) {
  const res = await pool.query(`SELECT 1 FROM orders WHERE user_id = $1 LIMIT 1`, [userId]);
  return res.rows.length > 0;
}

async function hasUserPendingOrder(userId) {
  return false;
}

async function getUserShippingProfile(userId) {
  const res = await pool.query(
    `
    SELECT up.full_name, up.email, up.phone, sp.full_address, sp.country
    FROM user_profiles up
    JOIN shipping_profiles sp ON sp.user_id = up.user_id
    WHERE up.user_id = $1
    `,
    [userId]
  );

  return res.rows[0] || null;
}

async function buildCartMessage(userId, heading = "✅ **Added to basket.**") {
  const cart = await getCartSummary(userId);
  const profile = await getUserShippingProfile(userId);
  const shippingPence = getShippingPenceForCountry(profile?.country);
  const discount = await getCartDiscount(userId);
  const totals = calculateDiscountedTotals(cart.subtotal_pence, shippingPence, discount.discount_percent);

  const basketLines = [];
  for (const it of cart.items) {
    const product = it.product_id ? await getProductById(it.product_id) : null;
    const stockQty = Number(product?.stock_qty || 0);

    basketLines.push(
      `• **${it.name}** (${it.size}, ${it.color}) × ${it.qty} — ${money(
        Number(it.qty) * Number(it.price_pence)
      )} _[Stock: ${stockQty}]_`
    );
  }

  let content =
    `${heading}\n\n` +
    `**Your basket**\n` +
    `${basketLines.join("\n") || "_No items_"}\n\n` +
    `**Subtotal:** ${money(cart.subtotal_pence)}\n`;

  if (totals.discountAmount > 0) {
    content += `**Discount (${discount.discount_code}):** -${money(totals.discountAmount)}\n`;
  }

  content +=
    `**Shipping:** ${money(shippingPence)}\n` +
    `**Total:** ${money(totals.total)}`;

  return content;
}

/* ----------------------------- SHIPPING LOGIC ---------------------------- */

const SHIPPING_UK_PENCE = 1000;
const SHIPPING_EU_PENCE = 3500;
const SHIPPING_USA_PENCE = 4500;

function getShippingPenceForCountry(countryRaw) {
  const c = String(countryRaw || "").trim().toLowerCase();

  if (!c) return SHIPPING_EU_PENCE;

  const isUK =
    c.includes("uk") ||
    c.includes("united kingdom") ||
    c.includes("great britain") ||
    c === "gb" ||
    c.includes("england") ||
    c.includes("scotland") ||
    c.includes("wales") ||
    c.includes("northern ireland");

  if (isUK) return SHIPPING_UK_PENCE;

  const isUSA =
    c.includes("usa") ||
    c === "us" ||
    c.includes("united states") ||
    c.includes("america");

  if (isUSA) return SHIPPING_USA_PENCE;

  return SHIPPING_EU_PENCE;
}

/* -------------------------- SLASH COMMAND SETUP -------------------------- */

const commands = [
  new SlashCommandBuilder()
    .setName("setupshop")
    .setDescription("Post or refresh the shop menu message in the menu channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("setupverify")
    .setDescription("Post or refresh the verification panel in the verify channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("setupstaffpanel")
    .setDescription("Post or refresh the staff control panel in the staff-only channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Health check"),
].map((c) => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commands,
  });
}

/* ------------------------------ UI BUILDERS ------------------------------ */

function menuMessageComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("open_menu")
        .setLabel("Click to see our menu")
        .setStyle(ButtonStyle.Primary)
    ),
  ];
}

async function categorySelectComponents() {
  const categories = await getActiveCategories();
  if (!categories.length) return [];

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("select_category")
        .setPlaceholder("Choose a category…")
        .addOptions(
          categories.slice(0, 25).map((cat) => ({
            label: String(cat.name).slice(0, 100),
            value: String(cat.category_id),
          }))
        )
    ),
  ];
}

async function itemSelectComponents(categoryId) {
  const items = await getActiveProductsByCategoryId(categoryId);
  if (!items.length) return [];

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`select_item:${categoryId}`)
        .setPlaceholder("Choose an item…")
        .addOptions(
          items.slice(0, 25).map((it) => ({
            label: `${it.name} — ${money(it.price_pence)} — Stock ${it.stock_qty}`.slice(0, 100),
            value: String(it.product_id),
            description: it.stock_qty > 0
              ? `SKU ${it.sku}`.slice(0, 100)
              : `Out of stock • SKU ${it.sku}`.slice(0, 100),
          }))
        )
    ),
  ];
}

async function qtyButtonsComponents(productId) {
  const product = await getProductById(productId);
  const stockQty = Number(product?.stock_qty || 0);
  const maxQuickQty = Math.min(stockQty, 5);
  const quickButtons = [];

  for (let n = 1; n <= maxQuickQty; n += 1) {
    quickButtons.push(
      new ButtonBuilder()
        .setCustomId(`add_qty:${productId}:${n}`)
        .setLabel(String(n))
        .setStyle(ButtonStyle.Secondary)
    );
  }

  const rows = [];

  if (quickButtons.length) {
    rows.push(new ActionRowBuilder().addComponents(...quickButtons));
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`add_qty_other:${productId}`)
        .setLabel("Other…")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(stockQty <= 0)
    )
  );

  return rows;
}

function cartActionsComponents(disableSubmit = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("cart_add_more")
        .setLabel("Add Another Item")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("cart_discount")
        .setLabel("Apply Discount Code")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("cart_submit")
        .setLabel("Submit Order ✅")
        .setStyle(ButtonStyle.Success)
        .setDisabled(disableSubmit),
      new ButtonBuilder()
        .setCustomId("cart_clear")
        .setLabel("Clear Cart")
        .setStyle(ButtonStyle.Danger)
    ),
  ];
}

function verifyPanelComponents() {
  const embed = new EmbedBuilder()
    .setTitle("Server Verification")
    .setDescription(
      [
        "To access the full server, click the button below and complete the form.",
        "",
        "All fields are required:",
        "• Full name",
        "• How you heard about us",
        "• Referral / who sent you",
        "• Email address",
        "• Phone number",
        "",
        "Failure to complete the form correctly may affect whether you are verified.",
      ].join("\n")
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("verify_open_modal")
      .setLabel("Verify")
      .setStyle(ButtonStyle.Success)
  );

  return { embed, row };
}

function verifyApproveComponents(userId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`verify_approve:${userId}`)
        .setLabel("Approve ✅")
        .setStyle(ButtonStyle.Success)
    ),
  ];
}

function staffPanelComponents() {
  const embed = new EmbedBuilder()
    .setTitle("Staff Control Panel")
    .setDescription(
      [
        "Use the buttons below to manage the shop.",
        "",
        "Available actions:",
        "• Manage categories",
        "• Manage products",
        "• Adjust stock",
        "• Lookup order",
        "• Create discount code",
        "• Toggle discount code active/inactive",
      ].join("\n")
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("staff_manage_categories")
      .setLabel("Manage Categories")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("staff_manage_products")
      .setLabel("Manage Products")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("staff_open_stock_flow")
      .setLabel("Adjust Stock")
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("staff_open_orderlookup_modal")
      .setLabel("Lookup Order")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("staff_open_create_discount_modal")
      .setLabel("Create Discount Code")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("staff_open_toggle_discount_modal")
      .setLabel("Toggle Discount Code")
      .setStyle(ButtonStyle.Secondary)
  );

  return { embed, rows: [row1, row2] };
}

function staffCategoryActionButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("staff_open_add_category_modal")
        .setLabel("Add Category")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("staff_start_rename_category")
        .setLabel("Rename Category")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("staff_start_archive_category")
        .setLabel("Archive Category")
        .setStyle(ButtonStyle.Danger)
    ),
  ];
}

function staffProductActionButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("staff_open_add_product_pick_category")
        .setLabel("Add Product")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("staff_start_rename_product")
        .setLabel("Rename Product")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("staff_start_change_price")
        .setLabel("Change Price")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("staff_start_archive_product")
        .setLabel("Archive Product")
        .setStyle(ButtonStyle.Danger)
    ),
  ];
}

async function staffCategorySelectMenus(customId, placeholder = "Choose a category…", includeInactive = false) {
  const categories = includeInactive ? await getAllCategoriesForStaff() : await getActiveCategories();
  if (!categories.length) return [];

  const options = categories.map((cat) => ({
    label: `${cat.name}${cat.is_active === false ? " [inactive]" : ""}`.slice(0, 100),
    value: String(cat.category_id),
  }));

  return chunkOptions(options).map((chunk, idx) =>
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(idx === 0 ? customId : `${customId}:${idx}`)
        .setPlaceholder(placeholder)
        .addOptions(chunk)
    )
  );
}

async function staffProductSelectMenus(customId, placeholder = "Choose a product…") {
  const products = await getAllActiveProductsForStaff();
  if (!products.length) return [];

  const options = products.map((p) => ({
    label: `${p.name} (${p.sku})`.slice(0, 100),
    value: String(p.product_id),
    description: `${p.category_name} • ${money(p.price_pence)} • Stock ${p.stock_qty}`.slice(0, 100),
  }));

  return chunkOptions(options).map((chunk, idx) =>
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(idx === 0 ? customId : `${customId}:${idx}`)
        .setPlaceholder(placeholder)
        .addOptions(chunk)
    )
  );
}

/* -------------------------- MODALS (MAX 5 INPUTS) ------------------------- */

function shippingModal() {
  const modal = new ModalBuilder()
    .setCustomId("shipping_modal")
    .setTitle("Shipping details");

  const fullName = new TextInputBuilder()
    .setCustomId("full_name")
    .setLabel("Full name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const email = new TextInputBuilder()
    .setCustomId("email")
    .setLabel("Email")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const phone = new TextInputBuilder()
    .setCustomId("phone")
    .setLabel("Phone number")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const fullAddress = new TextInputBuilder()
    .setCustomId("full_address")
    .setLabel("Provide Full Address")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  const country = new TextInputBuilder()
    .setCustomId("country")
    .setLabel("Country")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(fullName),
    new ActionRowBuilder().addComponents(email),
    new ActionRowBuilder().addComponents(phone),
    new ActionRowBuilder().addComponents(fullAddress),
    new ActionRowBuilder().addComponents(country)
  );

  return modal;
}

function qtyOtherModal(productId) {
  const modal = new ModalBuilder()
    .setCustomId(`qty_other_modal:${productId}`)
    .setTitle("Quantity");

  const qty = new TextInputBuilder()
    .setCustomId("qty")
    .setLabel("Enter quantity (number)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(qty));
  return modal;
}

function discountCodeModal() {
  const modal = new ModalBuilder()
    .setCustomId("discount_code_modal")
    .setTitle("Apply discount code");

  const code = new TextInputBuilder()
    .setCustomId("discount_code")
    .setLabel("Enter discount code")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(code));
  return modal;
}

function verifyModal() {
  const modal = new ModalBuilder()
    .setCustomId("verify_submit_modal")
    .setTitle("Verification Form");

  const nameInput = new TextInputBuilder()
    .setCustomId("verify_name")
    .setLabel("Full name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("Enter your full name");

  const foundInput = new TextInputBuilder()
    .setCustomId("verify_found")
    .setLabel("How did you hear about us?")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setPlaceholder("Be specific");

  const referralInput = new TextInputBuilder()
    .setCustomId("verify_referral")
    .setLabel("Referral / who sent you")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("Enter a name or type none");

  const emailInput = new TextInputBuilder()
    .setCustomId("verify_email")
    .setLabel("Email address")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("name@example.com");

  const phoneInput = new TextInputBuilder()
    .setCustomId("verify_phone")
    .setLabel("Phone number")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("Enter your phone number");

  modal.addComponents(
    new ActionRowBuilder().addComponents(nameInput),
    new ActionRowBuilder().addComponents(foundInput),
    new ActionRowBuilder().addComponents(referralInput),
    new ActionRowBuilder().addComponents(emailInput),
    new ActionRowBuilder().addComponents(phoneInput)
  );

  return modal;
}

function staffOrderLookupModal() {
  const modal = new ModalBuilder()
    .setCustomId("staff_orderlookup_modal")
    .setTitle("Lookup Order");

  const orderIdInput = new TextInputBuilder()
    .setCustomId("lookup_order_id")
    .setLabel("Order ID")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("Example: 12");

  modal.addComponents(new ActionRowBuilder().addComponents(orderIdInput));
  return modal;
}

function staffCreateDiscountModal() {
  const modal = new ModalBuilder()
    .setCustomId("staff_create_discount_modal")
    .setTitle("Create Discount Code");

  const codeInput = new TextInputBuilder()
    .setCustomId("discount_code")
    .setLabel("Discount code")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("Example: SPRING15");

  const percentInput = new TextInputBuilder()
    .setCustomId("discount_percent")
    .setLabel("Discount percent")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("Example: 15");

  modal.addComponents(
    new ActionRowBuilder().addComponents(codeInput),
    new ActionRowBuilder().addComponents(percentInput)
  );

  return modal;
}

function staffToggleDiscountModal() {
  const modal = new ModalBuilder()
    .setCustomId("staff_toggle_discount_modal")
    .setTitle("Toggle Discount Code");

  const codeInput = new TextInputBuilder()
    .setCustomId("discount_code")
    .setLabel("Discount code")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("Example: SPRING15");

  const activeInput = new TextInputBuilder()
    .setCustomId("discount_active")
    .setLabel("Type active or inactive")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("active");

  modal.addComponents(
    new ActionRowBuilder().addComponents(codeInput),
    new ActionRowBuilder().addComponents(activeInput)
  );

  return modal;
}

function addCategoryModal() {
  const modal = new ModalBuilder()
    .setCustomId("staff_add_category_modal")
    .setTitle("Add Category");

  const nameInput = new TextInputBuilder()
    .setCustomId("category_name")
    .setLabel("Category name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("Example: Accessories");

  modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
  return modal;
}

function renameCategoryModal(categoryId, currentName) {
  const modal = new ModalBuilder()
    .setCustomId(`staff_rename_category_modal:${categoryId}`)
    .setTitle("Rename Category");

  const nameInput = new TextInputBuilder()
    .setCustomId("category_name")
    .setLabel("New category name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(String(currentName || "").slice(0, 100));

  modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
  return modal;
}

function addProductModal(categoryId, categoryName) {
  const modal = new ModalBuilder()
    .setCustomId(`staff_add_product_modal:${categoryId}`)
    .setTitle("Add Product");

  const skuInput = new TextInputBuilder()
    .setCustomId("sku")
    .setLabel("SKU")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("Example: NEW01");

  const nameInput = new TextInputBuilder()
    .setCustomId("name")
    .setLabel(`Product name for ${String(categoryName || "").slice(0, 30)}`)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("Example: New Product");

  const priceInput = new TextInputBuilder()
    .setCustomId("price_pence")
    .setLabel("Price in pence")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("Example: 2500");

  const stockInput = new TextInputBuilder()
    .setCustomId("stock_qty")
    .setLabel("Stock quantity")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("Example: 10");

  const sizeInput = new TextInputBuilder()
    .setCustomId("default_size")
    .setLabel("Default size")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(DEFAULT_SIZE);

  modal.addComponents(
    new ActionRowBuilder().addComponents(skuInput),
    new ActionRowBuilder().addComponents(nameInput),
    new ActionRowBuilder().addComponents(priceInput),
    new ActionRowBuilder().addComponents(stockInput),
    new ActionRowBuilder().addComponents(sizeInput)
  );

  return modal;
}

function renameProductModal(productId, currentName) {
  const modal = new ModalBuilder()
    .setCustomId(`staff_rename_product_modal:${productId}`)
    .setTitle("Rename Product");

  const nameInput = new TextInputBuilder()
    .setCustomId("product_name")
    .setLabel("New product name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(String(currentName || "").slice(0, 100));

  modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
  return modal;
}

function changePriceModal(productId, currentPricePence) {
  const modal = new ModalBuilder()
    .setCustomId(`staff_change_price_modal:${productId}`)
    .setTitle("Change Product Price");

  const priceInput = new TextInputBuilder()
    .setCustomId("price_pence")
    .setLabel("New price in pence")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(String(currentPricePence || 0));

  modal.addComponents(new ActionRowBuilder().addComponents(priceInput));
  return modal;
}

function changeStockModal(productId, currentStockQty, name) {
  const modal = new ModalBuilder()
    .setCustomId(`staff_change_stock_modal:${productId}`)
    .setTitle("Adjust Stock");

  const stockInput = new TextInputBuilder()
    .setCustomId("stock_qty")
    .setLabel(`New stock for ${String(name || "").slice(0, 40)}`)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(String(currentStockQty || 0));

  modal.addComponents(new ActionRowBuilder().addComponents(stockInput));
  return modal;
}

/* ---------------------------- RECEIPT CHANNEL ---------------------------- */

async function createReceiptChannel(guild, user, orderId) {
  const category = await guild.channels.fetch(ORDERS_CATEGORY_ID).catch(() => null);

  const channel = await guild.channels.create({
    name: safeChannelName(`order-${user.username}-${orderId}`),
    type: ChannelType.GuildText,
    parent: category?.id || null,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: ["ViewChannel"] },
      { id: user.id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] },
      { id: STAFF_ROLE_ID, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] },
      {
        id: guild.members.me.id,
        allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "ManageChannels"],
      },
    ],
  });

  return channel;
}

function bankDetailsText(orderId) {
  const ref = `ORDER-${orderId}`;
  const extras = [
    BANK_IBAN ? `IBAN: ${BANK_IBAN}` : null,
    BANK_SWIFT ? `SWIFT/BIC: ${BANK_SWIFT}` : null,
  ].filter(Boolean);

  return (
    `**Bank:** ${BANK_BANK_NAME}\n` +
    `**Account Name:** ${BANK_ACCOUNT_NAME}\n` +
    `**Sort Code:** ${BANK_SORT_CODE}\n` +
    `**Account Number:** ${BANK_ACCOUNT_NUMBER}\n` +
    (extras.length ? `${extras.join("\n")}\n` : "") +
    `\n**Reference:** \`${ref}\``
  );
}

function receiptEmbed(
  orderId,
  items,
  subtotal,
  discountAmount,
  discountCode,
  shipping,
  total,
  shippingProfile,
  status = "pending"
) {
  const lines = items.map(
    (it) => `• **${it.name}** (${it.size}, ${it.color}) × ${it.qty} — ${money(Number(it.qty) * Number(it.price_pence))}`
  );

  const fields = [
    { name: "Status", value: status, inline: true },
    { name: "Subtotal", value: money(subtotal), inline: true },
  ];

  if (discountAmount > 0) {
    fields.push({
      name: "Discount",
      value: `${discountCode || "Code"} (-${money(discountAmount)})`,
      inline: true,
    });
  }

  fields.push(
    { name: "Shipping", value: money(shipping), inline: true },
    { name: "Total", value: money(total), inline: true },
    {
      name: "Shipping to",
      value:
        `${shippingProfile.full_name}\n` +
        `${shippingProfile.email}\n` +
        `${shippingProfile.phone}\n` +
        `${shippingProfile.full_address}\n` +
        `${shippingProfile.country}`,
    },
    {
      name: "Payment — Bank Transfer",
      value:
        `Please pay the **Total** via bank transfer using the details below.\n` +
        `Once paid, a staff member will confirm and mark the order as paid.\n\n` +
        bankDetailsText(orderId),
    },
    {
      name: "Dispatch",
      value: "Cut-off: **15:30 (Mon–Fri Dispatch)**",
    }
  );

  return new EmbedBuilder()
    .setTitle(`${STORE_NAME} — Receipt (Order #${orderId})`)
    .setDescription(lines.join("\n") || "_No items_")
    .addFields(fields)
    .setFooter({ text: "Thank you for your order." });
}

function staffReceiptControls(orderId, status = "pending") {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`staff_mark_paid:${orderId}`)
        .setLabel("Mark as paid ✅")
        .setStyle(ButtonStyle.Success)
        .setDisabled(
          status === "paid" ||
          status === "dispatched" ||
          status === "cancelled" ||
          status === "completed"
        ),

      new ButtonBuilder()
        .setCustomId(`staff_mark_dispatched:${orderId}`)
        .setLabel("Mark as dispatched 📦")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(
          status === "dispatched" ||
          status === "cancelled" ||
          status === "completed"
        ),

      new ButtonBuilder()
        .setCustomId(`staff_cancel_order:${orderId}`)
        .setLabel("Cancel Order ❌")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(
          status === "dispatched" ||
          status === "cancelled" ||
          status === "completed"
        ),

      new ButtonBuilder()
        .setCustomId(`staff_complete_order:${orderId}`)
        .setLabel("Complete & Close ✅")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(
          status === "cancelled" ||
          status === "completed" ||
          status !== "dispatched"
        )
    ),
  ];
}

/* ------------------------------- CLIENT ------------------------------- */

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.Channel],
});

const CART_UI_MESSAGES = new Map();
const SHOP_SESSION_CHANNELS = new Map();

/* ------------------------ SHOP SESSION HELPERS ------------------------ */

async function getTrackedCartUiMessage(userId, channel) {
  const tracked = CART_UI_MESSAGES.get(userId);
  if (!tracked) return null;
  if (tracked.channelId !== channel.id) return null;

  const msg = await channel.messages.fetch(tracked.messageId).catch(() => null);
  if (!msg) {
    CART_UI_MESSAGES.delete(userId);
    return null;
  }

  return msg;
}

function trackCartUiMessage(userId, channelId, messageId) {
  CART_UI_MESSAGES.set(userId, { channelId, messageId });
}

function clearTrackedCartUiMessage(userId) {
  CART_UI_MESSAGES.delete(userId);
}

async function getTrackedShopSessionChannel(guild, userId) {
  const trackedChannelId = SHOP_SESSION_CHANNELS.get(userId);
  if (!trackedChannelId) return null;

  const channel = await guild.channels.fetch(trackedChannelId).catch(() => null);
  if (!channel) {
    SHOP_SESSION_CHANNELS.delete(userId);
    return null;
  }

  return channel;
}

function trackShopSessionChannel(userId, channelId) {
  SHOP_SESSION_CHANNELS.set(userId, channelId);
}

async function closeShopSession(interaction, options = {}) {
  const {
    message = "This private shopping channel will now close.",
    delayMs = 3000,
  } = options;

  const trackedCartMessage = await getTrackedCartUiMessage(interaction.user.id, interaction.channel);
  const trackedShopChannel = await getTrackedShopSessionChannel(interaction.guild, interaction.user.id);

  clearTrackedCartUiMessage(interaction.user.id);
  clearTrackedShopSessionChannel(interaction.user.id);

  try {
    if (trackedCartMessage && trackedCartMessage.id !== interaction.message?.id) {
      await trackedCartMessage.delete().catch(() => {});
    }
  } catch {}

  await interaction.update({
    content: message,
    components: [],
  });

  const channelToDelete = trackedShopChannel || interaction.channel;

  setTimeout(async () => {
    try {
      await channelToDelete.delete("Shop session closed");
    } catch (err) {
      console.error("Failed to delete shop session channel:", err);
    }
  }, delayMs);
}

function clearTrackedShopSessionChannel(userId) {
  SHOP_SESSION_CHANNELS.delete(userId);
}

async function createOrGetShopSessionChannel(guild, user) {
  const existingTracked = await getTrackedShopSessionChannel(guild, user.id);
  if (existingTracked) return existingTracked;

  const topicMarker = `shop-session:${user.id}`;
  const cachedExisting = guild.channels.cache.find(
    (ch) => ch && ch.type === ChannelType.GuildText && ch.topic === topicMarker
  );

  if (cachedExisting) {
    trackShopSessionChannel(user.id, cachedExisting.id);
    return cachedExisting;
  }

  const menuChannel = await guild.channels.fetch(MENU_CHANNEL_ID).catch(() => null);
  const parentId = menuChannel?.parentId || null;

  const channel = await guild.channels.create({
    name: safeChannelName(`shop-${user.username}`),
    type: ChannelType.GuildText,
    parent: parentId,
    topic: topicMarker,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: ["ViewChannel"] },
      { id: user.id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] },
      { id: STAFF_ROLE_ID, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] },
      {
        id: guild.members.me.id,
        allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "ManageChannels"],
      },
    ],
  });

  trackShopSessionChannel(user.id, channel.id);
  return channel;
}

async function sendOrEditCartUiMessage(interaction, payload, options = {}) {
  const { keepReply = false } = options;

  await interaction.deferReply({ ephemeral: true });

  const targetChannel = await createOrGetShopSessionChannel(interaction.guild, interaction.user);
  const existing = await getTrackedCartUiMessage(interaction.user.id, targetChannel);

  let msg;

  if (existing) {
    await existing.edit(payload);
    msg = existing;
  } else {
    msg = await targetChannel.send(payload);
    trackCartUiMessage(interaction.user.id, targetChannel.id, msg.id);
  }

  if (keepReply) {
    return { message: msg, channel: targetChannel };
  }

  await interaction.deleteReply().catch(() => {});
  return { message: msg, channel: targetChannel };
}

/* ------------------------- ORDER DB HELPERS ------------------------- */

async function createOrderFromCart(userId, shippingProfile, cart, discount) {
  const db = await pool.connect();

  try {
    await db.query("BEGIN");

    const subtotal = Number(cart.subtotal_pence || 0);
    const shipping = getShippingPenceForCountry(shippingProfile.country);

    let safeDiscount = {
      discount_code: discount.discount_code || null,
      discount_percent: Number(discount.discount_percent || 0),
    };

    if (safeDiscount.discount_code) {
      const validation = await validateDiscountCodeForUser(userId, safeDiscount.discount_code);
      if (!validation.valid) {
        throw new Error(`${validation.reason} The code has been removed from this basket.`);
      }

      safeDiscount = {
        discount_code: validation.code,
        discount_percent: Number(validation.discount_percent || 0),
      };
    }

    for (const it of cart.items) {
      if (!it.product_id) {
        throw new Error(`Cart item ${it.name} is missing a product id.`);
      }

      const stockCheck = await db.query(
        `SELECT stock_qty, is_active FROM shop_products WHERE product_id = $1 FOR UPDATE`,
        [it.product_id]
      );

      const stockRow = stockCheck.rows[0];
      const stockQty = Number(stockRow?.stock_qty || 0);
      const isActive = !!stockRow?.is_active;

      if (!isActive) {
        throw new Error(`${it.name} is no longer available.`);
      }

      if (Number(it.qty) > stockQty) {
        throw new Error(`Stock changed. Only ${stockQty} left for ${it.name}. Please update your basket and try again.`);
      }
    }

    const totals = calculateDiscountedTotals(subtotal, shipping, safeDiscount.discount_percent);

    const orderRes = await db.query(
      `
      INSERT INTO orders (
        user_id, full_name, email, phone, full_address, country,
        subtotal_pence, shipping_pence, total_pence, discount_code,
        discount_percent, discount_amount_pence, status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending')
      RETURNING order_id
      `,
      [
        userId,
        shippingProfile.full_name,
        shippingProfile.email,
        shippingProfile.phone,
        shippingProfile.full_address,
        shippingProfile.country,
        subtotal,
        shipping,
        totals.total,
        safeDiscount.discount_code,
        safeDiscount.discount_percent,
        totals.discountAmount,
      ]
    );

    const orderId = Number(orderRes.rows[0].order_id);

    for (const it of cart.items) {
      await db.query(
        `
        INSERT INTO order_items (order_id, product_id, sku, name, size, color, qty, price_pence)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        `,
        [orderId, it.product_id, it.sku, it.name, it.size, it.color, it.qty, it.price_pence]
      );

      const stockUpdate = await db.query(
        `
        UPDATE shop_products
        SET stock_qty = stock_qty - $1,
            updated_at = NOW()
        WHERE product_id = $2 AND stock_qty >= $1
        `,
        [it.qty, it.product_id]
      );

      if (!stockUpdate.rowCount) {
        throw new Error(`Failed to reserve stock for ${it.name}. Please try again.`);
      }
    }

    if (safeDiscount.discount_code) {
      await db.query(
        `
        INSERT INTO discount_code_uses (code, user_id, order_id, used_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (code, user_id) DO NOTHING
        `,
        [safeDiscount.discount_code, userId, orderId]
      );
    }

    await db.query(
      `DELETE FROM cart_items WHERE cart_id IN (SELECT cart_id FROM carts WHERE user_id = $1 AND status = 'open')`,
      [userId]
    );

    await db.query(
      `DELETE FROM carts WHERE user_id = $1 AND status = 'open'`,
      [userId]
    );

    await db.query("COMMIT");

    return {
      orderId,
      subtotal,
      shipping,
      total: totals.total,
      discountAmount: totals.discountAmount,
      discountCode: safeDiscount.discount_code,
      discountPercent: safeDiscount.discount_percent,
    };
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  } finally {
    db.release();
  }
}

/* ------------------------------ INTERACTIONS ----------------------------- */

client.on("interactionCreate", async (interaction) => {
  let deferred = false;

  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "ping") {
        return interaction.reply({ content: "pong ✅", ephemeral: true });
      }

      if (interaction.commandName === "setupshop") {
        await interaction.deferReply({ ephemeral: true });
        deferred = true;

        const menuChannel = await client.channels.fetch(MENU_CHANNEL_ID);

        const content =
          `**Welcome to ${STORE_NAME}!**\n\n` +
          `**How it works:**\n` +
          `1) Click the button below to get started\n` +
          `2) Enter your shipping details\n` +
          `3) Browse categories and select items\n` +
          `4) Add multiple items to your basket\n` +
          `5) Apply ${WELCOME_CODE} on your first order for 10% off products only\n` +
          `6) Submit your order when you're done\n\n` +
          `**Shipping:** UK Tracked £10 • Europe £35 • USA £45\n` +
          `**Cut-off:** 15:30 (Mon–Fri Dispatch)\n\n` +
          `Browse our available products below. Stock updates live and staff support is available if needed.`;

        await menuChannel.send({
          content,
          components: menuMessageComponents(),
        });

        return interaction.editReply("✅ Shop menu message posted or refreshed in the menu channel.");
      }

      if (interaction.commandName === "setupverify") {
        await interaction.deferReply({ ephemeral: true });
        deferred = true;

        const verifyChannel = await client.channels.fetch(VERIFY_CHANNEL_ID).catch(() => null);
        if (!verifyChannel) {
          return interaction.editReply("❌ Could not find the verify channel. Check VERIFY_CHANNEL_ID.");
        }

        const { embed, row } = verifyPanelComponents();

        await verifyChannel.send({
          embeds: [embed],
          components: [row],
        });

        return interaction.editReply(`✅ Verification panel posted in <#${VERIFY_CHANNEL_ID}>.`);
      }

      if (interaction.commandName === "setupstaffpanel") {
        await interaction.deferReply({ ephemeral: true });
        deferred = true;

        const staffChannel = await client.channels.fetch(STAFF_ONLY_CHANNEL_ID).catch(() => null);
        if (!staffChannel) {
          return interaction.editReply("❌ Could not find the staff-only channel. Check STAFF_ONLY_CHANNEL_ID.");
        }

        const { embed, rows } = staffPanelComponents();

        await staffChannel.send({
          embeds: [embed],
          components: rows,
        });

        return interaction.editReply(`✅ Staff panel posted in <#${STAFF_ONLY_CHANNEL_ID}>.`);
      }
    }

    if (interaction.isButton()) {
      const { customId } = interaction;

      if (customId === "open_menu") {
        await createOrGetShopSessionChannel(interaction.guild, interaction.user);
        return interaction.showModal(shippingModal());
      }

      if (customId === "verify_open_modal") {
        return interaction.showModal(verifyModal());
      }

      if (customId.startsWith("verify_approve:")) {
        const [, targetUserId] = customId.split(":");

        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        const guild = interaction.guild;
        const member = await guild.members.fetch(targetUserId).catch(() => null);

        if (!member) {
          return interaction.reply({
            content: "Could not find that user in the server.",
            ephemeral: true,
          });
        }

        const verifiedRole =
          guild.roles.cache.get(VERIFIED_ROLE_ID) ||
          (await guild.roles.fetch(VERIFIED_ROLE_ID).catch(() => null));

        if (!verifiedRole) {
          return interaction.reply({
            content: "Could not find the Verified role. Check VERIFIED_ROLE_ID.",
            ephemeral: true,
          });
        }

        if (member.roles.cache.has(VERIFIED_ROLE_ID)) {
          return interaction.reply({
            content: "That user is already verified.",
            ephemeral: true,
          });
        }

        await member.roles.add(VERIFIED_ROLE_ID, `Approved by ${interaction.user.tag}`);

        await interaction.update({
          content: `✅ Verified <@${targetUserId}> by <@${interaction.user.id}>`,
          embeds: interaction.message.embeds,
          components: [],
        });

        try {
          await member.send(`✅ You have been verified in **${guild.name}** and should now have access to the full server.`);
        } catch {}

        return;
      }

      if (customId === "staff_manage_categories") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }
        if (!isStaffChannel(interaction)) {
          return interaction.reply({ content: "Use this in the staff-only channel.", ephemeral: true });
        }

        return interaction.reply({
          content: "Category management:",
          components: staffCategoryActionButtons(),
          ephemeral: true,
        });
      }

      if (customId === "staff_manage_products") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }
        if (!isStaffChannel(interaction)) {
          return interaction.reply({ content: "Use this in the staff-only channel.", ephemeral: true });
        }

        return interaction.reply({
          content: "Product management:",
          components: staffProductActionButtons(),
          ephemeral: true,
        });
      }

      if (customId === "staff_open_stock_flow") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }
        if (!isStaffChannel(interaction)) {
          return interaction.reply({ content: "Use this in the staff-only channel.", ephemeral: true });
        }

        const menus = await staffProductSelectMenus("staff_pick_stock_product", "Choose a product to adjust stock…");
        if (!menus.length) {
          return interaction.reply({ content: "No active products found.", ephemeral: true });
        }

        return interaction.reply({
          content: "Choose a product to adjust stock:",
          components: menus,
          ephemeral: true,
        });
      }

      if (customId === "staff_open_orderlookup_modal") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }
        if (!isStaffChannel(interaction)) {
          return interaction.reply({ content: "Use this in the staff-only channel.", ephemeral: true });
        }

        return interaction.showModal(staffOrderLookupModal());
      }

      if (customId === "staff_open_create_discount_modal") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }
        if (!isStaffChannel(interaction)) {
          return interaction.reply({ content: "Use this in the staff-only channel.", ephemeral: true });
        }

        return interaction.showModal(staffCreateDiscountModal());
      }

      if (customId === "staff_open_toggle_discount_modal") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }
        if (!isStaffChannel(interaction)) {
          return interaction.reply({ content: "Use this in the staff-only channel.", ephemeral: true });
        }

        return interaction.showModal(staffToggleDiscountModal());
      }

      if (customId === "staff_open_add_category_modal") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }
        return interaction.showModal(addCategoryModal());
      }

      if (customId === "staff_start_rename_category") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        const menus = await staffCategorySelectMenus("staff_pick_rename_category", "Choose a category to rename…");
        if (!menus.length) {
          return interaction.reply({ content: "No active categories found.", ephemeral: true });
        }

        return interaction.reply({
          content: "Choose a category to rename:",
          components: menus,
          ephemeral: true,
        });
      }

      if (customId === "staff_start_archive_category") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        const menus = await staffCategorySelectMenus("staff_pick_archive_category", "Choose a category to archive…");
        if (!menus.length) {
          return interaction.reply({ content: "No active categories found.", ephemeral: true });
        }

        return interaction.reply({
          content: "Choose a category to archive:",
          components: menus,
          ephemeral: true,
        });
      }

      if (customId === "staff_open_add_product_pick_category") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        const menus = await staffCategorySelectMenus("staff_pick_add_product_category", "Choose a category for the new product…");
        if (!menus.length) {
          return interaction.reply({ content: "No active categories found.", ephemeral: true });
        }

        return interaction.reply({
          content: "Choose the category for the new product:",
          components: menus,
          ephemeral: true,
        });
      }

      if (customId === "staff_start_rename_product") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        const menus = await staffProductSelectMenus("staff_pick_rename_product", "Choose a product to rename…");
        if (!menus.length) {
          return interaction.reply({ content: "No active products found.", ephemeral: true });
        }

        return interaction.reply({
          content: "Choose a product to rename:",
          components: menus,
          ephemeral: true,
        });
      }

      if (customId === "staff_start_change_price") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        const menus = await staffProductSelectMenus("staff_pick_change_price_product", "Choose a product to change price…");
        if (!menus.length) {
          return interaction.reply({ content: "No active products found.", ephemeral: true });
        }

        return interaction.reply({
          content: "Choose a product to change price:",
          components: menus,
          ephemeral: true,
        });
      }

      if (customId === "staff_start_archive_product") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        const menus = await staffProductSelectMenus("staff_pick_archive_product", "Choose a product to archive…");
        if (!menus.length) {
          return interaction.reply({ content: "No active products found.", ephemeral: true });
        }

        return interaction.reply({
          content: "Choose a product to archive:",
          components: menus,
          ephemeral: true,
        });
      }

      if (customId.startsWith("add_qty:")) {
        trackCartUiMessage(interaction.user.id, interaction.channel.id, interaction.message.id);

        const [, productIdStr, qtyStr] = customId.split(":");
        const productId = Number(productIdStr);
        const qty = Number(qtyStr);

        const product = await getProductById(productId);
        if (!product || !product.is_active) {
          return interaction.update({
            content: "❌ Item not found or no longer active.",
            components: await categorySelectComponents(),
          });
        }

        if (Number(product.stock_qty || 0) <= 0) {
          return interaction.update({
            content: "❌ That item is out of stock.",
            components: await categorySelectComponents(),
          });
        }

        await addCartItem(interaction.user.id, product, qty);
        const content = await buildCartMessage(interaction.user.id);

        return interaction.update({
          content,
          components: cartActionsComponents(),
        });
      }

      if (customId.startsWith("add_qty_other:")) {
        trackCartUiMessage(interaction.user.id, interaction.channel.id, interaction.message.id);
        const [, productIdStr] = customId.split(":");
        return interaction.showModal(qtyOtherModal(Number(productIdStr)));
      }

      if (customId === "cart_add_more") {
        trackCartUiMessage(interaction.user.id, interaction.channel.id, interaction.message.id);

        return interaction.update({
          content: "Choose a category:",
          components: await categorySelectComponents(),
        });
      }

      if (customId === "cart_discount") {
        trackCartUiMessage(interaction.user.id, interaction.channel.id, interaction.message.id);

        const cart = await getCartSummary(interaction.user.id);
        if (!cart.items.length) {
          return interaction.update({
            content:
              "🗑️ **Basket empty**\n\n" +
              "Your cart is empty.\n" +
              "Choose a category below to start a new order:",
            components: await categorySelectComponents(),
          });
        }

        return interaction.showModal(discountCodeModal());
      }

if (customId === "cart_clear") {
  trackCartUiMessage(interaction.user.id, interaction.channel.id, interaction.message.id);

  await clearCart(interaction.user.id);

  return closeShopSession(interaction, {
    message:
      "🗑️ **Basket cleared**\n\n" +
      "Your cart has been cleared successfully.\n" +
      "This private shopping channel will close in 3 seconds.",
    delayMs: 3000,
  });
}

if (customId === "cart_submit") {
  trackCartUiMessage(interaction.user.id, interaction.channel.id, interaction.message.id);

  if (isSubmitLocked(interaction.user.id)) {
    return interaction.update({
      content: "Your order is already being processed. Please wait a few seconds.",
      components: cartActionsComponents(true),
    });
  }

  setSubmitLock(interaction.user.id);

  try {
    const cart = await getCartSummary(interaction.user.id);

    if (!cart.items.length) {
      return interaction.update({
        content:
          "🗑️ **Basket empty**\n\n" +
          "Your cart is empty.\n" +
          "Choose a category below to start a new order:",
        components: await categorySelectComponents(),
      });
    }

    const shippingProfile = await getUserShippingProfile(interaction.user.id);

    if (!shippingProfile) {
      return interaction.update({
        content: "I don't have your shipping details yet. Click the menu button again and enter your details.",
        components: [],
      });
    }

    const discount = await getCartDiscount(interaction.user.id);

    const orderResult = await createOrderFromCart(
      interaction.user.id,
      shippingProfile,
      cart,
      discount
    );

    const receiptChannel = await createReceiptChannel(
      interaction.guild,
      interaction.user,
      orderResult.orderId
    );

    await pool.query(
      `UPDATE orders SET receipt_channel_id = $1 WHERE order_id = $2`,
      [receiptChannel.id, orderResult.orderId]
    );

    await receiptChannel.send({
      content:
        `<@${interaction.user.id}> **Thanks!** Your order has been received.\n\n` +
        `✅ Please pay by **bank transfer** using the details in the receipt below.\n` +
        `<@&${STAFF_ROLE_ID}> once confirmed, please mark as paid or dispatched when appropriate.`,
      embeds: [
        receiptEmbed(
          orderResult.orderId,
          cart.items,
          orderResult.subtotal,
          orderResult.discountAmount,
          orderResult.discountCode,
          orderResult.shipping,
          orderResult.total,
          shippingProfile,
          "pending"
        ),
      ],
      components: staffReceiptControls(orderResult.orderId, "pending"),
    });

const continueRow = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setLabel("Continue to Receipt")
    .setStyle(ButtonStyle.Link)
    .setURL(`https://discord.com/channels/${interaction.guild.id}/${receiptChannel.id}`)
);

await interaction.channel.send({
  content: `✅ Order submitted. Your receipt channel is ready.\nThis private shopping channel will close in 20 seconds.`,
  components: [continueRow],
});

await closeShopSession(interaction, {
  message:
    "✅ **Order submitted**\n\n" +
    "Your receipt channel is ready.\n" +
    "This private shopping channel will close in 20 seconds.",
  delayMs: 20000,
});

return;
  } finally {
    clearSubmitLock(interaction.user.id);
  }
}

      if (customId.startsWith("staff_mark_paid:")) {
        const [, orderIdStr] = customId.split(":");
        const orderId = parseInt(orderIdStr, 10);

        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        await pool.query(`UPDATE orders SET status = 'paid' WHERE order_id = $1`, [orderId]);

        await interaction.update({
          content: `✅ Order #${orderId} marked as paid.`,
          embeds: interaction.message.embeds,
          components: staffReceiptControls(orderId, "paid"),
        });

        await interaction.channel.send(`✅ Order #${orderId} has been marked as paid.`);
        return;
      }

      if (customId.startsWith("staff_mark_dispatched:")) {
        const [, orderIdStr] = customId.split(":");
        const orderId = parseInt(orderIdStr, 10);

        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        await pool.query(`UPDATE orders SET status = 'dispatched' WHERE order_id = $1`, [orderId]);

        await interaction.update({
          content: `📦 Order #${orderId} marked as dispatched.`,
          embeds: interaction.message.embeds,
          components: staffReceiptControls(orderId, "dispatched"),
        });

        await interaction.channel.send(`📦 Order #${orderId} has been marked as dispatched.`);
        return;
      }

      if (customId.startsWith("staff_cancel_order:")) {
        const [, orderIdStr] = customId.split(":");
        const orderId = parseInt(orderIdStr, 10);

        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        const orderRes = await pool.query(
          `SELECT status, user_id FROM orders WHERE order_id = $1`,
          [orderId]
        );

        if (!orderRes.rows.length) {
          return interaction.reply({ content: "Order not found.", ephemeral: true });
        }

        const currentStatus = orderRes.rows[0].status;
        const customerUserId = orderRes.rows[0].user_id;

        if (currentStatus === "cancelled") {
          return interaction.reply({ content: "This order is already cancelled.", ephemeral: true });
        }

        if (currentStatus === "dispatched" || currentStatus === "completed") {
          return interaction.reply({ content: "Dispatched or completed orders cannot be cancelled.", ephemeral: true });
        }

        const itemsRes = await pool.query(
          `SELECT product_id, qty FROM order_items WHERE order_id = $1`,
          [orderId]
        );

        for (const item of itemsRes.rows) {
          if (item.product_id) {
            await pool.query(
              `
              UPDATE shop_products
              SET stock_qty = stock_qty + $1,
                  updated_at = NOW()
              WHERE product_id = $2
              `,
              [item.qty, item.product_id]
            );
          }
        }

        await pool.query(`UPDATE orders SET status = 'cancelled' WHERE order_id = $1`, [orderId]);

        await interaction.update({
          content: `❌ Order #${orderId} has been cancelled.`,
          embeds: interaction.message.embeds,
          components: staffReceiptControls(orderId, "cancelled"),
        });

        await interaction.channel.send(`❌ Order #${orderId} has been cancelled. Stock has been restored.`);

        try {
          await interaction.channel.permissionOverwrites.edit(customerUserId, {
            SendMessages: false,
          });
        } catch {}

        return;
      }

      if (customId.startsWith("staff_complete_order:")) {
        const [, orderIdStr] = customId.split(":");
        const orderId = parseInt(orderIdStr, 10);

        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        const orderRes = await pool.query(`SELECT status FROM orders WHERE order_id = $1`, [orderId]);

        if (!orderRes.rows.length) {
          return interaction.reply({ content: "Order not found.", ephemeral: true });
        }

        const currentStatus = orderRes.rows[0].status;

        if (currentStatus === "cancelled") {
          return interaction.reply({ content: "Cancelled orders cannot be completed.", ephemeral: true });
        }

        if (currentStatus === "completed") {
          return interaction.reply({ content: "This order is already completed.", ephemeral: true });
        }

        if (currentStatus !== "dispatched") {
          return interaction.reply({
            content: "Order must be marked as dispatched before it can be completed.",
            ephemeral: true,
          });
        }

        await pool.query(`UPDATE orders SET status = 'completed' WHERE order_id = $1`, [orderId]);

        await interaction.update({
          content: `✅ Order #${orderId} marked as completed. Closing this channel in 5 seconds...`,
          embeds: interaction.message.embeds,
          components: staffReceiptControls(orderId, "completed"),
        });

        await interaction.channel.send(`✅ Order #${orderId} is complete. This channel will now close.`);

        setTimeout(async () => {
          try {
            await interaction.channel.delete("Order completed and closed by staff");
          } catch (err) {
            console.error("Failed to delete completed order channel:", err);
          }
        }, 5000);

        return;
      }
    }

    if (interaction.isStringSelectMenu()) {
      const customIdBase = interaction.customId.split(":")[0];

      if (customIdBase === "select_category") {
        trackCartUiMessage(interaction.user.id, interaction.channel.id, interaction.message.id);

        const categoryId = Number(interaction.values[0]);
        const itemComponents = await itemSelectComponents(categoryId);

        if (!itemComponents.length) {
          return interaction.update({
            content: "That category currently has no active products.",
            components: await categorySelectComponents(),
          });
        }

        return interaction.update({
          content: "Now choose an item:",
          components: itemComponents,
        });
      }

      if (customIdBase === "select_item") {
        trackCartUiMessage(interaction.user.id, interaction.channel.id, interaction.message.id);

        const productId = Number(interaction.values[0]);
        const product = await getProductById(productId);

        if (!product || !product.is_active) {
          return interaction.update({
            content: "That item is no longer available.",
            components: await categorySelectComponents(),
          });
        }

        if (Number(product.stock_qty || 0) <= 0) {
          return interaction.update({
            content: "That item is out of stock.",
            components: await categorySelectComponents(),
          });
        }

        const qtyComponents = await qtyButtonsComponents(productId);

        return interaction.update({
          content: `Selected item — how many? (In stock: ${product.stock_qty})`,
          components: qtyComponents,
        });
      }

      if (customIdBase === "staff_pick_stock_product") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        const productId = Number(interaction.values[0]);
        const product = await getProductById(productId);

        if (!product) {
          return interaction.reply({ content: "Product not found.", ephemeral: true });
        }

        return interaction.showModal(changeStockModal(product.product_id, product.stock_qty, product.name));
      }

      if (customIdBase === "staff_pick_rename_category") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        const categoryId = Number(interaction.values[0]);
        const category = await getCategoryById(categoryId);

        if (!category) {
          return interaction.reply({ content: "Category not found.", ephemeral: true });
        }

        return interaction.showModal(renameCategoryModal(category.category_id, category.name));
      }

      if (customIdBase === "staff_pick_archive_category") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        const categoryId = Number(interaction.values[0]);
        const archived = await archiveCategory(categoryId);

        if (!archived) {
          return interaction.reply({ content: "Category not found.", ephemeral: true });
        }

        return interaction.reply({
          content: `✅ Category **${archived.name}** archived.`,
          ephemeral: true,
        });
      }

      if (customIdBase === "staff_pick_add_product_category") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        const categoryId = Number(interaction.values[0]);
        const category = await getCategoryById(categoryId);

        if (!category || !category.is_active) {
          return interaction.reply({ content: "Category not found.", ephemeral: true });
        }

        return interaction.showModal(addProductModal(category.category_id, category.name));
      }

      if (customIdBase === "staff_pick_rename_product") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        const productId = Number(interaction.values[0]);
        const product = await getProductById(productId);

        if (!product) {
          return interaction.reply({ content: "Product not found.", ephemeral: true });
        }

        return interaction.showModal(renameProductModal(product.product_id, product.name));
      }

      if (customIdBase === "staff_pick_change_price_product") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        const productId = Number(interaction.values[0]);
        const product = await getProductById(productId);

        if (!product) {
          return interaction.reply({ content: "Product not found.", ephemeral: true });
        }

        return interaction.showModal(changePriceModal(product.product_id, product.price_pence));
      }

      if (customIdBase === "staff_pick_archive_product") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        const productId = Number(interaction.values[0]);
        const archived = await archiveProduct(productId);

        if (!archived) {
          return interaction.reply({ content: "Product not found.", ephemeral: true });
        }

        return interaction.reply({
          content: `✅ Product **${archived.name}** (${archived.sku}) archived.`,
          ephemeral: true,
        });
      }
    }

    if (interaction.isModalSubmit()) {
      const { customId } = interaction;

      if (customId === "shipping_modal") {
        const full_name = interaction.fields.getTextInputValue("full_name")?.trim();
        const email = interaction.fields.getTextInputValue("email")?.trim();
        const phone = interaction.fields.getTextInputValue("phone")?.trim();
        const full_address = interaction.fields.getTextInputValue("full_address")?.trim();
        const country = interaction.fields.getTextInputValue("country")?.trim();

        if (!full_name || !email || !phone || !full_address || !country) {
          return interaction.reply({ content: "All fields are required.", ephemeral: true });
        }

        await upsertProfile(interaction.user.id, full_name, email, phone, {
          full_address,
          country,
        });

        const payload = {
          content: "✅ Details saved. Choose a category:",
          components: await categorySelectComponents(),
        };

        const { channel } = await sendOrEditCartUiMessage(interaction, payload, { keepReply: true });

        const continueOrderRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("Continue Order")
            .setStyle(ButtonStyle.Link)
            .setURL(`https://discord.com/channels/${interaction.guild.id}/${channel.id}`)
        );

        await interaction.editReply({
          content: `✅ Details saved. Your private shop channel is ready.`,
          components: [continueOrderRow],
        });

        setTimeout(async () => {
          try {
            await interaction.deleteReply();
          } catch (err) {
            console.error("Failed to delete temporary shop redirect reply:", err);
          }
        }, 20000);

        return;
      }

      if (customId === "verify_submit_modal") {
        const submittedName = interaction.fields.getTextInputValue("verify_name")?.trim();
        const foundUs = interaction.fields.getTextInputValue("verify_found")?.trim();
        const referral = interaction.fields.getTextInputValue("verify_referral")?.trim();
        const email = interaction.fields.getTextInputValue("verify_email")?.trim();
        const phone = interaction.fields.getTextInputValue("verify_phone")?.trim();

        if (!submittedName || !foundUs || !referral || !email || !phone) {
          return interaction.reply({
            content: "All verification fields are required.",
            ephemeral: true,
          });
        }

        const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (!emailLooksValid) {
          return interaction.reply({
            content: "Please enter a valid email address.",
            ephemeral: true,
          });
        }

        const phoneClean = phone.replace(/[^\d+]/g, "");
        if (phoneClean.length < 7) {
          return interaction.reply({
            content: "Please enter a valid phone number.",
            ephemeral: true,
          });
        }

        const logChannel = await interaction.guild.channels.fetch(VERIFICATION_LOG_CHANNEL_ID).catch(() => null);
        if (!logChannel) {
          return interaction.reply({
            content: "Could not find the verification log channel. Check VERIFICATION_LOG_CHANNEL_ID.",
            ephemeral: true,
          });
        }

        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (member?.roles?.cache?.has(VERIFIED_ROLE_ID)) {
          return interaction.reply({
            content: "You are already verified.",
            ephemeral: true,
          });
        }

        const embed = new EmbedBuilder()
          .setTitle("New Verification Submission")
          .addFields(
            { name: "User", value: `<@${interaction.user.id}>` },
            { name: "Username", value: `${interaction.user.tag}` },
            { name: "User ID", value: interaction.user.id },
            { name: "Full name", value: submittedName },
            { name: "How they heard about us", value: foundUs },
            { name: "Referral / who sent them", value: referral },
            { name: "Email", value: email },
            { name: "Phone", value: phone }
          )
          .setTimestamp();

        await logChannel.send({
          content: `New verification request from <@${interaction.user.id}>`,
          embeds: [embed],
          components: verifyApproveComponents(interaction.user.id),
          allowedMentions: { parse: [] },
        });

        return interaction.reply({
          content: "✅ Thanks. Your verification has been submitted and will be reviewed shortly.",
          ephemeral: true,
        });
      }

      if (customId === "staff_orderlookup_modal") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        const orderIdRaw = interaction.fields.getTextInputValue("lookup_order_id")?.trim();
        const orderId = parseInt(orderIdRaw, 10);

        if (!Number.isFinite(orderId) || orderId <= 0) {
          return interaction.reply({ content: "Enter a valid order ID.", ephemeral: true });
        }

        const orderRes = await pool.query(`SELECT * FROM orders WHERE order_id = $1`, [orderId]);
        if (!orderRes.rows.length) {
          return interaction.reply({ content: "Order not found.", ephemeral: true });
        }

        const order = orderRes.rows[0];

        const itemsRes = await pool.query(
          `SELECT name, qty, price_pence FROM order_items WHERE order_id = $1 ORDER BY id ASC`,
          [orderId]
        );

        const itemLines = itemsRes.rows.map(
          (it) => `• ${it.name} × ${it.qty} — ${money(Number(it.qty) * Number(it.price_pence))}`
        );

        const embed = new EmbedBuilder()
          .setTitle(`Order #${orderId}`)
          .addFields(
            { name: "Status", value: order.status || "unknown", inline: true },
            { name: "Total", value: money(order.total_pence || 0), inline: true },
            { name: "User ID", value: order.user_id || "unknown", inline: true },
            { name: "Receipt Channel", value: order.receipt_channel_id ? `<#${order.receipt_channel_id}>` : "None" },
            { name: "Items", value: itemLines.join("\n") || "_No items_" }
          )
          .setTimestamp(new Date(order.created_at));

        return interaction.reply({
          embeds: [embed],
          ephemeral: true,
        });
      }

      if (customId === "staff_create_discount_modal") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        const codeRaw = interaction.fields.getTextInputValue("discount_code")?.trim();
        const percentRaw = interaction.fields.getTextInputValue("discount_percent")?.trim();

        const code = normalizeDiscountCode(codeRaw);
        const percent = parseInt(percentRaw, 10);

        if (!code) {
          return interaction.reply({ content: "Enter a valid code.", ephemeral: true });
        }

        if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
          return interaction.reply({ content: "Enter a valid percent from 0 to 100.", ephemeral: true });
        }

        await createDiscountCodeRecord(code, percent);

        return interaction.reply({
          content: `✅ Discount code **${code}** created or updated at ${percent}% and set active.`,
          ephemeral: true,
        });
      }

      if (customId === "staff_toggle_discount_modal") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        const codeRaw = interaction.fields.getTextInputValue("discount_code")?.trim();
        const stateRaw = interaction.fields.getTextInputValue("discount_active")?.trim().toLowerCase();

        const code = normalizeDiscountCode(codeRaw);
        if (!code) {
          return interaction.reply({ content: "Enter a valid code.", ephemeral: true });
        }

        let active;
        if (stateRaw === "active") active = true;
        else if (stateRaw === "inactive") active = false;
        else {
          return interaction.reply({ content: "Type either active or inactive.", ephemeral: true });
        }

        const updated = await setDiscountCodeActiveState(code, active);
        if (!updated) {
          return interaction.reply({ content: "That discount code was not found.", ephemeral: true });
        }

        return interaction.reply({
          content: `✅ Discount code **${updated.code}** is now **${updated.is_active ? "active" : "inactive"}**.`,
          ephemeral: true,
        });
      }

      if (customId === "staff_add_category_modal") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        const categoryName = interaction.fields.getTextInputValue("category_name")?.trim();
        const created = await createCategory(categoryName);

        return interaction.reply({
          content: `✅ Category **${created.name}** created.`,
          ephemeral: true,
        });
      }

      if (customId.startsWith("staff_rename_category_modal:")) {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        const [, categoryIdStr] = customId.split(":");
        const categoryId = Number(categoryIdStr);
        const newName = interaction.fields.getTextInputValue("category_name")?.trim();

        const updated = await renameCategory(categoryId, newName);
        if (!updated) {
          return interaction.reply({ content: "Category not found.", ephemeral: true });
        }

        return interaction.reply({
          content: `✅ Category renamed to **${updated.name}**.`,
          ephemeral: true,
        });
      }

      if (customId.startsWith("staff_add_product_modal:")) {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        const [, categoryIdStr] = customId.split(":");
        const categoryId = Number(categoryIdStr);

        const sku = interaction.fields.getTextInputValue("sku")?.trim();
        const name = interaction.fields.getTextInputValue("name")?.trim();
        const priceRaw = interaction.fields.getTextInputValue("price_pence")?.trim();
        const stockRaw = interaction.fields.getTextInputValue("stock_qty")?.trim();
        const defaultSize = interaction.fields.getTextInputValue("default_size")?.trim();

        const pricePence = parseInt(priceRaw, 10);
        const stockQty = parseInt(stockRaw, 10);

        const created = await createProduct({
          categoryId,
          sku,
          name,
          pricePence,
          stockQty,
          defaultSize,
          defaultColor: DEFAULT_COLOR,
        });

        return interaction.reply({
          content: `✅ Product **${created.name}** (${created.sku}) created.`,
          ephemeral: true,
        });
      }

      if (customId.startsWith("staff_rename_product_modal:")) {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        const [, productIdStr] = customId.split(":");
        const productId = Number(productIdStr);
        const newName = interaction.fields.getTextInputValue("product_name")?.trim();

        const updated = await updateProductName(productId, newName);
        if (!updated) {
          return interaction.reply({ content: "Product not found.", ephemeral: true });
        }

        return interaction.reply({
          content: `✅ Product renamed to **${updated.name}**.`,
          ephemeral: true,
        });
      }

      if (customId.startsWith("staff_change_price_modal:")) {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        const [, productIdStr] = customId.split(":");
        const productId = Number(productIdStr);
        const priceRaw = interaction.fields.getTextInputValue("price_pence")?.trim();
        const pricePence = parseInt(priceRaw, 10);

        const updated = await updateProductPrice(productId, pricePence);
        if (!updated) {
          return interaction.reply({ content: "Product not found.", ephemeral: true });
        }

        return interaction.reply({
          content: `✅ Price updated for **${updated.name}** to ${money(updated.price_pence)}.`,
          ephemeral: true,
        });
      }

      if (customId.startsWith("staff_change_stock_modal:")) {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        const [, productIdStr] = customId.split(":");
        const productId = Number(productIdStr);
        const stockRaw = interaction.fields.getTextInputValue("stock_qty")?.trim();
        const stockQty = parseInt(stockRaw, 10);

        const updated = await updateProductStock(productId, stockQty);
        if (!updated) {
          return interaction.reply({ content: "Product not found.", ephemeral: true });
        }

        return interaction.reply({
          content: `✅ Stock updated for **${updated.name}** (${updated.sku}) → ${updated.stock_qty}.`,
          ephemeral: true,
        });
      }

      if (customId.startsWith("qty_other_modal:")) {
        const [, productIdStr] = customId.split(":");
        const productId = Number(productIdStr);
        const qtyRaw = interaction.fields.getTextInputValue("qty");
        const qty = parseInt(qtyRaw, 10);

        if (!Number.isFinite(qty) || qty <= 0) {
          return interaction.reply({ content: "Please enter a valid quantity (number > 0).", ephemeral: true });
        }

        const product = await getProductById(productId);
        if (!product || !product.is_active) {
          return interaction.reply({ content: "Item not found.", ephemeral: true });
        }

        if (qty > Number(product.stock_qty || 0)) {
          return interaction.reply({
            content: `Only ${product.stock_qty} in stock for ${product.name}.`,
            ephemeral: true,
          });
        }

        await addCartItem(interaction.user.id, product, qty);

        const content = await buildCartMessage(interaction.user.id);
        await sendOrEditCartUiMessage(interaction, {
          content,
          components: cartActionsComponents(),
        });

        return;
      }

      if (customId === "discount_code_modal") {
        const enteredRaw = interaction.fields.getTextInputValue("discount_code")?.trim();
        const enteredCode = normalizeDiscountCode(enteredRaw);

        if (!enteredCode) {
          return interaction.reply({ content: "Please enter a code.", ephemeral: true });
        }

        const cart = await getCartSummary(interaction.user.id);
        if (!cart.items.length) {
          return interaction.reply({ content: "Your cart is empty.", ephemeral: true });
        }

        const existingDiscount = await getCartDiscount(interaction.user.id);
        if (existingDiscount.discount_code) {
          return interaction.reply({
            content: `A code has already been applied to this order: ${existingDiscount.discount_code}`,
            ephemeral: true,
          });
        }

        const validation = await validateDiscountCodeForUser(interaction.user.id, enteredCode);
        if (!validation.valid) {
          return interaction.reply({
            content: validation.reason,
            ephemeral: true,
          });
        }

        await setCartDiscount(interaction.user.id, validation.code, validation.discount_percent);

        const content = await buildCartMessage(interaction.user.id, "✅ Discount code applied.");
        await sendOrEditCartUiMessage(interaction, {
          content,
          components: cartActionsComponents(),
        });

        return;
      }
    }
  } catch (err) {
    console.error(err);

    if (!interaction.isRepliable()) return;

    const msg = `❌ Error: ${err.message || "Unknown error"}`;

    try {
      if (deferred || interaction.deferred) {
        await interaction.editReply(msg);
      } else if (interaction.replied) {
        await interaction.followUp({ content: msg, ephemeral: true });
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
    } catch {}
  }
});

/* ------------------------------- STARTUP ------------------------------- */

client.once("ready", () => {
  console.log("✅ Logged in as", client.user.tag);
  console.log("✅ Slash commands registered");
});

initDb()
  .then(() => registerCommands())
  .then(() => client.login(TOKEN))
  .catch((err) => {
    console.error("Startup error:", err);
    process.exit(1);
  });
