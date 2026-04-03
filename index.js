// index.js
// Discord Shop Bot (discord.js v14 + Postgres)
// - shop
// - Verification system
// - Stock control
// - Duplicate order protection
// - Mark as dispatched
// - Staff admin panel

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

// Bank details via env vars so you don't hardcode in GitHub
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

/* ----------------------------- SHOP CATALOG ----------------------------- */

const CATALOG = {
  "💉 FEATURED PENS/SPECIAL OFFERS​": [
    { sku: "A01", name: "APEX PHARMA 40mg Retatrutide", price_pence: 14000, stock_qty: 10  },
    { sku: "A02", name: "APEX Wolverine BPC/TB Pen 20/20", price_pence: 12000, stock_qty: 10 },
    { sku: "A03", name: "REMEDIUM Research Retatrutide 30mg (due in soon)", price_pence: 14000, stock_qty: 10 },
    { sku: "A04", name: "REVION Glow Pens 70mg", price_pence: 11000, stock_qty: 10 },
    { sku: "A05", name: "✨ SIGNATURE GLOW UP STACK (BEST SELLER)", price_pence: 16000, stock_qty: 10 },
    { sku: "A06", name: "🔥 ULTIMATE FAT LOSS STACK", price_pence: 17000, stock_qty: 10 },
    { sku: "A07", name: "🌸 SLIM & TONE STACK", price_pence: 15000, stock_qty: 10 },
    { sku: "A08", name: "⚡ LEAN MASS STACK", price_pence: 16000, stock_qty: 10 },
    { sku: "A09", name: "🔥 WAIST SNATCH STACK", price_pence: 11000, stock_qty: 10 },
    { sku: "A10", name: "🔥 SHRED & PERFORMANCE STACK", price_pence: 11000, stock_qty: 10 },
    { sku: "A11", name: "💎 FULL BODY RESET (PREMIUM)", price_pence: 10000, stock_qty: 10 },
    { sku: "A12", name: "💪 WOLVERINE RECOVERY STACK", price_pence: 7000, stock_qty: 10 },
    { sku: "A13", name: "✨ GLOW & RECOVERY STACK", price_pence: 7000, stock_qty: 10 },
    { sku: "A14", name: "🧬 GH MAX STACK", price_pence: 6000, stock_qty: 10  },
    { sku: "A15", name: "⚡ MITO ENERGY STACK", price_pence: 8500, stock_qty: 10 },
    { sku: "A16", name: "🌿 LEAN & CONFIDENT STACK", price_pence: 14000, stock_qty: 10 },
    { sku: "A17", name: "☀️ SUMMER READY STACK", price_pence: 5000, stock_qty: 10 },
    { sku: "A18", name: "💋 CONFIDENCE STACK", price_pence: 3500, stock_qty: 10 },
  ],
  "🧬 POPULAR PEPTIDES (Vials)": [
    { sku: "B01", name: "🧪 Retatrutide (50mg)", price_pence: 13000, stock_qty: 10 },
    { sku: "B02", name: "🧪 Retatrutide (10mg)​", price_pence: 5000, stock_qty: 10 },
    { sku: "B03", name: "🧪 Tirzepatide (40mg)​", price_pence: 9000, stock_qty: 10 },
    { sku: "B04", name: "🧪 MT2 (Tanning) (10mg)", price_pence: 2000, stock_qty: 10 },
  ],
  "💪 RECOVERY / HEALING": [
    { sku: "C01", name: "BPC-157 + TB-500 Blend (15mg/15mg)", price_pence: 6000, stock_qty: 10 },
    { sku: "C02", name: "Glow Blend (BPC-157 + TB-500 + GHK-CU) (70mg)", price_pence: 5500, stock_qty: 10 },
    { sku: "C03", name: "KLOW Combo (BPC-157 + TB-500 + GHK-CU + KPV) (80mg)", price_pence: 7000, stock_qty: 10 },
  ],
  "🧬 GH PEPTIDES": [
    { sku: "D01", name: "CJC-1295 (10mg)​", price_pence: 3000, stock_qty: 10 },
    { sku: "D02", name: "Ipamorelin (10mg)​", price_pence: 4000, stock_qty: 10 },
    { sku: "D03", name: "Stack Price", price_pence: 6500, stock_qty: 10 },
  ],
  "⚡PERFORMANCE / FAT LOSS": [
    { sku: "E01", name: "APEX PHARMA Reta Pen (40mg)", price_pence: 14000, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
    { sku: "E02", name: "REMEDIUM Tirz Pen (30mg)", price_pence: 11500, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
    { sku: "E03", name: "Retatrutide Vial (50mg)", price_pence: 13000, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
    { sku: "E04", name: "Retatrutide Vial (10mg)", price_pence: 5000, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
    { sku: "E05", name: "Tirzepatide Vial (40mg)", price_pence: 9000, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
    { sku: "E06", name: "AOD-9604 (10mg)", price_pence: 3500, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
    { sku: "E07", name: "5-Amino-1MQ (10mg)", price_pence: 3000, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
    { sku: "E08", name: "SLU-PP-332 (5mg)", price_pence: 3500, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
  ],
  "💤PAIN & SLEEP": [
    { sku: "F01", name: "Melatonin 5mg (100 tabs)", price_pence: 1500, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
    { sku: "F02", name: "Zopiclone 10mg (140 tabs)", price_pence: 4000, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
    { sku: "F03", name: "Diaz (10 tabs) (10mg)", price_pence: 1000, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
    { sku: "F04", name: "Diaz (30 tabs) (10mg)", price_pence: 2500, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
    { sku: "F05", name: "UK Pregabalin (150 caps) (300mg)", price_pence: 5000, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
    { sku: "F06", name: "UK Tramadol (100 tabs) (50mg)", price_pence: 6000, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
    { sku: "F07", name: "DHC Codeine UK Accord (100 tabs) (30mg)", price_pence: 6000, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
  ],
  "🧪 SPECIALIST": [
    { sku: "G01", name: "IGF-1 LR3 (1mg)", price_pence: 4500, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
    { sku: "G02", name: "Tesamorelin (20mg)", price_pence: 6500, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
    { sku: "G03", name: "MOTS-C (40mg)", price_pence: 5500, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
    { sku: "G04", name: "NAD+ (500mg)", price_pence: 4500, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
    { sku: "G05", name: "GHK-CU (50mg)", price_pence: 2500, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
    { sku: "G06", name: "KPV (10mg)", price_pence: 2500, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
    { sku: "G07", name: "PT-141 (10mg)", price_pence: 2000, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
  ],
  "💉 INJECTABLE OILS — CROWN PHARMA": [
    { sku: "H01", name: "Test (400mg) (coming soon)", price_pence: 3500, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
    { sku: "H02", name: "Test E (300mg)", price_pence: 3000, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
    { sku: "H03", name: "Test Cyp (250mg)", price_pence: 3000, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
    { sku: "H04", name: "Test Prop (120mg)", price_pence: 2500, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
    { sku: "H05", name: "Sustanon (300mg)", price_pence: 3000, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
    { sku: "H06", name: "Deca (330mg)", price_pence: 3500, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
    { sku: "H07", name: "NPP (150mg)", price_pence: 3500, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
    { sku: "H08", name: "RIP Blend 200 (Test Prop / Tren Ace / Mast Prop)", price_pence: 3500, stock_qty: 10, sizes: ["Standard"], colors: ["Default"] },
  ],
  "💊 SEXUAL HEALTH​": [
    { sku: "I01", name: "Kamagra Jelly (7 sachets)", price_pence: 1000, stock_qty: 10 },
    { sku: "I02", name: "Viagra (100 tabs)", price_pence: 3500, stock_qty: 10 },
    { sku: "I03", name: "Cialis (100 tabs) (coming soon)​", price_pence: 3500, stock_qty: 10 },
    { sku: "I04", name: "Cialis Individual Strip (10 tabs)", price_pence: 1000, stock_qty: 10 },
  ],
  "🛡 PCT & AI": [
    { sku: "J01", name: "HCG 5000IU", price_pence: 2500, stock_qty: 10 },
    { sku: "J02", name: "Clomid (100 tabs)", price_pence: 2500, stock_qty: 10 },
    { sku: "J03", name: "Tamoxifen (100 tabs)", price_pence: 2500, stock_qty: 10 },
    { sku: "J04", name: "Arimidex (10 tabs) (1mg)​", price_pence: 2000, stock_qty: 10 },
    { sku: "J05", name: "Telmisartan (150 tabs)​ (40mg)", price_pence: 2500, stock_qty: 10 },
  ],
  "📦 EXTRAS": [
    { sku: "K01", name: "Modafinil (100 tabs) (200mg)", price_pence: 4500, stock_qty: 10 },
    { sku: "K02", name: "Kenalog Hayfever Injection (10ml)", price_pence: 2500, stock_qty: 10 },
    { sku: "K03", name: "Bac Mixing Water (3ml)", price_pence: 500, stock_qty: 10 },
    { sku: "K04", name: "1ml Syringes (x20)", price_pence: 500, stock_qty: 10 },
    { sku: "K05", name: "Accutane (100 tabs) (20mg) (coming soon)", price_pence: 4500, stock_qty: 10 },
    { sku: "K06", name: "Vitamin B12 injections (10×1ml) (coming soon)", price_pence: 2000, stock_qty: 10 },
  ],
};

const categoryOptions = Object.keys(CATALOG).map((cat) => ({ label: cat, value: cat }));

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

  await pool.query(`ALTER TABLE IF EXISTS user_profiles ADD COLUMN IF NOT EXISTS email TEXT;`);
  await pool.query(`ALTER TABLE IF EXISTS user_profiles ADD COLUMN IF NOT EXISTS phone TEXT;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shipping_profiles (
      user_id TEXT PRIMARY KEY REFERENCES user_profiles(user_id) ON DELETE CASCADE,
      full_address TEXT,
      country TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`ALTER TABLE IF EXISTS shipping_profiles ADD COLUMN IF NOT EXISTS full_address TEXT;`);
  await pool.query(`ALTER TABLE IF EXISTS shipping_profiles ADD COLUMN IF NOT EXISTS country TEXT;`);

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

  await pool.query(`ALTER TABLE IF EXISTS carts ADD COLUMN IF NOT EXISTS discount_code TEXT;`);
  await pool.query(`ALTER TABLE IF EXISTS carts ADD COLUMN IF NOT EXISTS discount_percent INT NOT NULL DEFAULT 0;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id BIGSERIAL PRIMARY KEY,
      cart_id BIGINT NOT NULL REFERENCES carts(cart_id) ON DELETE CASCADE,
      sku TEXT NOT NULL,
      name TEXT NOT NULL,
      size TEXT NOT NULL,
      color TEXT NOT NULL,
      qty INT NOT NULL CHECK (qty > 0),
      price_pence INT NOT NULL CHECK (price_pence >= 0)
    );
  `);

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

  await pool.query(`ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS email TEXT;`);
  await pool.query(`ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS phone TEXT;`);
  await pool.query(`ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS full_address TEXT;`);
  await pool.query(`ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS country TEXT;`);
  await pool.query(`ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS shipping_pence INT;`);
  await pool.query(`ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS discount_code TEXT;`);
  await pool.query(`ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS discount_percent INT NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS discount_amount_pence INT NOT NULL DEFAULT 0;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
      sku TEXT NOT NULL,
      name TEXT NOT NULL,
      size TEXT NOT NULL,
      color TEXT NOT NULL,
      qty INT NOT NULL CHECK (qty > 0),
      price_pence INT NOT NULL CHECK (price_pence >= 0)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock_items (
      sku TEXT PRIMARY KEY,
      item_name TEXT NOT NULL,
      stock_qty INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

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

  await pool.query(`ALTER TABLE IF EXISTS discount_codes ADD COLUMN IF NOT EXISTS discount_percent INT NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE IF EXISTS discount_codes ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;`);
  await pool.query(`ALTER TABLE IF EXISTS discount_codes ADD COLUMN IF NOT EXISTS one_use_per_user BOOLEAN NOT NULL DEFAULT TRUE;`);
  await pool.query(`ALTER TABLE IF EXISTS discount_codes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`);
  await pool.query(`ALTER TABLE IF EXISTS discount_codes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`);

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
    INSERT INTO discount_codes (code, discount_percent, is_active, one_use_per_user, created_at, updated_at)
    VALUES ($1, $2, TRUE, TRUE, NOW(), NOW())
    ON CONFLICT (code) DO NOTHING
  `, [String(WELCOME_CODE || "").toUpperCase(), Number(WELCOME_DISCOUNT_PERCENT || 0)]);

  for (const category of Object.keys(CATALOG)) {
    for (const item of CATALOG[category]) {
      await pool.query(
        `
        INSERT INTO stock_items (sku, item_name, stock_qty, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (sku) DO NOTHING
        `,
        [item.sku, item.name, item.stock_qty]
      );
    }
  }
}

/* ------------------------------ HELPERS ------------------------------ */

function money(pence) {
  return `£${(pence / 100).toFixed(2)}`;
}

function isStaff(member) {
  return member?.roles?.cache?.has(STAFF_ROLE_ID);
}

function isStaffChannel(interaction) {
  return interaction.channelId === STAFF_ONLY_CHANNEL_ID;
}

function safeChannelName(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
}

function calculateDiscountedTotals(subtotal, shipping, discountPercent) {
  const safePercent = Math.max(0, Math.min(100, Number(discountPercent || 0)));
  const discountAmount = Math.round(subtotal * (safePercent / 100));
  const total = subtotal - discountAmount + shipping;

  return {
    discountPercent: safePercent,
    discountAmount,
    total,
  };
}

function normalizeDiscountCode(code) {
  return String(code || "").trim().toUpperCase();
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
    [normalized, isActive]
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

async function recordDiscountCodeUse(userId, code, orderId) {
  const normalized = normalizeDiscountCode(code);

  await pool.query(
    `
    INSERT INTO discount_code_uses (code, user_id, order_id, used_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (code, user_id) DO NOTHING
    `,
    [normalized, userId, orderId]
  );
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

async function getStockForSku(sku) {
  const res = await pool.query(`SELECT stock_qty FROM stock_items WHERE sku=$1`, [sku]);
  if (!res.rows.length) return 0;
  return Number(res.rows[0].stock_qty || 0);
}

async function getCartQtyForSku(userId, sku) {
  const res = await pool.query(
    `
    SELECT COALESCE(SUM(ci.qty), 0) AS qty
    FROM carts c
    JOIN cart_items ci ON ci.cart_id = c.cart_id
    WHERE c.user_id = $1 AND c.status='open' AND ci.sku = $2
    `,
    [userId, sku]
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
        updated_at = NOW();
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
        updated_at = NOW();
    `,
    [userId, shipping.full_address, shipping.country]
  );
}

async function getOrCreateCart(userId) {
  const existing = await pool.query(`SELECT cart_id FROM carts WHERE user_id=$1 AND status='open'`, [userId]);
  if (existing.rows.length) return existing.rows[0].cart_id;

  const created = await pool.query(
    `INSERT INTO carts (user_id, status, discount_code, discount_percent, updated_at)
     VALUES ($1, 'open', NULL, 0, NOW())
     RETURNING cart_id`,
    [userId]
  );
  return created.rows[0].cart_id;
}

async function addCartItem(userId, item) {
  const stockQty = await getStockForSku(item.sku);
  const existingCartQty = await getCartQtyForSku(userId, item.sku);

  if (existingCartQty + item.qty > stockQty) {
    throw new Error(`Only ${stockQty} in stock for ${item.name}.`);
  }

  const cartId = await getOrCreateCart(userId);
  await pool.query(
    `
    INSERT INTO cart_items (cart_id, sku, name, size, color, qty, price_pence)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [cartId, item.sku, item.name, item.size, item.color, item.qty, item.price_pence]
  );
}

async function clearCart(userId) {
  const cart = await pool.query(`SELECT cart_id FROM carts WHERE user_id=$1 AND status='open'`, [userId]);
  if (!cart.rows.length) return;

  const cartId = cart.rows[0].cart_id;
  await pool.query(`DELETE FROM cart_items WHERE cart_id=$1`, [cartId]);
  await pool.query(`DELETE FROM carts WHERE cart_id=$1`, [cartId]);
}

async function getCartSummary(userId) {
  const cart = await pool.query(`SELECT cart_id FROM carts WHERE user_id=$1 AND status='open'`, [userId]);
  if (!cart.rows.length) return { items: [], subtotal_pence: 0 };

  const cartId = cart.rows[0].cart_id;
  const itemsRes = await pool.query(
    `SELECT sku, name, size, color, qty, price_pence FROM cart_items WHERE cart_id=$1 ORDER BY id ASC`,
    [cartId]
  );

  const items = itemsRes.rows;
  const subtotal_pence = items.reduce((sum, it) => sum + it.qty * it.price_pence, 0);
  return { items, subtotal_pence };
}

async function getCartDiscount(userId) {
  const res = await pool.query(
    `SELECT discount_code, discount_percent FROM carts WHERE user_id=$1 AND status='open'`,
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
    SET discount_code=$1,
        discount_percent=$2,
        updated_at=NOW()
    WHERE cart_id=$3
    `,
    [normalizeDiscountCode(code), percent, cartId]
  );
}

async function clearCartDiscount(userId) {
  await pool.query(
    `
    UPDATE carts
    SET discount_code=NULL,
        discount_percent=0,
        updated_at=NOW()
    WHERE user_id=$1 AND status='open'
    `,
    [userId]
  );
}

async function hasUserPlacedOrderBefore(userId) {
  const res = await pool.query(`SELECT 1 FROM orders WHERE user_id=$1 LIMIT 1`, [userId]);
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
  const totals = calculateDiscountedTotals(
    cart.subtotal_pence,
    shippingPence,
    discount.discount_percent
  );

  const basketLines = [];
  for (const it of cart.items) {
    const stockQty = await getStockForSku(it.sku);
    basketLines.push(
      `• **${it.name}** (${it.size}, ${it.color}) × ${it.qty} — ${money(it.qty * it.price_pence)} _[Stock: ${stockQty}]_`
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

  const isUSA = c.includes("usa") || c === "us" || c.includes("united states") || c.includes("america");
  if (isUSA) return SHIPPING_USA_PENCE;

  return SHIPPING_EU_PENCE;
}

/* -------------------------- SLASH COMMAND SETUP -------------------------- */

const commands = [
  new SlashCommandBuilder()
    .setName("setupshop")
    .setDescription("Post/refresh the shop menu message in the menu channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("setupverify")
    .setDescription("Post/refresh the verification panel in the verify channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("setupstaffpanel")
    .setDescription("Post/refresh the staff control panel in the staff-only channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Health check"),
].map((c) => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
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

function categorySelectComponents() {
  console.log("CATEGORY OPTIONS COUNT:", Array.isArray(categoryOptions) ? categoryOptions.length : 0);

  const safeOptions = (categoryOptions || [])
    .filter((opt) => opt && opt.label && opt.value)
    .slice(0, 25)
    .map((opt) => ({
      ...opt,
      label: String(opt.label).slice(0, 100),
      value: String(opt.value).slice(0, 100),
      description: opt.description ? String(opt.description).slice(0, 100) : undefined,
    }));

  if (!safeOptions.length) {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("shop_close_session")
          .setLabel("Close Shop")
          .setStyle(ButtonStyle.Danger)
      ),
    ];
  }

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("select_category")
        .setPlaceholder("Choose a category…")
        .addOptions(safeOptions)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("shop_view_cart")
        .setLabel("View Basket")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("shop_close_session")
        .setLabel("Close Shop")
        .setStyle(ButtonStyle.Danger)
    ),
  ];
}

async function itemSelectComponents(category) {
  const items = (CATALOG[category] || []).slice(0, 25);

  console.log("CATEGORY:", category, "ITEM COUNT:", items.length);

  const options = [];

  for (const it of items) {
    const stockQty = await getStockForSku(it.sku);

    if (!it?.sku || !it?.name) continue;

    options.push({
      label: `${it.name} — ${money(it.price_pence)} — Stock ${stockQty}`.slice(0, 100),
      value: String(it.sku).slice(0, 100),
      description: (stockQty > 0 ? `Available: ${stockQty}` : "Out of stock").slice(0, 100),
    });
  }

  if (!options.length) {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("browse_categories")
          .setLabel("Back to Categories")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("shop_close_session")
          .setLabel("Close Shop")
          .setStyle(ButtonStyle.Danger)
      ),
    ];
  }

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`select_item:${String(category).slice(0, 80)}`)
        .setPlaceholder("Choose an item…")
        .addOptions(options)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("browse_categories")
        .setLabel("Back to Categories")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("shop_view_cart")
        .setLabel("View Basket")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("shop_close_session")
        .setLabel("Close Shop")
        .setStyle(ButtonStyle.Danger)
    ),
  ];
}

async function qtyButtonsComponents(category, sku) {
  const stockQty = await getStockForSku(sku);
  const maxQuickQty = Math.min(stockQty, 5);
  const quickButtons = [];

  for (let n = 1; n <= maxQuickQty; n += 1) {
    quickButtons.push(
      new ButtonBuilder()
        .setCustomId(`add_qty:${category}:${sku}:${n}`)
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
        .setCustomId(`add_qty_other:${category}:${sku}`)
        .setLabel("Other…")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(stockQty <= 0),
      new ButtonBuilder()
        .setCustomId(`back_to_items:${category}`)
        .setLabel("Back to Items")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("browse_categories")
        .setLabel("Back to Categories")
        .setStyle(ButtonStyle.Secondary)
    )
  );

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("shop_view_cart")
        .setLabel("View Basket")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("shop_close_session")
        .setLabel("Close Shop")
        .setStyle(ButtonStyle.Danger)
    )
  );

  return rows;
}

function cartActionsComponents(disableSubmit = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("browse_categories")
        .setLabel("Browse Categories")
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
        "Failure to complete the form correctly may affect whether you are verified."
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
        "• Adjust stock",
        "• Lookup an order",
        "• Create discount code",
        "• Toggle discount code active/inactive",
        "• Restock all items to default"
      ].join("\n")
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("staff_open_stock_modal")
      .setLabel("Adjust Stock")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("staff_open_orderlookup_modal")
      .setLabel("Lookup Order")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("staff_open_create_discount_modal")
      .setLabel("Create Discount Code")
      .setStyle(ButtonStyle.Success)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("staff_open_toggle_discount_modal")
      .setLabel("Toggle Discount Code")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("staff_restock_all_confirm")
      .setLabel("Restock All")
      .setStyle(ButtonStyle.Danger)
  );

  return { embed, rows: [row1, row2] };
}

function staffStockCategoryComponents() {
  const options = Object.keys(CATALOG)
    .slice(0, 25)
    .map((category) => ({
      label: String(category).slice(0, 100),
      value: String(category).slice(0, 100),
    }));

  if (!options.length) {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("staff_panel_back_noop")
          .setLabel("No categories available")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      ),
    ];
  }

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("staff_stock_select_category")
        .setPlaceholder("Choose a category…")
        .addOptions(options)
    ),
  ];
}

function staffStockItemComponents(category) {
  const items = (CATALOG[category] || []).slice(0, 25);

  if (!items.length) {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("staff_panel_back_noop")
          .setLabel("No items in this category")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      ),
    ];
  }

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`staff_stock_select_item:${String(category).slice(0, 80)}`)
        .setPlaceholder("Choose an item…")
        .addOptions(
          items
            .filter((item) => item && item.name && item.sku)
            .map((item) => ({
              label: String(item.name).slice(0, 100),
              description: `SKU: ${String(item.sku)}`.slice(0, 100),
              value: String(item.sku).slice(0, 100),
            }))
        )
    ),
  ];
}

function staffStockQtyModal(category, sku) {
  const item = (CATALOG[category] || []).find((x) => x.sku === sku);

  const modal = new ModalBuilder()
    .setCustomId(`staff_stock_qty_modal:${category}:${sku}`)
    .setTitle("Update Stock");

  const qtyInput = new TextInputBuilder()
    .setCustomId("stock_qty")
    .setLabel(`New stock for ${item?.name || sku}`.slice(0, 45))
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("Example: 25");

  modal.addComponents(
    new ActionRowBuilder().addComponents(qtyInput)
  );

  return modal;
}

/* -------------------------- MODALS (MAX 5 INPUTS) ------------------------- */

function shippingModal() {
  const modal = new ModalBuilder().setCustomId("shipping_modal").setTitle("Shipping details");

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

function qtyOtherModal(category, sku) {
  const modal = new ModalBuilder().setCustomId(`qty_other_modal:${category}:${sku}`).setTitle("Quantity");

  const qty = new TextInputBuilder()
    .setCustomId("qty")
    .setLabel("Enter quantity (number)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(qty));
  return modal;
}

function discountCodeModal() {
  const modal = new ModalBuilder().setCustomId("discount_code_modal").setTitle("Apply discount code");

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

/* ---------------------------- RECEIPT CHANNEL ---------------------------- */

async function createReceiptChannel(guild, user, orderId) {
  const category = await guild.channels.fetch(ORDERS_CATEGORY_ID);

  const name = safeChannelName(`order-${user.username}-${orderId}`);
  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: category?.id || null,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: ["ViewChannel"] },
      { id: user.id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] },
      { id: STAFF_ROLE_ID, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] },
      { id: guild.members.me.id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "ManageChannels"] },
    ],
  });

  return channel;
}

function bankDetailsText(orderId) {
  const ref = `ORDER-${orderId}`;
  const extras = [BANK_IBAN ? `IBAN: ${BANK_IBAN}` : null, BANK_SWIFT ? `SWIFT/BIC: ${BANK_SWIFT}` : null].filter(Boolean);

  return (
    `**Bank:** ${BANK_BANK_NAME}\n` +
    `**Account Name:** ${BANK_ACCOUNT_NAME}\n` +
    `**Sort Code:** ${BANK_SORT_CODE}\n` +
    `**Account Number:** ${BANK_ACCOUNT_NUMBER}\n` +
    (extras.length ? `${extras.join("\n")}\n` : "") +
    `\n**Reference:** \`${ref}\``
  );
}

function receiptEmbed(orderId, items, subtotal, discountAmount, discountCode, shipping, total, shippingProfile, status = "pending") {
  const lines = items.map(
    (it) => `• **${it.name}** (${it.size}, ${it.color}) × ${it.qty} — ${money(it.qty * it.price_pence)}`
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
    { name: "Dispatch", value: "Cut-off: **15:30 (Mon–Fri Dispatch)**" }
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

/* ------------------------------ INTERACTIONS ----------------------------- */

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.Channel],
});

const CART_UI_MESSAGES = new Map();
const SHOP_SESSION_CHANNELS = new Map();
const SHOP_SESSION_TIMEOUTS = new Map();
const SHOP_SESSION_TIMEOUT_MS = 5 * 60 * 1000;

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

function clearTrackedShopSessionChannel(userId) {
  SHOP_SESSION_CHANNELS.delete(userId);
}

function clearShopSessionTimeout(userId) {
  const timeout = SHOP_SESSION_TIMEOUTS.get(userId);
  if (timeout) {
    clearTimeout(timeout);
    SHOP_SESSION_TIMEOUTS.delete(userId);
  }
}

async function destroyShopSessionByChannel(channel, userId, reason = "Shop session closed") {
  clearShopSessionTimeout(userId);
  clearTrackedCartUiMessage(userId);
  clearTrackedShopSessionChannel(userId);

  await clearCart(userId).catch((err) => {
    console.error("Failed to clear cart during shop session cleanup:", err);
  });

  await clearCartDiscount(userId).catch((err) => {
    console.error("Failed to clear cart discount during shop session cleanup:", err);
  });

  if (channel) {
    try {
      await channel.delete(reason);
    } catch (err) {
      console.error("Failed to delete shop session channel:", err);
    }
  }
}

async function destroyShopSession(guild, userId, reason = "Shop session closed") {
  clearShopSessionTimeout(userId);

  const channel = await getTrackedShopSessionChannel(guild, userId).catch((err) => {
    console.error("Failed to fetch tracked shop session channel:", err);
    return null;
  });

  await destroyShopSessionByChannel(channel, userId, reason);
}

function resetShopSessionTimeout(guild, userId) {
  clearShopSessionTimeout(userId);

  const timeout = setTimeout(async () => {
    await destroyShopSession(guild, userId, "Shop session expired after inactivity");
  }, SHOP_SESSION_TIMEOUT_MS);

  SHOP_SESSION_TIMEOUTS.set(userId, timeout);
}

async function createOrGetShopSessionChannel(guild, user) {
  const existingTracked = await getTrackedShopSessionChannel(guild, user.id);
  if (existingTracked) {
    resetShopSessionTimeout(guild, user.id);
    return existingTracked;
  }

  const topicMarker = `shop-session:${user.id}`;
  const cachedExisting = guild.channels.cache.find(
    (ch) =>
      ch &&
      ch.type === ChannelType.GuildText &&
      ch.topic === topicMarker
  );

  if (cachedExisting) {
    trackShopSessionChannel(user.id, cachedExisting.id);
    resetShopSessionTimeout(guild, user.id);
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
      { id: guild.members.me.id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "ManageChannels"] },
    ],
  });

  trackShopSessionChannel(user.id, channel.id);
  resetShopSessionTimeout(guild, user.id);
  return channel;
}

async function sendOrEditCartUiMessage(interaction, payload, options = {}) {
  const { keepReply = false } = options;

  await interaction.deferReply({ flags: 64 });

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

  resetShopSessionTimeout(interaction.guild, interaction.user.id);

  if (keepReply) {
    return { message: msg, channel: targetChannel };
  }

  await interaction.deleteReply().catch(() => {});
  return { message: msg, channel: targetChannel };
}

async function showCategoriesInSession(interaction, content = "Choose a category:") {
  trackCartUiMessage(interaction.user.id, interaction.channel.id, interaction.message.id);
  resetShopSessionTimeout(interaction.guild, interaction.user.id);

  return interaction.update({
    content,
    components: categorySelectComponents(),
  });
}

async function showCartInSession(interaction, heading = "🛒 **Your basket**") {
  trackCartUiMessage(interaction.user.id, interaction.channel.id, interaction.message.id);
  resetShopSessionTimeout(interaction.guild, interaction.user.id);

  const cart = await getCartSummary(interaction.user.id);

  if (!cart.items.length) {
    return interaction.update({
      content:
        "🗑️ **Basket empty**\n\n" +
        "Your cart is empty.\n" +
        "Choose a category below to start:",
      components: categorySelectComponents(),
    });
  }

  const content = await buildCartMessage(interaction.user.id, heading);

  return interaction.update({
    content,
    components: cartActionsComponents(),
  });
}

client.on("interactionCreate", async (interaction) => {
  let deferred = false;

  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "ping") {
        return interaction.reply({ content: "pong ✅", flags: 64 });
      }

      if (interaction.commandName === "setupshop") {
        await interaction.deferReply({ flags: 64 });
        deferred = true;

        const menuChannel = await client.channels.fetch(MENU_CHANNEL_ID);

        const content =
          `**Welcome to ${STORE_NAME}!**\n\n` +
          `**How it works:**\n` +
          `1) Click the button below to get started\n` +
          `2) Enter your shipping details\n` +
          `3) Browse categories and move back and forth freely\n` +
          `4) Add multiple items to your basket\n` +
          `5) Apply ${WELCOME_CODE} on your first order for 10% off products only\n` +
          `6) Submit your order when you're done\n\n` +
          `**Shipping:** UK Tracked £10 • Europe £35 • USA £45\n` +
          `**Cut-off:** 15:30 (Mon–Fri Dispatch)\n\n` +
          `If a shopping session is abandoned, the temporary shop channel now auto closes after 5 minutes.`;

        await menuChannel.send({ content, components: menuMessageComponents() });

        return interaction.editReply("✅ Shop menu message posted/refreshed in the menu channel.");
      }

      if (interaction.commandName === "setupverify") {
        await interaction.deferReply({ flags: 64 });
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
        await interaction.deferReply({ flags: 64 });
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

      if (
        customId === "browse_categories" ||
        customId === "shop_view_cart" ||
        customId === "shop_close_session" ||
        customId === "cart_discount" ||
        customId === "cart_clear" ||
        customId === "cart_submit" ||
        customId === "cart_add_more" ||
        customId.startsWith("add_qty:") ||
        customId.startsWith("add_qty_other:") ||
        customId.startsWith("back_to_items:")
      ) {
        resetShopSessionTimeout(interaction.guild, interaction.user.id);
      }

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
          return interaction.reply({ content: "Staff only.", flags: 64 });
        }

        const guild = interaction.guild;
        const member = await guild.members.fetch(targetUserId).catch(() => null);

        if (!member) {
          return interaction.reply({
            content: "Could not find that user in the server.",
            flags: 64,
          });
        }

        const verifiedRole =
          guild.roles.cache.get(VERIFIED_ROLE_ID) ||
          (await guild.roles.fetch(VERIFIED_ROLE_ID).catch(() => null));

        if (!verifiedRole) {
          return interaction.reply({
            content: "Could not find the Verified role. Check VERIFIED_ROLE_ID.",
            flags: 64,
          });
        }

        if (member.roles.cache.has(VERIFIED_ROLE_ID)) {
          return interaction.reply({
            content: "That user is already verified.",
            flags: 64,
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

      if (customId === "staff_open_stock_modal") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", flags: 64 });
        }
        if (!isStaffChannel(interaction)) {
          return interaction.reply({ content: "Use this in the staff-only channel.", flags: 64 });
        }

        return interaction.reply({
          content: "Choose a category to update stock:",
          components: staffStockCategoryComponents(),
          flags: 64,
        });
      }

      if (customId === "staff_open_orderlookup_modal") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", flags: 64 });
        }
        if (!isStaffChannel(interaction)) {
          return interaction.reply({ content: "Use this in the staff-only channel.", flags: 64 });
        }
        return interaction.showModal(staffOrderLookupModal());
      }

      if (customId === "staff_open_create_discount_modal") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", flags: 64 });
        }
        if (!isStaffChannel(interaction)) {
          return interaction.reply({ content: "Use this in the staff-only channel.", flags: 64 });
        }

        return interaction.showModal(staffCreateDiscountModal());
      }

      if (customId === "staff_open_toggle_discount_modal") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", flags: 64 });
        }
        if (!isStaffChannel(interaction)) {
          return interaction.reply({ content: "Use this in the staff-only channel.", flags: 64 });
        }

        return interaction.showModal(staffToggleDiscountModal());
      }

      if (customId === "staff_restock_all_confirm") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", flags: 64 });
        }
        if (!isStaffChannel(interaction)) {
          return interaction.reply({ content: "Use this in the staff-only channel.", flags: 64 });
        }

        return interaction.reply({
          content: "Are you sure you want to restock all items back to default values?",
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("staff_restock_all_execute")
                .setLabel("Yes, restock all")
                .setStyle(ButtonStyle.Danger)
            ),
          ],
          flags: 64,
        });
      }

      if (customId === "staff_restock_all_execute") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", flags: 64 });
        }

        for (const category of Object.keys(CATALOG)) {
          for (const item of CATALOG[category]) {
            await pool.query(
              `UPDATE stock_items SET stock_qty=$1, item_name=$2, updated_at=NOW() WHERE sku=$3`,
              [item.stock_qty, item.name, item.sku]
            );
          }
        }

        return interaction.update({
          content: "✅ All stock reset to default values.",
          components: [],
        });
      }

      if (customId === "browse_categories" || customId === "cart_add_more") {
        return showCategoriesInSession(interaction, "Choose a category:");
      }

      if (customId === "shop_view_cart") {
        return showCartInSession(interaction);
      }

      if (customId === "shop_close_session") {
        await interaction.update({
          content: "🗑️ Closing your shop session...",
          components: [],
        });

        setTimeout(async () => {
          await destroyShopSessionByChannel(interaction.channel, interaction.user.id, "Shop session closed by user");
        }, 1500);

        return;
      }

      if (customId.startsWith("back_to_items:")) {
        trackCartUiMessage(interaction.user.id, interaction.channel.id, interaction.message.id);

        const [, category] = customId.split(":");
        const itemComponents = await itemSelectComponents(category);

        return interaction.update({
          content: `Category selected: **${category}**\nNow choose an item:`,
          components: itemComponents,
        });
      }

      if (customId.startsWith("add_qty:")) {
        trackCartUiMessage(interaction.user.id, interaction.channel.id, interaction.message.id);

        const [, category, sku, qtyStr] = customId.split(":");
        const qty = parseInt(qtyStr, 10);

        const item = (CATALOG[category] || []).find((x) => x.sku === sku);
        if (!item) {
          return interaction.update({
            content: "❌ Item not found.",
            components: categorySelectComponents(),
          });
        }

        const stockQty = await getStockForSku(item.sku);
        if (stockQty <= 0) {
          return interaction.update({
            content: "❌ That item is out of stock.",
            components: categorySelectComponents(),
          });
        }

        await addCartItem(interaction.user.id, {
          sku: item.sku,
          name: item.name,
          size: DEFAULT_SIZE,
          color: DEFAULT_COLOR,
          qty,
          price_pence: item.price_pence,
        });

        const content = await buildCartMessage(interaction.user.id);

        return interaction.update({
          content,
          components: cartActionsComponents(),
        });
      }

      if (customId.startsWith("add_qty_other:")) {
        trackCartUiMessage(interaction.user.id, interaction.channel.id, interaction.message.id);
        const [, category, sku] = customId.split(":");
        return interaction.showModal(qtyOtherModal(category, sku));
      }

      if (customId === "cart_discount") {
        trackCartUiMessage(interaction.user.id, interaction.channel.id, interaction.message.id);

        const cart = await getCartSummary(interaction.user.id);
        if (!cart.items.length) {
          return interaction.update({
            content:
              "🗑️ **Basket empty**\n\n" +
              "Your cart is empty.\n" +
              "Choose a category below to start:",
            components: categorySelectComponents(),
          });
        }

        return interaction.showModal(discountCodeModal());
      }

      if (customId === "cart_clear") {
        trackCartUiMessage(interaction.user.id, interaction.channel.id, interaction.message.id);

        await clearCart(interaction.user.id);
        await clearCartDiscount(interaction.user.id);

        await interaction.update({
          content: "🗑️ Your cart has been cleared. This shop channel will now close.",
          components: [],
        });

        setTimeout(async () => {
          await destroyShopSessionByChannel(interaction.channel, interaction.user.id, "Cart cleared and shop closed");
        }, 1500);

        return;
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
          const existingPendingOrder = await hasUserPendingOrder(interaction.user.id);
          if (existingPendingOrder) {
            return interaction.update({
              content: "You already have an order awaiting completion. Please contact staff if needed.",
              components: cartActionsComponents(),
            });
          }

          const cart = await getCartSummary(interaction.user.id);
          if (!cart.items.length) {
            return interaction.update({
              content:
                "🗑️ **Basket empty**\n\n" +
                "Your cart is empty.\n" +
                "Choose a category below to start:",
              components: categorySelectComponents(),
            });
          }

          const shippingProfile = await getUserShippingProfile(interaction.user.id);
          if (!shippingProfile) {
            return interaction.update({
              content: "I don't have your shipping details yet. Click the menu button again and enter your details.",
              components: [],
            });
          }

          for (const it of cart.items) {
            const stockQty = await getStockForSku(it.sku);
            if (it.qty > stockQty) {
              return interaction.update({
                content: `Stock changed. Only ${stockQty} left for ${it.name}. Please update your basket and try again.`,
                components: cartActionsComponents(),
              });
            }
          }

          const subtotal = cart.subtotal_pence;
          const shipping = getShippingPenceForCountry(shippingProfile.country);

          let discount = await getCartDiscount(interaction.user.id);

          if (discount.discount_code) {
            const validation = await validateDiscountCodeForUser(interaction.user.id, discount.discount_code);

            if (!validation.valid) {
              await clearCartDiscount(interaction.user.id);
              return interaction.update({
                content: `${validation.reason} The code has been removed from this basket.`,
                components: cartActionsComponents(),
              });
            }

            if (Number(discount.discount_percent || 0) !== Number(validation.discount_percent || 0)) {
              await setCartDiscount(interaction.user.id, validation.code, validation.discount_percent);
              discount = await getCartDiscount(interaction.user.id);
            }
          }

          const totals = calculateDiscountedTotals(subtotal, shipping, discount.discount_percent);
          const total = totals.total;

          const orderRes = await pool.query(
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
              interaction.user.id,
              shippingProfile.full_name,
              shippingProfile.email,
              shippingProfile.phone,
              shippingProfile.full_address,
              shippingProfile.country,
              subtotal,
              shipping,
              total,
              discount.discount_code,
              discount.discount_percent,
              totals.discountAmount,
            ]
          );

          const orderId = orderRes.rows[0].order_id;

          for (const it of cart.items) {
            await pool.query(
              `
              INSERT INTO order_items (order_id, sku, name, size, color, qty, price_pence)
              VALUES ($1,$2,$3,$4,$5,$6,$7)
              `,
              [orderId, it.sku, it.name, it.size, it.color, it.qty, it.price_pence]
            );

            await pool.query(
              `
              UPDATE stock_items
              SET stock_qty = stock_qty - $1,
                  updated_at = NOW()
              WHERE sku = $2 AND stock_qty >= $1
              `,
              [it.qty, it.sku]
            );
          }

          if (discount.discount_code) {
            await recordDiscountCodeUse(interaction.user.id, discount.discount_code, orderId);
          }

          const guild = interaction.guild;
          const receiptChannel = await createReceiptChannel(guild, interaction.user, orderId);

          await pool.query(`UPDATE orders SET receipt_channel_id=$1 WHERE order_id=$2`, [receiptChannel.id, orderId]);

          await receiptChannel.send({
            content:
              `<@${interaction.user.id}> **Thanks!** Your order has been received.\n\n` +
              `✅ Please pay by **bank transfer** using the details in the receipt below.\n` +
              `<@&${STAFF_ROLE_ID}> once confirmed, please mark as paid or dispatched when appropriate.`,
            embeds: [
              receiptEmbed(
                orderId,
                cart.items,
                subtotal,
                totals.discountAmount,
                discount.discount_code,
                shipping,
                total,
                shippingProfile,
                "pending"
              ),
            ],
            components: staffReceiptControls(orderId, "pending"),
          });

          await interaction.update({
            content: `✅ Order submitted successfully.\nYour receipt channel is ready: <#${receiptChannel.id}>`,
            components: [],
          });

          clearShopSessionTimeout(interaction.user.id);
          clearTrackedCartUiMessage(interaction.user.id);
          clearTrackedShopSessionChannel(interaction.user.id);

          setTimeout(async () => {
            try {
              await interaction.channel.delete("Shop session completed");
            } catch (err) {
              console.error("Failed to delete completed shop session channel:", err);
            }
          }, 2000);

          return;
        } finally {
          clearSubmitLock(interaction.user.id);
        }
      }

      if (customId.startsWith("staff_mark_paid:")) {
        const [, orderIdStr] = customId.split(":");
        const orderId = parseInt(orderIdStr, 10);

        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", flags: 64 });
        }

        await pool.query(`UPDATE orders SET status='paid' WHERE order_id=$1`, [orderId]);

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
          return interaction.reply({ content: "Staff only.", flags: 64 });
        }

        await pool.query(`UPDATE orders SET status='dispatched' WHERE order_id=$1`, [orderId]);

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
          return interaction.reply({ content: "Staff only.", flags: 64 });
        }

        const orderRes = await pool.query(
          `SELECT status, user_id FROM orders WHERE order_id=$1`,
          [orderId]
        );

        if (!orderRes.rows.length) {
          return interaction.reply({
            content: "Order not found.",
            flags: 64,
          });
        }

        const currentStatus = orderRes.rows[0].status;
        const customerUserId = orderRes.rows[0].user_id;

        if (currentStatus === "cancelled") {
          return interaction.reply({
            content: "This order is already cancelled.",
            flags: 64,
          });
        }

        if (currentStatus === "dispatched" || currentStatus === "completed") {
          return interaction.reply({
            content: "Dispatched or completed orders cannot be cancelled.",
            flags: 64,
          });
        }

        const itemsRes = await pool.query(
          `SELECT sku, qty FROM order_items WHERE order_id=$1`,
          [orderId]
        );

        for (const item of itemsRes.rows) {
          await pool.query(
            `
            UPDATE stock_items
            SET stock_qty = stock_qty + $1,
                updated_at = NOW()
            WHERE sku = $2
            `,
            [item.qty, item.sku]
          );
        }

        await pool.query(
          `UPDATE orders SET status='cancelled' WHERE order_id=$1`,
          [orderId]
        );

        await interaction.update({
          content: `❌ Order #${orderId} has been cancelled.`,
          embeds: interaction.message.embeds,
          components: staffReceiptControls(orderId, "cancelled"),
        });

        await interaction.channel.send(
          `❌ Order #${orderId} has been cancelled. Stock has been restored.`
        );

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
          return interaction.reply({ content: "Staff only.", flags: 64 });
        }

        const orderRes = await pool.query(
          `SELECT status FROM orders WHERE order_id=$1`,
          [orderId]
        );

        if (!orderRes.rows.length) {
          return interaction.reply({
            content: "Order not found.",
            flags: 64,
          });
        }

        const currentStatus = orderRes.rows[0].status;

        if (currentStatus === "cancelled") {
          return interaction.reply({
            content: "Cancelled orders cannot be completed.",
            flags: 64,
          });
        }

        if (currentStatus === "completed") {
          return interaction.reply({
            content: "This order is already completed.",
            flags: 64,
          });
        }

        if (currentStatus !== "dispatched") {
          return interaction.reply({
            content: "Order must be marked as dispatched before it can be completed.",
            flags: 64,
          });
        }

        await pool.query(
          `UPDATE orders SET status='completed' WHERE order_id=$1`,
          [orderId]
        );

        await interaction.update({
          content: `✅ Order #${orderId} marked as completed. Closing this channel in 5 seconds...`,
          embeds: interaction.message.embeds,
          components: staffReceiptControls(orderId, "completed"),
        });

        await interaction.channel.send(
          `✅ Order #${orderId} is complete. This channel will now close.`
        );

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
      const { customId } = interaction;

      if (
        customId === "select_category" ||
        customId.startsWith("select_item:")
      ) {
        resetShopSessionTimeout(interaction.guild, interaction.user.id);
      }

      if (customId === "staff_stock_select_category") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", flags: 64 });
        }
        if (!isStaffChannel(interaction)) {
          return interaction.reply({ content: "Use this in the staff-only channel.", flags: 64 });
        }

        const category = interaction.values[0];

        return interaction.update({
          content: `Category selected: **${category}**\nNow choose an item:`,
          components: staffStockItemComponents(category),
        });
      }

      if (customId.startsWith("staff_stock_select_item:")) {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", flags: 64 });
        }
        if (!isStaffChannel(interaction)) {
          return interaction.reply({ content: "Use this in the staff-only channel.", flags: 64 });
        }

        const [, category] = customId.split(":");
        const sku = interaction.values[0];

        return interaction.showModal(staffStockQtyModal(category, sku));
      }

      if (customId === "select_category") {
        trackCartUiMessage(interaction.user.id, interaction.channel.id, interaction.message.id);

        const category = interaction.values[0];
        const itemComponents = await itemSelectComponents(category);

        return interaction.update({
          content: `Category selected: **${category}**\nNow choose an item:`,
          components: itemComponents,
        });
      }

      if (customId.startsWith("select_item:")) {
        trackCartUiMessage(interaction.user.id, interaction.channel.id, interaction.message.id);

        const [, category] = customId.split(":");
        const sku = interaction.values[0];

        const stockQty = await getStockForSku(sku);
        if (stockQty <= 0) {
          return interaction.update({
            content: "That item is out of stock.",
            components: await itemSelectComponents(category),
          });
        }

        const qtyComponents = await qtyButtonsComponents(category, sku);

        return interaction.update({
          content: `Selected item — how many? (In stock: ${stockQty})`,
          components: qtyComponents,
        });
      }
    }

    if (interaction.isModalSubmit()) {
      const { customId } = interaction;

      if (
        customId === "shipping_modal" ||
        customId === "discount_code_modal" ||
        customId.startsWith("qty_other_modal:")
      ) {
        resetShopSessionTimeout(interaction.guild, interaction.user.id);
      }

      if (customId === "shipping_modal") {
        const full_name = interaction.fields.getTextInputValue("full_name")?.trim();
        const email = interaction.fields.getTextInputValue("email")?.trim();
        const phone = interaction.fields.getTextInputValue("phone")?.trim();
        const full_address = interaction.fields.getTextInputValue("full_address")?.trim();
        const country = interaction.fields.getTextInputValue("country")?.trim();

        if (!full_name || !email || !phone || !full_address || !country) {
          return interaction.reply({ content: "All fields are required.", flags: 64 });
        }

        await upsertProfile(interaction.user.id, full_name, email, phone, { full_address, country });

        const payload = {
          content: "✅ Details saved. Choose a category:",
          components: categorySelectComponents(),
        };

        const { channel } = await sendOrEditCartUiMessage(interaction, payload, { keepReply: true });

        const continueOrderRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("Continue Order")
            .setStyle(ButtonStyle.Link)
            .setURL(`https://discord.com/channels/${interaction.guild.id}/${channel.id}`)
        );

        await interaction.editReply({
          content: `✅ Details saved. Your shop channel is ready.\nIt will auto close after 5 minutes of inactivity.`,
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
            flags: 64,
          });
        }

        const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (!emailLooksValid) {
          return interaction.reply({
            content: "Please enter a valid email address.",
            flags: 64,
          });
        }

        const phoneClean = phone.replace(/[^\d+]/g, "");
        if (phoneClean.length < 7) {
          return interaction.reply({
            content: "Please enter a valid phone number.",
            flags: 64,
          });
        }

        const logChannel = await interaction.guild.channels.fetch(VERIFICATION_LOG_CHANNEL_ID).catch(() => null);
        if (!logChannel) {
          return interaction.reply({
            content: "Could not find the verification log channel. Check VERIFICATION_LOG_CHANNEL_ID.",
            flags: 64,
          });
        }

        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (member?.roles?.cache?.has(VERIFIED_ROLE_ID)) {
          return interaction.reply({
            content: "You are already verified.",
            flags: 64,
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
          flags: 64,
        });
      }

      if (customId.startsWith("staff_stock_qty_modal:")) {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", flags: 64 });
        }
        if (!isStaffChannel(interaction)) {
          return interaction.reply({ content: "Use this in the staff-only channel.", flags: 64 });
        }

        const [, category, sku] = customId.split(":");
        const qtyRaw = interaction.fields.getTextInputValue("stock_qty")?.trim();
        const qty = parseInt(qtyRaw, 10);

        if (!Number.isFinite(qty) || qty < 0) {
          return interaction.reply({
            content: "Enter a valid stock quantity of 0 or more.",
            flags: 64,
          });
        }

        const item = (CATALOG[category] || []).find((x) => x.sku === sku);
        if (!item) {
          return interaction.reply({
            content: "Item not found.",
            flags: 64,
          });
        }

        await pool.query(
          `UPDATE stock_items SET stock_qty=$1, updated_at=NOW() WHERE sku=$2`,
          [qty, sku]
        );

        return interaction.reply({
          content: `✅ Stock updated for **${item.name}** (${sku}) → ${qty}`,
          flags: 64,
        });
      }

      if (customId === "staff_orderlookup_modal") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", flags: 64 });
        }
        if (!isStaffChannel(interaction)) {
          return interaction.reply({ content: "Use this in the staff-only channel.", flags: 64 });
        }

        const orderIdRaw = interaction.fields.getTextInputValue("lookup_order_id")?.trim();
        const orderId = parseInt(orderIdRaw, 10);

        if (!Number.isFinite(orderId) || orderId <= 0) {
          return interaction.reply({
            content: "Enter a valid order ID.",
            flags: 64,
          });
        }

        const orderRes = await pool.query(`SELECT * FROM orders WHERE order_id=$1`, [orderId]);
        if (!orderRes.rows.length) {
          return interaction.reply({
            content: "Order not found.",
            flags: 64,
          });
        }

        const order = orderRes.rows[0];

        const itemsRes = await pool.query(
          `SELECT name, qty, price_pence FROM order_items WHERE order_id=$1 ORDER BY id ASC`,
          [orderId]
        );

        const itemLines = itemsRes.rows.map(
          (it) => `• ${it.name} × ${it.qty} — ${money(it.qty * it.price_pence)}`
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
          flags: 64,
        });
      }

      if (customId === "staff_create_discount_modal") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", flags: 64 });
        }
        if (!isStaffChannel(interaction)) {
          return interaction.reply({ content: "Use this in the staff-only channel.", flags: 64 });
        }

        const codeRaw = interaction.fields.getTextInputValue("discount_code")?.trim();
        const percentRaw = interaction.fields.getTextInputValue("discount_percent")?.trim();

        const code = normalizeDiscountCode(codeRaw);
        const percent = parseInt(percentRaw, 10);

        if (!code) {
          return interaction.reply({ content: "Enter a valid code.", flags: 64 });
        }

        if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
          return interaction.reply({ content: "Enter a valid percent from 0 to 100.", flags: 64 });
        }

        await createDiscountCodeRecord(code, percent);

        return interaction.reply({
          content: `✅ Discount code **${code}** created/updated at ${percent}% and set active.`,
          flags: 64,
        });
      }

      if (customId === "staff_toggle_discount_modal") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", flags: 64 });
        }
        if (!isStaffChannel(interaction)) {
          return interaction.reply({ content: "Use this in the staff-only channel.", flags: 64 });
        }

        const codeRaw = interaction.fields.getTextInputValue("discount_code")?.trim();
        const stateRaw = interaction.fields.getTextInputValue("discount_active")?.trim().toLowerCase();

        const code = normalizeDiscountCode(codeRaw);

        if (!code) {
          return interaction.reply({ content: "Enter a valid code.", flags: 64 });
        }

        let active;
        if (stateRaw === "active") active = true;
        else if (stateRaw === "inactive") active = false;
        else {
          return interaction.reply({
            content: "Type either active or inactive.",
            flags: 64,
          });
        }

        const updated = await setDiscountCodeActiveState(code, active);
        if (!updated) {
          return interaction.reply({
            content: "That discount code was not found.",
            flags: 64,
          });
        }

        return interaction.reply({
          content: `✅ Discount code **${updated.code}** is now **${updated.is_active ? "active" : "inactive"}**.`,
          flags: 64,
        });
      }

      if (customId.startsWith("qty_other_modal:")) {
        const [, category, sku] = customId.split(":");
        const qtyRaw = interaction.fields.getTextInputValue("qty");
        const qty = parseInt(qtyRaw, 10);

        if (!Number.isFinite(qty) || qty <= 0) {
          return interaction.reply({ content: "Please enter a valid quantity (number > 0).", flags: 64 });
        }

        const item = (CATALOG[category] || []).find((x) => x.sku === sku);
        if (!item) return interaction.reply({ content: "Item not found.", flags: 64 });

        const stockQty = await getStockForSku(item.sku);
        if (qty > stockQty) {
          return interaction.reply({
            content: `Only ${stockQty} in stock for ${item.name}.`,
            flags: 64,
          });
        }

        await addCartItem(interaction.user.id, {
          sku: item.sku,
          name: item.name,
          size: DEFAULT_SIZE,
          color: DEFAULT_COLOR,
          qty,
          price_pence: item.price_pence,
        });

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
          return interaction.reply({ content: "Please enter a code.", flags: 64 });
        }

        const cart = await getCartSummary(interaction.user.id);
        if (!cart.items.length) {
          return interaction.reply({ content: "Your cart is empty.", flags: 64 });
        }

        const existingDiscount = await getCartDiscount(interaction.user.id);
        if (existingDiscount.discount_code) {
          return interaction.reply({
            content: `A code has already been applied to this order: ${existingDiscount.discount_code}`,
            flags: 64,
          });
        }

        const validation = await validateDiscountCodeForUser(interaction.user.id, enteredCode);
        if (!validation.valid) {
          return interaction.reply({
            content: validation.reason,
            flags: 64,
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

    try {
      const msg = `❌ Error: ${err.message || "Unknown error"}`;
      if (deferred || interaction.deferred) {
        await interaction.editReply(msg);
      } else if (interaction.replied) {
        await interaction.followUp({ content: msg, flags: 64 });
      } else {
        await interaction.reply({ content: msg, flags: 64 });
      }
    } catch {}
  }
});

/* ------------------------------- STARTUP ------------------------------- */

client.once("clientReady", () => {
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
