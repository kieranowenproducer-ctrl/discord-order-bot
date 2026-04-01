// index.js
// Discord Shop Bot (discord.js v14 + Postgres)
// - No cart_json usage
// - Modal limited to 5 inputs
// - Creates private receipt channels for each order
// - Bank transfer details shown in receipt channel
// - Discount code support added
// - Welcome discount: WELCOME10 = 10% off products only, first order only

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
const ORDERS_CHANNEL_ID = process.env.ORDERS_CHANNEL_ID; // optional (not required)
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;

// Bank details via env vars so you don't hardcode in GitHub
const BANK_ACCOUNT_NAME = process.env.BANK_ACCOUNT_NAME || "YOUR COMPANY LTD";
const BANK_SORT_CODE = process.env.BANK_SORT_CODE || "00-00-00";
const BANK_ACCOUNT_NUMBER = process.env.BANK_ACCOUNT_NUMBER || "00000000";
const BANK_BANK_NAME = process.env.BANK_BANK_NAME || "YOUR BANK";
const BANK_IBAN = process.env.BANK_IBAN || "";
const BANK_SWIFT = process.env.BANK_SWIFT || "";

const STORE_NAME = "Bodymarket Labs";

// Since we removed size/colour selection, we keep these fixed to avoid changing DB schema/logic.
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

/* ----------------------------- DATABASE SETUP ---------------------------- */

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

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
    [code, percent, cartId]
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
  const res = await pool.query(
    `SELECT 1 FROM orders WHERE user_id=$1 LIMIT 1`,
    [userId]
  );
  return res.rows.length > 0;
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

function money(pence) {
  return `£${(pence / 100).toFixed(2)}`;
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

  const basketLines = cart.items.map(
    (it) => `• **${it.name}** (${it.size}, ${it.color}) × ${it.qty} — ${money(it.qty * it.price_pence)}`
  );

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

  const europeKeywords = ["europe", "eu", "european"];
  if (europeKeywords.some((k) => c.includes(k))) return SHIPPING_EU_PENCE;

  const europeCountries = new Set([
    "albania","andorra","austria","belarus","belgium","bosnia","bulgaria","croatia","cyprus","czech republic","czechia",
    "denmark","estonia","finland","france","germany","greece","hungary","iceland","ireland","italy","kosovo","latvia","liechtenstein",
    "lithuania","luxembourg","malta","moldova","monaco","montenegro","netherlands","north macedonia","norway","poland","portugal",
    "romania","san marino","serbia","slovakia","slovenia","spain","sweden","switzerland","turkey","ukraine","vatican","vatican city",
    "russia"
  ]);

  for (const name of europeCountries) {
    if (c === name || c.includes(name)) return SHIPPING_EU_PENCE;
  }

  return SHIPPING_EU_PENCE;
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

/* ----------------------------- SHOP CATALOG ----------------------------- */

const CATALOG = {
  "💉 FEATURED PENS/SPECIAL OFFERS​": [
    { sku: "A01", name: "APEX PHARMA 40mg Retatrutide", price_pence: 14000 },
    { sku: "A02", name: "APEX Wolverine BPC/TB Pen 20/20", price_pence: 12000 },
    { sku: "A03", name: "REMEDIUM Research Retatrutide 30mg (due in soon)", price_pence: 14000 },
    { sku: "A04", name: "REVION Glow Pens 70mg", price_pence: 11000 },
    { sku: "A05", name: "✨ SIGNATURE GLOW UP STACK (BEST SELLER)", price_pence: 16000 },
    { sku: "A06", name: "🔥 ULTIMATE FAT LOSS STACK", price_pence: 17000 },
    { sku: "A07", name: "🌸 SLIM & TONE STACK", price_pence: 15000 },
    { sku: "A08", name: "⚡ LEAN MASS STACK", price_pence: 16000 },
    { sku: "A09", name: "🔥 WAIST SNATCH STACK", price_pence: 11000 },
    { sku: "A10", name: "🔥 SHRED & PERFORMANCE STACK", price_pence: 11000 },
    { sku: "A11", name: "💎 FULL BODY RESET (PREMIUM)", price_pence: 10000 },
    { sku: "A12", name: "💪 WOLVERINE RECOVERY STACK", price_pence: 7000 },
    { sku: "A13", name: "✨ GLOW & RECOVERY STACK", price_pence: 7000 },
    { sku: "A14", name: "🧬 GH MAX STACK", price_pence: 6000 },
    { sku: "A15", name: "⚡ MITO ENERGY STACK", price_pence: 8500 },
    { sku: "A16", name: "🌿 LEAN & CONFIDENT STACK", price_pence: 14000 },
    { sku: "A17", name: "☀️ SUMMER READY STACK", price_pence: 5000 },
    { sku: "A18", name: "💋 CONFIDENCE STACK", price_pence: 3500 },
  ],
  "🧬 POPULAR PEPTIDES (Vials)": [
    { sku: "B01", name: "🧪 Retatrutide (50mg)", price_pence: 13000 },
    { sku: "B02", name: "🧪 Retatrutide (10mg)​", price_pence: 5000 },
    { sku: "B03", name: "🧪 Tirzepatide (40mg)​", price_pence: 9000 },
    { sku: "B04", name: "🧪 MT2 (Tanning) (10mg)", price_pence: 2000 },
  ],
  "💪 RECOVERY / HEALING": [
    { sku: "C01", name: "BPC-157 + TB-500 Blend (15mg/15mg)", price_pence: 6000 },
    { sku: "C02", name: "Glow Blend (BPC-157 + TB-500 + GHK-CU) (70mg)", price_pence: 5500 },
    { sku: "C03", name: "KLOW Combo (BPC-157 + TB-500 + GHK-CU + KPV) (80mg)", price_pence: 7000 },
  ],
  "🧬 GH PEPTIDES": [
    { sku: "D01", name: "CJC-1295 (10mg)​", price_pence: 3000 },
    { sku: "D02", name: "Ipamorelin (10mg)​", price_pence: 4000 },
    { sku: "D03", name: "Stack Price", price_pence: 6500 },
  ],
  "⚡PERFORMANCE / FAT LOSS": [
    { sku: "E01", name: "APEX PHARMA Reta Pen (40mg)", price_pence: 14000, sizes: ["Standard"], colors: ["Default"] },
    { sku: "E02", name: "REMEDIUM Tirz Pen (30mg)", price_pence: 11500, sizes: ["Standard"], colors: ["Default"] },
    { sku: "E03", name: "Retatrutide Vial (50mg)", price_pence: 13000, sizes: ["Standard"], colors: ["Default"] },
    { sku: "E04", name: "Retatrutide Vial (10mg)", price_pence: 5000, sizes: ["Standard"], colors: ["Default"] },
    { sku: "E05", name: "Tirzepatide Vial (40mg)", price_pence: 9000, sizes: ["Standard"], colors: ["Default"] },
    { sku: "E06", name: "AOD-9604 (10mg)", price_pence: 3500, sizes: ["Standard"], colors: ["Default"] },
    { sku: "E07", name: "5-Amino-1MQ (10mg)", price_pence: 3000, sizes: ["Standard"], colors: ["Default"] },
    { sku: "E08", name: "SLU-PP-332 (5mg)", price_pence: 3500, sizes: ["Standard"], colors: ["Default"] },
  ],
  "💤 PAIN & SLEEP": [
    { sku: "F01", name: "Melatonin 5mg (100 tabs)", price_pence: 1500, sizes: ["Standard"], colors: ["Default"] },
    { sku: "F02", name: "Zopiclone 10mg (140 tabs)", price_pence: 4000, sizes: ["Standard"], colors: ["Default"] },
    { sku: "F03", name: "Diaz (10 tabs) (10mg)", price_pence: 1000, sizes: ["Standard"], colors: ["Default"] },
    { sku: "F04", name: "Diaz (30 tabs) (10mg)", price_pence: 2500, sizes: ["Standard"], colors: ["Default"] },
    { sku: "F05", name: "UK Pregabalin (150 caps) (300mg)", price_pence: 5000, sizes: ["Standard"], colors: ["Default"] },
    { sku: "F06", name: "UK Tramadol (100 tabs) (50mg)", price_pence: 6000, sizes: ["Standard"], colors: ["Default"] },
    { sku: "F07", name: "DHC Codeine UK Accord (100 tabs) (30mg)", price_pence: 6000, sizes: ["Standard"], colors: ["Default"] },
  ],
  "🧪 SPECIALIST": [
    { sku: "G01", name: "IGF-1 LR3 (1mg)", price_pence: 4500, sizes: ["Standard"], colors: ["Default"] },
    { sku: "G02", name: "Tesamorelin (20mg)", price_pence: 6500, sizes: ["Standard"], colors: ["Default"] },
    { sku: "G03", name: "MOTS-C (40mg)", price_pence: 5500, sizes: ["Standard"], colors: ["Default"] },
    { sku: "G04", name: "NAD+ (500mg)", price_pence: 4500, sizes: ["Standard"], colors: ["Default"] },
    { sku: "G05", name: "GHK-CU (50mg)", price_pence: 2500, sizes: ["Standard"], colors: ["Default"] },
    { sku: "G06", name: "KPV (10mg)", price_pence: 2500, sizes: ["Standard"], colors: ["Default"] },
    { sku: "G07", name: "PT-141 (10mg)", price_pence: 2000, sizes: ["Standard"], colors: ["Default"] },
  ],
  "💉 INJECTABLE OILS — CROWN PHARMA": [
    { sku: "H01", name: "Test (400mg) (coming soon)", price_pence: 3500, sizes: ["Standard"], colors: ["Default"] },
    { sku: "H02", name: "Test E (300mg)", price_pence: 3000, sizes: ["Standard"], colors: ["Default"] },
    { sku: "H03", name: "Test Cyp (250mg)", price_pence: 3000, sizes: ["Standard"], colors: ["Default"] },
    { sku: "H04", name: "Test Prop (120mg)", price_pence: 2500, sizes: ["Standard"], colors: ["Default"] },
    { sku: "H05", name: "Sustanon (300mg)", price_pence: 3000, sizes: ["Standard"], colors: ["Default"] },
    { sku: "H06", name: "Deca (330mg)", price_pence: 3500, sizes: ["Standard"], colors: ["Default"] },
    { sku: "H07", name: "NPP (150mg)", price_pence: 3500, sizes: ["Standard"], colors: ["Default"] },
    { sku: "H08", name: "RIP Blend 200 (Test Prop / Tren Ace / Mast Prop)", price_pence: 3500, sizes: ["Standard"], colors: ["Default"] },
  ],
  "💊 SEXUAL HEALTH​": [
    { sku: "I01", name: "Kamagra Jelly (7 sachets)", price_pence: 1000 },
    { sku: "I02", name: "Viagra (100 tabs)", price_pence: 3500 },
    { sku: "I03", name: "Cialis (100 tabs) (coming soon)​", price_pence: 3500 },
    { sku: "I04", name: "Cialis Individual Strip (10 tabs)", price_pence: 1000 },
  ],
  "🛡 PCT & AI": [
    { sku: "J01", name: "HCG 5000IU", price_pence: 2500 },
    { sku: "J02", name: "Clomid (100 tabs)", price_pence: 2500 },
    { sku: "J03", name: "Tamoxifen (100 tabs)", price_pence: 2500 },
    { sku: "J04", name: "Arimidex (10 tabs) (1mg)​", price_pence: 2000 },
    { sku: "J05", name: "Telmisartan (150 tabs)​ (40mg)", price_pence: 2500 },
  ],
  "📦 EXTRAS": [
    { sku: "K01", name: "Modafinil (100 tabs) (200mg)", price_pence: 4500 },
    { sku: "K02", name: "Kenalog Hayfever Injection (10ml)", price_pence: 2500 },
    { sku: "K03", name: "Bac Mixing Water (3ml)", price_pence: 500 },
    { sku: "K04", name: "1ml Syringes (x20)", price_pence: 500 },
    { sku: "K05", name: "Accutane (100 tabs) (20mg) (coming soon)", price_pence: 4500 },
    { sku: "K06", name: "Vitamin B12 injections (10×1ml) (coming soon)", price_pence: 2000 },
  ],
};

const categoryOptions = Object.keys(CATALOG).map((cat) => ({ label: cat, value: cat }));

/* ---------------------------- DISCORD CLIENT ---------------------------- */

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel],
});

function isStaff(member) {
  return member?.roles?.cache?.has(STAFF_ROLE_ID);
}

function safeChannelName(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
}

/* -------------------------- SLASH COMMAND SETUP -------------------------- */

const commands = [
  new SlashCommandBuilder()
    .setName("setupshop")
    .setDescription("Post/refresh the shop menu message in the menu channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName("ping").setDescription("Health check"),
].map((c) => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
}

/* ------------------------------ UI BUILDERS ------------------------------ */

function menuMessageComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("open_menu").setLabel("Click to see our menu").setStyle(ButtonStyle.Primary)
    ),
  ];
}

function categorySelectComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("select_category")
        .setPlaceholder("Choose a category…")
        .addOptions(categoryOptions)
    ),
  ];
}

function itemSelectComponents(category) {
  const items = CATALOG[category] || [];
  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`select_item:${category}`)
        .setPlaceholder("Choose an item…")
        .addOptions(
          items.map((it) => ({
            label: `${it.name} — ${money(it.price_pence)}`.slice(0, 100),
            value: it.sku,
          }))
        )
    ),
  ];
}

function qtyButtonsComponents(category, sku) {
  const row1 = new ActionRowBuilder().addComponents(
    ...[1, 2, 3, 4, 5].map((n) =>
      new ButtonBuilder()
        .setCustomId(`add_qty:${category}:${sku}:${n}`)
        .setLabel(String(n))
        .setStyle(ButtonStyle.Secondary)
    )
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`add_qty_other:${category}:${sku}`).setLabel("Other…").setStyle(ButtonStyle.Primary)
  );

  return [row1, row2];
}

function cartActionsComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("cart_add_more").setLabel("Add Another Item").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("cart_discount").setLabel("Apply Discount Code").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("cart_submit").setLabel("Submit Order ✅").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("cart_clear").setLabel("Clear Cart").setStyle(ButtonStyle.Danger)
    ),
  ];
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

// Old flow kept (not used in UI anymore)
function paymentLinkModal(orderId) {
  const modal = new ModalBuilder().setCustomId(`paylink_modal:${orderId}`).setTitle("Add payment link");

  const url = new TextInputBuilder()
    .setCustomId("payment_url")
    .setLabel("Payment URL (Stripe / PayPal / etc.)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(url));
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

function receiptEmbed(orderId, items, subtotal, discountAmount, discountCode, shipping, total, shippingProfile) {
  const lines = items.map(
    (it) => `• **${it.name}** (${it.size}, ${it.color}) × ${it.qty} — ${money(it.qty * it.price_pence)}`
  );

  const fields = [
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
    { name: "Dispatch", value: "Cut-off: **15:30 (Mon–Fri Dispatch)**" },
    {
      name: "Overseas disclaimer",
      value: "Shipping is at your own risk. No reships or refunds for customs seizures. By ordering, you accept these terms.",
    },
    {
      name: "IMPORTANT — Payment Reference",
      value:
        "PLEASE NOTE- if you use any other reference when making the payment or mention a product as the reference, the order will be cancelled and your money will not be refunded. Please ensure that the reference number is as per The invoice/order summary",
    }
  );

  return new EmbedBuilder()
    .setTitle(`${STORE_NAME} — Receipt (Order #${orderId})`)
    .setDescription(lines.join("\n") || "_No items_")
    .addFields(fields)
    .setFooter({ text: "Pay by bank transfer using the reference shown above." });
}

function staffReceiptControls(orderId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`staff_mark_paid:${orderId}`).setLabel("Mark as paid ✅").setStyle(ButtonStyle.Success)
    ),
  ];
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
          `Once submitted, you'll receive a **private receipt channel** with **bank transfer details** to pay.`;

        await menuChannel.send({ content, components: menuMessageComponents() });

        return interaction.editReply("✅ Shop menu message posted/refreshed in the menu channel.");
      }
    }

    /* ------------------------------ BUTTONS ------------------------------ */

    if (interaction.isButton()) {
      const { customId } = interaction;

      if (customId === "open_menu") {
        return interaction.showModal(shippingModal());
      }

      if (customId.startsWith("add_qty:")) {
  const [, category, sku, qtyStr] = customId.split(":");
  const qty = parseInt(qtyStr, 10);

  const item = (CATALOG[category] || []).find((x) => x.sku === sku);
  if (!item) return interaction.reply({ content: "Item not found.", ephemeral: true });

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
        const [, category, sku] = customId.split(":");
        return interaction.showModal(qtyOtherModal(category, sku));
      }
      
      if (customId === "cart_add_more") {
  return interaction.update({
    content: "Choose a category:",
    components: categorySelectComponents(),
  });
}

      if (customId === "cart_discount") {
        const cart = await getCartSummary(interaction.user.id);
        if (!cart.items.length) {
          return interaction.reply({ content: "Your cart is empty.", ephemeral: true });
        }

        return interaction.showModal(discountCodeModal());
      }

      if (customId === "cart_clear") {
  await clearCart(interaction.user.id);

  return interaction.update({
    content:
      "🗑️ **Basket empty**\n\n" +
      "Your cart has been cleared.\n" +
      "Choose a category below to start a new order:",
    components: categorySelectComponents(),
  });
}

      if (customId === "cart_submit") {
        const cart = await getCartSummary(interaction.user.id);
        if (!cart.items.length) return interaction.reply({ content: "Your cart is empty.", ephemeral: true });

        const shippingProfile = await getUserShippingProfile(interaction.user.id);
        if (!shippingProfile) {
          return interaction.reply({
            content: "I don't have your shipping details yet. Click the menu button again and enter your details.",
            ephemeral: true,
          });
        }

        const subtotal = cart.subtotal_pence;
        const shipping = getShippingPenceForCountry(shippingProfile.country);

        const discount = await getCartDiscount(interaction.user.id);

        if (discount.discount_code) {
          const hasOrderedBefore = await hasUserPlacedOrderBefore(interaction.user.id);
          if (hasOrderedBefore) {
            await clearCartDiscount(interaction.user.id);
            return interaction.reply({
              content: "That welcome code is only valid on your first order and cannot be used here.",
              ephemeral: true,
            });
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
        }

        const guild = interaction.guild;
        const receiptChannel = await createReceiptChannel(guild, interaction.user, orderId);

        await pool.query(`UPDATE orders SET receipt_channel_id=$1 WHERE order_id=$2`, [receiptChannel.id, orderId]);

        await receiptChannel.send({
          content:
            `<@${interaction.user.id}> **Thanks!** Your order has been received.\n\n` +
            `✅ Please pay by **bank transfer** using the details in the receipt below.\n` +
            `<@&${STAFF_ROLE_ID}> once confirmed, please mark as paid.`,
          embeds: [
            receiptEmbed(
              orderId,
              cart.items,
              subtotal,
              totals.discountAmount,
              discount.discount_code,
              shipping,
              total,
              shippingProfile
            ),
          ],
          components: staffReceiptControls(orderId),
        });

        await clearCart(interaction.user.id);

        return interaction.reply({
          content: `✅ Order submitted! Your private receipt channel is: <#${receiptChannel.id}>`,
          ephemeral: true,
        });
      }

      // Old flow kept (button no longer shown)
      if (customId.startsWith("staff_add_paylink:")) {
        const [, orderIdStr] = customId.split(":");
        const orderId = parseInt(orderIdStr, 10);

        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        return interaction.showModal(paymentLinkModal(orderId));
      }

      if (customId.startsWith("staff_mark_paid:")) {
        const [, orderIdStr] = customId.split(":");
        const orderId = parseInt(orderIdStr, 10);

        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        await pool.query(`UPDATE orders SET status='paid' WHERE order_id=$1`, [orderId]);

        return interaction.reply({ content: `✅ Order #${orderId} marked as paid.`, ephemeral: false });
      }
    }

    /* ------------------------------ SELECT MENUS ------------------------------ */

if (interaction.isStringSelectMenu()) {
  const { customId } = interaction;
      
  if (customId === "select_category") {
    const category = interaction.values[0];
    return interaction.update({
      content: "Now choose an item:",
      components: itemSelectComponents(category),
    });
  }

  if (customId.startsWith("select_item:")) {
    const [, category] = customId.split(":");
    const sku = interaction.values[0];

    return interaction.update({
      content: "Selected item — how many?",
      components: qtyButtonsComponents(category, sku),
    });
  }
}

 /* ------------------------------ MODAL SUBMITS ------------------------------ */

if (interaction.isModalSubmit()) {

    /* ------------------------------ MODAL SUBMITS ------------------------------ */

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

        await upsertProfile(interaction.user.id, full_name, email, phone, { full_address, country });

        return interaction.reply({
          content: "✅ Details saved. Choose a category:",
          components: categorySelectComponents(),
          ephemeral: true,
        });
      }

      if (customId.startsWith("qty_other_modal:")) {
        const [, category, sku] = customId.split(":");
        const qtyRaw = interaction.fields.getTextInputValue("qty");
        const qty = parseInt(qtyRaw, 10);

        if (!Number.isFinite(qty) || qty <= 0) {
          return interaction.reply({ content: "Please enter a valid quantity (number > 0).", ephemeral: true });
        }

        const item = (CATALOG[category] || []).find((x) => x.sku === sku);
        if (!item) return interaction.reply({ content: "Item not found.", ephemeral: true });

        await addCartItem(interaction.user.id, {
          sku: item.sku,
          name: item.name,
          size: DEFAULT_SIZE,
          color: DEFAULT_COLOR,
          qty,
          price_pence: item.price_pence,
        });

        const content = await buildCartMessage(interaction.user.id);

        return interaction.reply({
          content,
          components: cartActionsComponents(),
          ephemeral: true,
        });
      }

      if (customId === "discount_code_modal") {
        const enteredRaw = interaction.fields.getTextInputValue("discount_code")?.trim();
        const enteredCode = String(enteredRaw || "").toUpperCase();

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

        if (enteredCode !== WELCOME_CODE) {
          return interaction.reply({ content: "That discount code is invalid.", ephemeral: true });
        }

        const hasOrderedBefore = await hasUserPlacedOrderBefore(interaction.user.id);
        if (hasOrderedBefore) {
          return interaction.reply({
            content: "This code is only valid on your first order.",
            ephemeral: true,
          });
        }

        await setCartDiscount(interaction.user.id, WELCOME_CODE, WELCOME_DISCOUNT_PERCENT);

        const content = await buildCartMessage(interaction.user.id, "✅ Discount code applied.");

        return interaction.reply({
          content,
          components: cartActionsComponents(),
          ephemeral: true,
        });
      }

      // Old flow kept (not used in UI anymore)
      if (customId.startsWith("paylink_modal:")) {
        const [, orderIdStr] = customId.split(":");
        const orderId = parseInt(orderIdStr, 10);

        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", ephemeral: true });
        }

        const url = interaction.fields.getTextInputValue("payment_url")?.trim();
        if (!url || !/^https?:\/\/\S+/i.test(url)) {
          return interaction.reply({ content: "Please enter a valid URL starting with http:// or https://", ephemeral: true });
        }

        await pool.query(`UPDATE orders SET payment_url=$1, status='awaiting_payment' WHERE order_id=$2`, [url, orderId]);

        const payRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel("Pay now").setStyle(ButtonStyle.Link).setURL(url)
        );

        await interaction.reply({ content: `✅ Payment link set for Order #${orderId}.`, ephemeral: true });
        await interaction.channel.send({
          content: `💳 **Payment link ready** for Order #${orderId}:\nClick below to pay.`,
          components: [payRow],
        });
      }
    }
  }
  catch (err) {
    console.error(err);

    if (!interaction.isRepliable()) return;

    try {
      const msg = `❌ Error: ${err.message || "Unknown error"}`;
      if (deferred || interaction.deferred) {
        await interaction.editReply(msg);
      } else if (interaction.replied) {
        await interaction.followUp({ content: msg, ephemeral: true });
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
    } catch {
      // ignore
    }
  }
});

/* ------------------------------- STARTUP ------------------------------- */

(async () => {
  await initDb();
  await registerCommands();

  client.once("ready", () => {
    console.log("✅ Logged in as", client.user.tag);
    console.log("✅ Slash commands registered");
  });

  await client.login(TOKEN);
})();
