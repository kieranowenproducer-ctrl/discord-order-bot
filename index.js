// index.js
// Discord Draft Store Bot (discord.js v14 + Postgres)

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

const PRODUCT_REQUEST_CHANNEL_ID = process.env.PRODUCT_REQUEST_CHANNEL_ID;
const PRODUCT_REQUEST_REVIEW_CHANNEL_ID = process.env.PRODUCT_REQUEST_REVIEW_CHANNEL_ID;

const BANK_ACCOUNT_NAME = process.env.BANK_ACCOUNT_NAME || "YOUR COMPANY LTD";
const BANK_SORT_CODE = process.env.BANK_SORT_CODE || "00-00-00";
const BANK_ACCOUNT_NUMBER = process.env.BANK_ACCOUNT_NUMBER || "00000000";
const BANK_BANK_NAME = process.env.BANK_BANK_NAME || "YOUR BANK";
const BANK_IBAN = process.env.BANK_IBAN || "";
const BANK_SWIFT = process.env.BANK_SWIFT || "";

const STORE_NAME = process.env.STORE_NAME || "Draft Store";
const DEFAULT_SIZE = "Standard";
const DEFAULT_COLOR = "Standard";

const WELCOME_CODE = process.env.WELCOME_CODE || "WELCOME10";
const WELCOME_DISCOUNT_PERCENT = Number(process.env.WELCOME_DISCOUNT_PERCENT || 10);

const SHIPPING_UK_PENCE = Number(process.env.SHIPPING_UK_PENCE || 1000);
const SHIPPING_EU_PENCE = Number(process.env.SHIPPING_EU_PENCE || 3500);
const SHIPPING_USA_PENCE = Number(process.env.SHIPPING_USA_PENCE || 4500);

const SUBMIT_LOCK_MS = 15000;
const SHOP_SESSION_TIMEOUT_MS = 5 * 60 * 1000;
const MEMBER_BROWSER_PAGE_SIZE = 10;
const MEMBER_BROWSER_CACHE_MS = 60 * 1000;
const MEMBER_SEARCH_LIMIT = 25;
const MEMBER_BROWSER_FETCH_LIMIT = 1000;

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
requireEnv("PRODUCT_REQUEST_CHANNEL_ID", PRODUCT_REQUEST_CHANNEL_ID);
requireEnv("PRODUCT_REQUEST_REVIEW_CHANNEL_ID", PRODUCT_REQUEST_REVIEW_CHANNEL_ID);

/* ------------------------------- DATABASE ------------------------------- */

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

/* ------------------------------ SEED DATA ------------------------------- */

const SAFE_SEED_CATALOG = {
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

/* ---------------------------- RUNTIME STATE ----------------------------- */

const SUBMIT_LOCKS = new Map();
const CART_UI_MESSAGES = new Map();
const SHOP_SESSION_CHANNELS = new Map();
const SHOP_SESSION_TIMEOUTS = new Map();
const MEMBER_BROWSER_CACHE = new Map();

/* -------------------------------- HELPERS ------------------------------- */

function money(pence) {
  return `£${(Number(pence || 0) / 100).toFixed(2)}`;
}

function isStaff(member) {
  return member?.roles?.cache?.has(STAFF_ROLE_ID);
}

function isVerifiedMember(member) {
  return member?.roles?.cache?.has(VERIFIED_ROLE_ID);
}

function safeChannelName(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
}

function normalizeDiscountCode(code) {
  return String(code || "").trim().toUpperCase();
}

function truncate100(str) {
  return String(str || "").slice(0, 100);
}

function parsePriceToPence(input) {
  const cleaned = String(input || "").trim().replace(/£/g, "");
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
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

function timeoutMsFromMinutes(minutes) {
  const mins = Number(minutes || 0);
  if (!Number.isFinite(mins) || mins <= 0) return null;
  return mins * 60 * 1000;
}

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

function shopItemDescription(item) {
  if (Number(item.stock_qty || 0) <= 0) {
    return truncate100(`${money(item.price_pence)} • Out of stock`);
  }
  return truncate100(`${money(item.price_pence)} • Stock ${item.stock_qty}`);
}

function memberSearchMatches(member, search) {
  const needle = String(search || "").trim().toLowerCase();
  if (!needle) return false;

  const username = String(member.user?.username || "").toLowerCase();
  const displayName = String(member.displayName || "").toLowerCase();
  const globalName = String(member.user?.globalName || "").toLowerCase();
  const userId = String(member.id || "");

  return (
    username.includes(needle) ||
    displayName.includes(needle) ||
    globalName.includes(needle) ||
    userId.includes(needle)
  );
}

function getMemberBrowserCacheKey(guildId, view) {
  return `${guildId}:${view}`;
}

function clearMemberBrowserCache(guildId) {
  if (!guildId) {
    MEMBER_BROWSER_CACHE.clear();
    return;
  }

  for (const key of MEMBER_BROWSER_CACHE.keys()) {
    if (key.startsWith(`${guildId}:`)) {
      MEMBER_BROWSER_CACHE.delete(key);
    }
  }
}

async function warmMemberCache(guild) {
  try {
    if (guild.members.cache.size >= MEMBER_BROWSER_FETCH_LIMIT) return;
    await guild.members.fetch({ limit: MEMBER_BROWSER_FETCH_LIMIT }).catch(() => null);
  } catch {
    // ignore cache warm failures
  }
}

/* -------------------------- MODERATION HELPERS -------------------------- */

async function searchGuildMembers(guild, search, options = {}) {
  const { verifiedOnly = false, excludeVerified = false } = options;
  const needle = String(search || "").trim();
  if (!needle) return [];

  await warmMemberCache(guild);

  const collected = new Map();

  try {
    const searched = await guild.members.search({
      query: needle.slice(0, 32),
      limit: MEMBER_SEARCH_LIMIT,
      cache: true,
    });

    for (const member of searched.values()) {
      collected.set(member.id, member);
    }
  } catch {
    // fall back to cache only
  }

  for (const member of guild.members.cache.values()) {
    if (memberSearchMatches(member, needle)) {
      collected.set(member.id, member);
    }
  }

  return Array.from(collected.values())
    .filter((member) => {
      if (!member || member.user?.bot) return false;

      const verified = isVerifiedMember(member);
      if (verifiedOnly && !verified) return false;
      if (excludeVerified && verified) return false;

      return memberSearchMatches(member, needle);
    })
    .sort((a, b) => {
      const aName = String(a.displayName || a.user.username || "").toLowerCase();
      const bName = String(b.displayName || b.user.username || "").toLowerCase();
      return aName.localeCompare(bName);
    })
    .slice(0, MEMBER_SEARCH_LIMIT);
}

function memberSelectOptions(members) {
  return members.map((member) => ({
    label: truncate100(member.displayName || member.user.username),
    description: truncate100(
      `@${member.user.username} • ${isVerifiedMember(member) ? "Verified" : "Unverified"}`
    ),
    value: member.id,
  }));
}

async function ensureTargetMember(guild, userId) {
  const cached = guild.members.cache.get(userId);
  if (cached) return cached;
  return guild.members.fetch(userId).catch(() => null);
}

function canActOnTarget(staffMember, targetMember) {
  if (!staffMember || !targetMember) {
    return { ok: false, reason: "Could not resolve that member." };
  }

  if (staffMember.id === targetMember.id) {
    return { ok: false, reason: "You cannot perform this action on yourself." };
  }

  const me = staffMember.guild.members.me;
  if (!me) {
    return { ok: false, reason: "Bot member not found." };
  }

  if (targetMember.id === me.id) {
    return { ok: false, reason: "You cannot moderate the bot." };
  }

  if (staffMember.id !== staffMember.guild.ownerId) {
    if (targetMember.roles.highest.position >= staffMember.roles.highest.position) {
      return { ok: false, reason: "You cannot act on a member with an equal or higher role." };
    }
  }

  if (targetMember.roles.highest.position >= me.roles.highest.position) {
    return { ok: false, reason: "My role is not high enough to act on that member." };
  }

  return { ok: true };
}

async function getFilteredGuildMembers(guild, view = "all", forceRefresh = false) {
  const cacheKey = getMemberBrowserCacheKey(guild.id, view);
  const cached = MEMBER_BROWSER_CACHE.get(cacheKey);

  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.members;
  }

  await warmMemberCache(guild);

  let members = guild.members.cache.filter((member) => member && !member.user?.bot);

  if (view === "verified") {
    members = members.filter((member) => isVerifiedMember(member));
  }

  if (view === "unverified") {
    members = members.filter((member) => !isVerifiedMember(member));
  }

  const result = Array.from(members.values()).sort((a, b) => {
    const aName = String(a.displayName || a.user.username || "").toLowerCase();
    const bName = String(b.displayName || b.user.username || "").toLowerCase();
    return aName.localeCompare(bName);
  });

  MEMBER_BROWSER_CACHE.set(cacheKey, {
    members: result,
    expiresAt: Date.now() + MEMBER_BROWSER_CACHE_MS,
  });

  return result;
}

function memberBrowserTitle(view) {
  if (view === "verified") return "Verified Members";
  if (view === "unverified") return "Unverified Members";
  return "All Members";
}

function getMemberBrowserPageData(members, page = 0) {
  const totalPages = Math.max(1, Math.ceil(members.length / MEMBER_BROWSER_PAGE_SIZE));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const start = safePage * MEMBER_BROWSER_PAGE_SIZE;
  const pageMembers = members.slice(start, start + MEMBER_BROWSER_PAGE_SIZE);

  return {
    totalPages,
    safePage,
    start,
    pageMembers,
  };
}

function buildMemberBrowserEmbed(members, view, page = 0) {
  const { totalPages, safePage, start, pageMembers } = getMemberBrowserPageData(members, page);

  const lines = pageMembers.map((member, index) => {
    const status = isVerifiedMember(member) ? "Verified" : "Unverified";
    const position = start + index + 1;
    return `${position}. **${member.displayName || member.user.username}** • <@${member.id}> • \`${member.id}\` • ${status}`;
  });

  return new EmbedBuilder()
    .setTitle(memberBrowserTitle(view))
    .setDescription(lines.join("\n") || "_No members found_")
    .addFields(
      { name: "Results", value: String(members.length), inline: true },
      { name: "Page", value: `${safePage + 1}/${totalPages}`, inline: true }
    );
}

function buildMemberBrowserSelectMenu(members, view, page = 0) {
  const { pageMembers } = getMemberBrowserPageData(members, page);

  if (!pageMembers.length) return null;

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`staff_member_browser_select:${view}:${page}`)
      .setPlaceholder("Select a member…")
      .addOptions(
        pageMembers.map((member) => ({
          label: truncate100(member.displayName || member.user.username),
          description: truncate100(
            `@${member.user.username} • ${isVerifiedMember(member) ? "Verified" : "Unverified"}`
          ),
          value: member.id,
        }))
      )
  );
}

function buildMemberBrowserComponents(members, view, page = 0) {
  const { totalPages, safePage } = getMemberBrowserPageData(members, page);
  const rows = [];

  const selectRow = buildMemberBrowserSelectMenu(members, view, safePage);
  if (selectRow) rows.push(selectRow);

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`staff_member_browser_prev:${view}:${safePage}`)
        .setLabel("Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage <= 0),
      new ButtonBuilder()
        .setCustomId(`staff_member_browser_next:${view}:${safePage}`)
        .setLabel("Next")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage >= totalPages - 1),
      new ButtonBuilder()
        .setCustomId(`staff_member_browser_refresh:${view}:${safePage}`)
        .setLabel("Refresh")
        .setStyle(ButtonStyle.Primary)
    )
  );

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("staff_panel_home")
        .setLabel("Back")
        .setStyle(ButtonStyle.Secondary)
    )
  );

  return rows;
}

function buildMemberDetailEmbed(member, view, page = 0) {
  const verified = isVerifiedMember(member) ? "Verified" : "Unverified";

  return new EmbedBuilder()
    .setTitle("Member Details")
    .setDescription(
      `**Name:** ${member.displayName || member.user.username}\n` +
      `**Username:** @${member.user.username}\n` +
      `**User ID:** \`${member.id}\`\n` +
      `**Status:** ${verified}\n` +
      `**Page Source:** ${memberBrowserTitle(view)} • Page ${Number(page) + 1}`
    );
}

function buildMemberDetailComponents(member, view, page = 0) {
  const verified = isVerifiedMember(member);

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`staff_member_apply_verify:${view}:${page}:${member.id}`)
        .setLabel("Verify")
        .setStyle(ButtonStyle.Success)
        .setDisabled(verified),
      new ButtonBuilder()
        .setCustomId(`staff_member_apply_unverify:${view}:${page}:${member.id}`)
        .setLabel("Unverify")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!verified),
      new ButtonBuilder()
        .setCustomId(`staff_member_browser_refresh:${view}:${page}`)
        .setLabel("Back to List")
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

/* ------------------------------- INIT DB -------------------------------- */

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
    CREATE TABLE IF NOT EXISTS categories (
      category_id BIGSERIAL PRIMARY KEY,
      category_name TEXT NOT NULL UNIQUE,
      sort_order INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      product_id BIGSERIAL PRIMARY KEY,
      category_id BIGINT NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,
      sku TEXT NOT NULL UNIQUE,
      product_name TEXT NOT NULL,
      price_pence INT NOT NULL CHECK (price_pence >= 0),
      default_stock_qty INT NOT NULL DEFAULT 0 CHECK (default_stock_qty >= 0),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock_items (
      sku TEXT PRIMARY KEY,
      stock_qty INT NOT NULL DEFAULT 0,
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
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

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
    CREATE TABLE IF NOT EXISTS product_requests (
      request_id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT,
      requested_product TEXT NOT NULL,
      extra_notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(
    `
    INSERT INTO discount_codes (code, discount_percent, is_active, one_use_per_user, created_at, updated_at)
    VALUES ($1, $2, TRUE, TRUE, NOW(), NOW())
    ON CONFLICT (code) DO NOTHING
    `,
    [normalizeDiscountCode(WELCOME_CODE), WELCOME_DISCOUNT_PERCENT]
  );

  const categoryCountRes = await pool.query(`SELECT COUNT(*)::int AS count FROM categories`);
  const categoryCount = Number(categoryCountRes.rows[0]?.count || 0);

  if (categoryCount === 0) {
    let sort = 1;

    for (const [categoryName, items] of Object.entries(SAFE_SEED_CATALOG)) {
      const catRes = await pool.query(
        `
        INSERT INTO categories (category_name, sort_order, is_active, created_at, updated_at)
        VALUES ($1, $2, TRUE, NOW(), NOW())
        RETURNING category_id
        `,
        [categoryName, sort]
      );

      const categoryId = catRes.rows[0].category_id;
      sort += 1;

      for (const item of items) {
        await pool.query(
          `
          INSERT INTO products (category_id, sku, product_name, price_pence, default_stock_qty, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
          `,
          [categoryId, item.sku, item.name, item.price_pence, item.stock_qty]
        );

        await pool.query(
          `
          INSERT INTO stock_items (sku, stock_qty, updated_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (sku) DO NOTHING
          `,
          [item.sku, item.stock_qty]
        );
      }
    }
  } else {
    const missingStockRes = await pool.query(`
      SELECT p.sku, p.default_stock_qty
      FROM products p
      LEFT JOIN stock_items s ON s.sku = p.sku
      WHERE s.sku IS NULL
    `);

    for (const row of missingStockRes.rows) {
      await pool.query(
        `
        INSERT INTO stock_items (sku, stock_qty, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (sku) DO NOTHING
        `,
        [row.sku, row.default_stock_qty]
      );
    }
  }
}

/* --------------------------- CATEGORY / PRODUCT -------------------------- */

async function getCategories() {
  const res = await pool.query(`
    SELECT category_id, category_name
    FROM categories
    WHERE is_active = TRUE
    ORDER BY sort_order ASC, category_name ASC
  `);
  return res.rows;
}

async function getCategoryById(categoryId) {
  const res = await pool.query(
    `
    SELECT category_id, category_name
    FROM categories
    WHERE category_id = $1
    `,
    [categoryId]
  );
  return res.rows[0] || null;
}

async function createCategory(categoryName) {
  const clean = String(categoryName || "").trim();
  if (!clean) throw new Error("Category name is required.");

  const maxRes = await pool.query(`SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM categories`);
  const nextSort = Number(maxRes.rows[0]?.max_sort || 0) + 1;

  const res = await pool.query(
    `
    INSERT INTO categories (category_name, sort_order, is_active, created_at, updated_at)
    VALUES ($1, $2, TRUE, NOW(), NOW())
    RETURNING category_id, category_name
    `,
    [clean, nextSort]
  );

  return res.rows[0];
}

async function renameCategory(categoryId, newName) {
  const clean = String(newName || "").trim();
  if (!clean) throw new Error("New category name is required.");

  const res = await pool.query(
    `
    UPDATE categories
    SET category_name = $2,
        updated_at = NOW()
    WHERE category_id = $1
    RETURNING category_id, category_name
    `,
    [categoryId, clean]
  );

  return res.rows[0] || null;
}

async function deleteCategory(categoryId) {
  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS count FROM products WHERE category_id = $1`,
    [categoryId]
  );

  const count = Number(countRes.rows[0]?.count || 0);
  if (count > 0) {
    throw new Error("That category still contains products. Move or delete the products first.");
  }

  const res = await pool.query(
    `
    DELETE FROM categories
    WHERE category_id = $1
    RETURNING category_id, category_name
    `,
    [categoryId]
  );

  return res.rows[0] || null;
}

async function getProductsByCategoryId(categoryId) {
  const res = await pool.query(
    `
    SELECT
      p.product_id,
      p.category_id,
      p.sku,
      p.product_name,
      p.price_pence,
      p.default_stock_qty,
      COALESCE(s.stock_qty, 0) AS stock_qty
    FROM products p
    LEFT JOIN stock_items s ON s.sku = p.sku
    WHERE p.category_id = $1 AND p.is_active = TRUE
    ORDER BY p.product_name ASC
    `,
    [categoryId]
  );

  return res.rows;
}

async function getProductBySku(sku) {
  const res = await pool.query(
    `
    SELECT
      p.product_id,
      p.category_id,
      p.sku,
      p.product_name,
      p.price_pence,
      p.default_stock_qty,
      COALESCE(s.stock_qty, 0) AS stock_qty,
      c.category_name
    FROM products p
    LEFT JOIN stock_items s ON s.sku = p.sku
    JOIN categories c ON c.category_id = p.category_id
    WHERE p.sku = $1
    `,
    [sku]
  );

  return res.rows[0] || null;
}

async function createProduct({ categoryId, sku, productName, pricePence, stockQty }) {
  const cleanSku = String(sku || "").trim().toUpperCase();
  const cleanName = String(productName || "").trim();

  if (!categoryId) throw new Error("Category is required.");
  if (!cleanSku) throw new Error("SKU is required.");
  if (!cleanName) throw new Error("Product name is required.");
  if (!Number.isFinite(pricePence) || pricePence < 0) throw new Error("Valid price is required.");
  if (!Number.isFinite(stockQty) || stockQty < 0) throw new Error("Valid stock quantity is required.");

  const res = await pool.query(
    `
    INSERT INTO products (
      category_id, sku, product_name, price_pence, default_stock_qty, is_active, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
    RETURNING product_id, sku, product_name
    `,
    [categoryId, cleanSku, cleanName, pricePence, stockQty]
  );

  await pool.query(
    `
    INSERT INTO stock_items (sku, stock_qty, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (sku) DO UPDATE
    SET stock_qty = EXCLUDED.stock_qty,
        updated_at = NOW()
    `,
    [cleanSku, stockQty]
  );

  return res.rows[0];
}

async function renameProduct(sku, newName) {
  const clean = String(newName || "").trim();
  if (!clean) throw new Error("New product name is required.");

  const res = await pool.query(
    `
    UPDATE products
    SET product_name = $2,
        updated_at = NOW()
    WHERE sku = $1
    RETURNING sku, product_name
    `,
    [sku, clean]
  );

  return res.rows[0] || null;
}

async function updateProductPrice(sku, pricePence) {
  if (!Number.isFinite(pricePence) || pricePence < 0) {
    throw new Error("Valid price is required.");
  }

  const res = await pool.query(
    `
    UPDATE products
    SET price_pence = $2,
        updated_at = NOW()
    WHERE sku = $1
    RETURNING sku, product_name, price_pence
    `,
    [sku, pricePence]
  );

  return res.rows[0] || null;
}

async function updateProductStock(sku, stockQty) {
  if (!Number.isFinite(stockQty) || stockQty < 0) {
    throw new Error("Valid stock quantity is required.");
  }

  await pool.query(
    `
    INSERT INTO stock_items (sku, stock_qty, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (sku) DO UPDATE
    SET stock_qty = EXCLUDED.stock_qty,
        updated_at = NOW()
    `,
    [sku, stockQty]
  );

  const res = await pool.query(
    `
    SELECT p.sku, p.product_name, COALESCE(s.stock_qty, 0) AS stock_qty
    FROM products p
    LEFT JOIN stock_items s ON s.sku = p.sku
    WHERE p.sku = $1
    `,
    [sku]
  );

  return res.rows[0] || null;
}

async function moveProductToCategory(sku, categoryId) {
  const res = await pool.query(
    `
    UPDATE products
    SET category_id = $2,
        updated_at = NOW()
    WHERE sku = $1
    RETURNING sku, product_name, category_id
    `,
    [sku, categoryId]
  );

  return res.rows[0] || null;
}

async function deleteProduct(sku) {
  await pool.query(`DELETE FROM stock_items WHERE sku = $1`, [sku]);

  const res = await pool.query(
    `
    DELETE FROM products
    WHERE sku = $1
    RETURNING sku, product_name
    `,
    [sku]
  );

  return res.rows[0] || null;
}

async function restockAllToDefault() {
  const productsRes = await pool.query(`
    SELECT sku, default_stock_qty
    FROM products
    WHERE is_active = TRUE
  `);

  for (const row of productsRes.rows) {
    await pool.query(
      `
      INSERT INTO stock_items (sku, stock_qty, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (sku) DO UPDATE
      SET stock_qty = EXCLUDED.stock_qty,
          updated_at = NOW()
      `,
      [row.sku, row.default_stock_qty]
    );
  }
}

/* -------------------------- DISCOUNT CODE HELPERS ----------------------- */

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

async function hasUserPlacedOrderBefore(userId) {
  const res = await pool.query(`SELECT 1 FROM orders WHERE user_id=$1 LIMIT 1`, [userId]);
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

/* ------------------------------- REQUESTS ------------------------------- */

async function createProductRequestRecord(userId, username, requestedProduct, extraNotes) {
  const res = await pool.query(
    `
    INSERT INTO product_requests (user_id, username, requested_product, extra_notes, status)
    VALUES ($1, $2, $3, $4, 'pending')
    RETURNING request_id, requested_product, extra_notes, created_at
    `,
    [userId, username, requestedProduct, extraNotes || null]
  );

  return res.rows[0];
}

/* ------------------------------- CART HELPERS --------------------------- */

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

async function getOrCreateCart(userId) {
  const existing = await pool.query(
    `SELECT cart_id FROM carts WHERE user_id=$1 AND status='open'`,
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

async function getCartSummary(userId) {
  const cart = await pool.query(
    `SELECT cart_id FROM carts WHERE user_id=$1 AND status='open'`,
    [userId]
  );

  if (!cart.rows.length) return { items: [], subtotal_pence: 0 };

  const cartId = cart.rows[0].cart_id;
  const itemsRes = await pool.query(
    `
    SELECT sku, name, size, color, qty, price_pence
    FROM cart_items
    WHERE cart_id=$1
    ORDER BY id ASC
    `,
    [cartId]
  );

  const items = itemsRes.rows;
  const subtotal_pence = items.reduce((sum, it) => sum + it.qty * it.price_pence, 0);
  return { items, subtotal_pence };
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

async function clearCart(userId) {
  const cart = await pool.query(
    `SELECT cart_id FROM carts WHERE user_id=$1 AND status='open'`,
    [userId]
  );

  if (!cart.rows.length) return;

  const cartId = cart.rows[0].cart_id;
  await pool.query(`DELETE FROM cart_items WHERE cart_id=$1`, [cartId]);
  await pool.query(`DELETE FROM carts WHERE cart_id=$1`, [cartId]);
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

async function hasUserPendingOrder(userId) {
  const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
  if (guild) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member?.roles?.cache?.has(STAFF_ROLE_ID)) {
      return false;
    }
  }

  const res = await pool.query(
    `
    SELECT 1
    FROM orders
    WHERE user_id = $1
      AND status IN ('pending', 'paid', 'dispatched')
    LIMIT 1
    `,
    [userId]
  );

  return res.rows.length > 0;
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

/* ------------------------------- RECEIPTS ------------------------------- */

async function createReceiptChannel(guild, user, orderId) {
  const category = await guild.channels.fetch(ORDERS_CATEGORY_ID).catch(() => null);

  const name = safeChannelName(`order-${user.username}-${orderId}`);
  const channel = await guild.channels.create({
    name,
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
        `After payment, you must upload a **screenshot of payment** in this private order chat as evidence before your order can be shipped.\n` +
        `Failure to provide payment proof may lead to delays.\n` +
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
        .setLabel("Mark Paid")
        .setStyle(ButtonStyle.Success)
        .setDisabled(
          status === "paid" ||
          status === "dispatched" ||
          status === "cancelled" ||
          status === "completed"
        ),
      new ButtonBuilder()
        .setCustomId(`staff_mark_dispatched:${orderId}`)
        .setLabel("Mark Dispatched")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(
          status === "dispatched" ||
          status === "cancelled" ||
          status === "completed"
        ),
      new ButtonBuilder()
        .setCustomId(`staff_complete_order:${orderId}`)
        .setLabel("Complete")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(
          status === "cancelled" ||
          status === "completed" ||
          status !== "dispatched"
        )
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`staff_cancel_order:${orderId}`)
        .setLabel("Cancel Order")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(
          status === "dispatched" ||
          status === "cancelled" ||
          status === "completed"
        )
    ),
  ];
}

/* -------------------------------- MODALS -------------------------------- */

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

function qtyOtherModal(categoryId, sku) {
  const modal = new ModalBuilder()
    .setCustomId(`qty_other_modal:${categoryId}:${sku}`)
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
    .setRequired(true);

  const foundInput = new TextInputBuilder()
    .setCustomId("verify_found")
    .setLabel("How did you hear about us?")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  const referralInput = new TextInputBuilder()
    .setCustomId("verify_referral")
    .setLabel("Referral / who sent you")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const emailInput = new TextInputBuilder()
    .setCustomId("verify_email")
    .setLabel("Email address")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const phoneInput = new TextInputBuilder()
    .setCustomId("verify_phone")
    .setLabel("Phone number")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(nameInput),
    new ActionRowBuilder().addComponents(foundInput),
    new ActionRowBuilder().addComponents(referralInput),
    new ActionRowBuilder().addComponents(emailInput),
    new ActionRowBuilder().addComponents(phoneInput)
  );

  return modal;
}

function productRequestModal() {
  const modal = new ModalBuilder()
    .setCustomId("product_request_modal")
    .setTitle("Request a Product");

  const productInput = new TextInputBuilder()
    .setCustomId("requested_product")
    .setLabel("What product would you like to see?")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const notesInput = new TextInputBuilder()
    .setCustomId("extra_notes")
    .setLabel("Extra details")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setPlaceholder("Optional: size, colour, brand, style, flavour, variation, etc.");

  modal.addComponents(
    new ActionRowBuilder().addComponents(productInput),
    new ActionRowBuilder().addComponents(notesInput)
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
    .setRequired(true);

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
    .setRequired(true);

  const percentInput = new TextInputBuilder()
    .setCustomId("discount_percent")
    .setLabel("Discount percent")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

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
    .setRequired(true);

  const activeInput = new TextInputBuilder()
    .setCustomId("discount_active")
    .setLabel("Type active or inactive")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(codeInput),
    new ActionRowBuilder().addComponents(activeInput)
  );

  return modal;
}

function staffStockQtyModal(sku, label) {
  const modal = new ModalBuilder()
    .setCustomId(`staff_stock_qty_modal:${sku}`)
    .setTitle("Update Stock");

  const qtyInput = new TextInputBuilder()
    .setCustomId("stock_qty")
    .setLabel(truncate100(`New stock for ${label || sku}`))
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("Example: 25");

  modal.addComponents(new ActionRowBuilder().addComponents(qtyInput));
  return modal;
}

function staffAddCategoryModal() {
  const modal = new ModalBuilder()
    .setCustomId("staff_add_category_modal")
    .setTitle("Add Category");

  const nameInput = new TextInputBuilder()
    .setCustomId("category_name")
    .setLabel("Category name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
  return modal;
}

function staffRenameCategoryModal(categoryId, currentName) {
  const modal = new ModalBuilder()
    .setCustomId(`staff_rename_category_modal:${categoryId}`)
    .setTitle("Rename Category");

  const nameInput = new TextInputBuilder()
    .setCustomId("new_category_name")
    .setLabel("New category name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(String(currentName || "").slice(0, 4000));

  modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
  return modal;
}

/* ------------------------------ STAFF MODALS (SAFE) ------------------------------ */

// SAFE helper (avoids Discord limits)
function safeText(str, max = 80) {
  return String(str || "").slice(0, max);
}

/* ------------------------------ ADD PRODUCT ------------------------------ */

function staffAddProductModal(categoryId, categoryName) {
  const modal = new ModalBuilder()
    .setCustomId(`staff_add_product_modal:${categoryId}`)
    .setTitle("Add Product");

  const skuInput = new TextInputBuilder()
    .setCustomId("sku")
    .setLabel("SKU")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("Example: NEW001");

  const nameInput = new TextInputBuilder()
    .setCustomId("product_name")
    .setLabel("Product name") // KEEP SHORT
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder(`Category: ${safeText(categoryName)}`);

  const priceInput = new TextInputBuilder()
    .setCustomId("price_gbp")
    .setLabel("Price (GBP)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("Example: 19.99");

  const stockInput = new TextInputBuilder()
    .setCustomId("stock_qty")
    .setLabel("Starting stock")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("Example: 10");

  modal.addComponents(
    new ActionRowBuilder().addComponents(skuInput),
    new ActionRowBuilder().addComponents(nameInput),
    new ActionRowBuilder().addComponents(priceInput),
    new ActionRowBuilder().addComponents(stockInput)
  );

  return modal;
}

/* ------------------------------ UPDATE STOCK ------------------------------ */

function staffStockQtyModal(sku, label) {
  const modal = new ModalBuilder()
    .setCustomId(`staff_stock_qty_modal:${sku}`)
    .setTitle("Update Stock");

  const qtyInput = new TextInputBuilder()
    .setCustomId("stock_qty")
    .setLabel("New stock quantity") // SHORT
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder(safeText(label || sku));

  modal.addComponents(new ActionRowBuilder().addComponents(qtyInput));

  return modal;
}

/* ------------------------------ TIMEOUT ------------------------------ */

function staffTimeoutModal(userId, label) {
  const modal = new ModalBuilder()
    .setCustomId(`staff_timeout_modal:${userId}`)
    .setTitle("Timeout Member");

  const minutesInput = new TextInputBuilder()
    .setCustomId("timeout_minutes")
    .setLabel("Timeout (minutes)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("Example: 60");

  const reasonInput = new TextInputBuilder()
    .setCustomId("timeout_reason")
    .setLabel("Reason") // SHORT
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setPlaceholder(safeText(label || userId));

  modal.addComponents(
    new ActionRowBuilder().addComponents(minutesInput),
    new ActionRowBuilder().addComponents(reasonInput)
  );

  return modal;
}

/* ------------------------------ BAN ------------------------------ */

function staffBanModal(userId, label) {
  const modal = new ModalBuilder()
    .setCustomId(`staff_ban_modal:${userId}`)
    .setTitle("Ban Member");

  const reasonInput = new TextInputBuilder()
    .setCustomId("ban_reason")
    .setLabel("Reason") // SHORT
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setPlaceholder(safeText(label || userId));

  modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));

  return modal;
}

/* ----------------------------- SHOP UI HELPERS -------------------------- */

async function categorySelectComponents() {
  const categories = await getCategories();

  const safeOptions = categories.slice(0, 25).map((cat) => ({
    label: truncate100(cat.category_name),
    value: String(cat.category_id),
  }));

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("select_category")
        .setPlaceholder("Choose a category…")
        .addOptions(safeOptions)
    ),
  ];
}

async function itemSelectComponents(categoryId) {
  const items = (await getProductsByCategoryId(categoryId)).slice(0, 25);

  const options = items.map((it) => ({
    label: truncate100(it.product_name),
    value: truncate100(it.sku),
    description: shopItemDescription(it),
  }));

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`select_item:${categoryId}`)
        .setPlaceholder("Choose a product…")
        .addOptions(options)
    ),
  ];
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
        .setLabel("Submit Order")
        .setStyle(ButtonStyle.Success)
        .setDisabled(disableSubmit),
      new ButtonBuilder()
        .setCustomId("cart_clear")
        .setLabel("Clear Cart")
        .setStyle(ButtonStyle.Danger)
    ),
  ];
}

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
        .setLabel("Approve")
        .setStyle(ButtonStyle.Success)
    ),
  ];
}

function productRequestPanelComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("product_request_open")
        .setLabel("Request a Product")
        .setStyle(ButtonStyle.Primary)
    ),
  ];
}

async function staffCategorySelect(
  customId,
  placeholder = "Choose a category…",
  backId = "staff_panel_home",
  backLabel = "Back"
) {
  const categories = await getCategories();

  if (!categories.length) {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("staff_noop")
          .setLabel("No categories available")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(backId)
          .setLabel(backLabel)
          .setStyle(ButtonStyle.Secondary)
      ),
    ];
  }

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(customId)
        .setPlaceholder(placeholder)
        .addOptions(
          categories.slice(0, 25).map((cat) => ({
            label: truncate100(cat.category_name),
            value: String(cat.category_id),
          }))
        )
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(backId)
        .setLabel(backLabel)
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

async function staffProductSelectByCategory(
  customId,
  categoryId,
  placeholder = "Choose a product…",
  backId = "staff_panel_home",
  backLabel = "Back"
) {
  const products = await getProductsByCategoryId(categoryId);

  if (!products.length) {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("staff_noop")
          .setLabel("No products in this category")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(backId)
          .setLabel(backLabel)
          .setStyle(ButtonStyle.Secondary)
      ),
    ];
  }

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(customId)
        .setPlaceholder(placeholder)
        .addOptions(
          products.slice(0, 25).map((p) => ({
            label: truncate100(p.product_name),
            description: truncate100(`${money(p.price_pence)} • SKU ${p.sku}`),
            value: truncate100(p.sku),
          }))
        )
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(backId)
        .setLabel(backLabel)
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

function navRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("staff_panel_home")
      .setLabel("⬅ Back")
      .setStyle(ButtonStyle.Secondary)
  );
}

function staffMainPanel() {
  return {
    content: `**Staff Panel**\nSelect a section:`,
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("staff_nav_orders").setLabel("Orders").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("staff_nav_products").setLabel("Products").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("staff_nav_categories").setLabel("Categories").setStyle(ButtonStyle.Success)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("staff_nav_stock").setLabel("Stock").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("staff_nav_discounts").setLabel("Discounts").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("staff_nav_moderation").setLabel("Moderation").setStyle(ButtonStyle.Danger)
      ),
    ],
  };
}

function staffProductsPanel() {
  return {
    content: `🟢 **Products**`,
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("staff_add_product").setLabel("Add").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("staff_edit_product").setLabel("Edit").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("staff_move_product").setLabel("Move").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("staff_delete_product").setLabel("Delete").setStyle(ButtonStyle.Danger)
      ),
      navRow(),
    ],
  };
}

function staffCategoriesPanel() {
  return {
    content: `🟢 **Categories**`,
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("staff_add_category").setLabel("Add").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("staff_rename_category").setLabel("Rename").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("staff_delete_category").setLabel("Delete").setStyle(ButtonStyle.Danger)
      ),
      navRow(),
    ],
  };
}

function staffStockPanel() {
  return {
    content: `🟢 **Stock**`,
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("staff_adjust_stock").setLabel("Adjust").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("staff_restock_all").setLabel("Restock All").setStyle(ButtonStyle.Danger)
      ),
      navRow(),
    ],
  };
}

function staffDiscountPanel() {
  return {
    content: `⚪ **Discounts**`,
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("staff_create_discount").setLabel("Create").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("staff_toggle_discount").setLabel("Toggle").setStyle(ButtonStyle.Secondary)
      ),
      navRow(),
    ],
  };
}

function staffOrdersPanel() {
  return {
    content: `🔵 **Orders**`,
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("staff_lookup_order").setLabel("Lookup Order").setStyle(ButtonStyle.Primary)
      ),
      navRow(),
    ],
  };
}

function staffModerationPanel() {
  return {
    content:
      `🔴 **Moderation**\n\n` +
      `Search based verification tools already exist here.\n` +
      `This panel also includes member browsing so staff can scroll through verified and unverified members.`,
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("staff_add_verified").setLabel("Verify").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("staff_remove_verified").setLabel("Unverify").setStyle(ButtonStyle.Danger)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("staff_timeout").setLabel("Timeout").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("staff_kick").setLabel("Kick").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("staff_ban").setLabel("Ban").setStyle(ButtonStyle.Danger)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("staff_browse_all_members").setLabel("Browse All").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("staff_browse_verified_members").setLabel("Browse Verified").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("staff_browse_unverified_members").setLabel("Browse Unverified").setStyle(ButtonStyle.Secondary)
      ),
      navRow(),
    ],
  };
}

/* -------------------------- SESSION / UI HELPERS ------------------------ */

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

  await clearCart(userId).catch(() => {});
  await clearCartDiscount(userId).catch(() => {});

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

  const channel = await getTrackedShopSessionChannel(guild, userId).catch(() => null);
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
    (ch) => ch && ch.type === ChannelType.GuildText && ch.topic === topicMarker
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
      {
        id: guild.members.me.id,
        allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "ManageChannels"],
      },
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
    components: await categorySelectComponents(),
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
      components: await categorySelectComponents(),
    });
  }

  const content = await buildCartMessage(interaction.user.id, heading);

  return interaction.update({
    content,
    components: cartActionsComponents(),
  });
}

/* -------------------------- SLASH COMMAND SETUP ------------------------- */

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
    .setName("setupproductrequests")
    .setDescription("Post or refresh the product request panel in the product request channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Health check"),
].map((c) => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
}

/* ------------------------------- DISCORD -------------------------------- */

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.Channel],
});

client.on("interactionCreate", async (interaction) => {
  let deferred = false;

  try {
    /* -------------------------- SLASH COMMANDS -------------------------- */

    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "ping") {
        return interaction.reply({ content: "pong ✅", flags: 64 });
      }

      if (interaction.commandName === "setupshop") {
        await interaction.deferReply({ flags: 64 });
        deferred = true;

        const menuChannel = await client.channels.fetch(MENU_CHANNEL_ID).catch(() => null);
        if (!menuChannel) {
          return interaction.editReply("❌ Could not find the menu channel. Check MENU_CHANNEL_ID.");
        }

        const content =
          `**Welcome to ${STORE_NAME}!**\n\n` +
          `**How it works:**\n` +
          `1) Click the button below to get started\n` +
          `2) Enter your shipping details\n` +
          `3) Browse categories and move back and forth freely\n` +
          `4) Add multiple items to your basket\n` +
          `5) Apply ${WELCOME_CODE} on your first order for ${WELCOME_DISCOUNT_PERCENT}% off\n` +
          `6) Submit your order when you're done\n\n` +
          `**Important payment note:**\n` +
          `A **screenshot of payment must be provided in your private order chat** as evidence before your order can be shipped.\n` +
          `Failure to provide payment proof may lead to delays.\n\n` +
          `**Shipping:** UK Tracked ${money(SHIPPING_UK_PENCE)} • Europe ${money(SHIPPING_EU_PENCE)} • USA ${money(SHIPPING_USA_PENCE)}\n` +
          `**Cut-off:** 15:30 (Mon–Fri Dispatch)\n\n` +
          `If a shopping session is abandoned, the temporary shop channel auto closes after 5 minutes.`;

        await menuChannel.send({ content, components: menuMessageComponents() });

        return interaction.editReply("✅ Shop menu message posted in the menu channel.");
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

        if (staffChannel.type !== ChannelType.GuildText) {
          return interaction.editReply("❌ STAFF_ONLY_CHANNEL_ID is not a normal text channel.");
        }

        const panel = staffMainPanel();

        await staffChannel.send({
          content: panel.content,
          components: panel.components,
        });

        return interaction.editReply(`✅ Staff panel posted in <#${STAFF_ONLY_CHANNEL_ID}>.`);
      }

      if (interaction.commandName === "setupproductrequests") {
        await interaction.deferReply({ flags: 64 });
        deferred = true;

        const requestChannel = await client.channels.fetch(PRODUCT_REQUEST_CHANNEL_ID).catch(() => null);
        if (!requestChannel) {
          return interaction.editReply("❌ Could not find the product request channel. Check PRODUCT_REQUEST_CHANNEL_ID.");
        }

        const embed = new EmbedBuilder()
          .setTitle("Product Requests")
          .setDescription(
            [
              "Got something you want added to the menu?",
              "",
              "Click the button below and submit your request.",
              "Your request will be sent privately to staff for review.",
            ].join("\n")
          );

        await requestChannel.send({
          embeds: [embed],
          components: productRequestPanelComponents(),
        });

        return interaction.editReply(`✅ Product request panel posted in <#${PRODUCT_REQUEST_CHANNEL_ID}>.`);
      }
    }

    /* ------------------------------- BUTTONS ------------------------------ */

    if (interaction.isButton()) {
      const { customId } = interaction;

      if (
        customId === "browse_categories" ||
        customId === "shop_view_cart" ||
        customId === "shop_close_session" ||
        customId === "cart_discount" ||
        customId === "cart_clear" ||
        customId === "cart_submit" ||
        customId.startsWith("add_qty:") ||
        customId.startsWith("add_qty_other:") ||
        customId.startsWith("back_to_items:")
      ) {
        resetShopSessionTimeout(interaction.guild, interaction.user.id);
      }

      if (customId === "open_menu") {
        return interaction.showModal(shippingModal());
      }

      if (customId === "verify_open_modal") {
        return interaction.showModal(verifyModal());
      }

      if (customId === "product_request_open") {
        return interaction.showModal(productRequestModal());
      }

      if (customId.startsWith("verify_approve:")) {
        const [, targetUserId] = customId.split(":");

        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Staff only.", flags: 64 });
        }

        const guild = interaction.guild;
        const member = await guild.members.fetch(targetUserId).catch(() => null);

        if (!member) {
          return interaction.reply({ content: "Could not find that user in the server.", flags: 64 });
        }

        if (member.roles.cache.has(VERIFIED_ROLE_ID)) {
          return interaction.reply({ content: "That user is already verified.", flags: 64 });
        }

        await member.roles.add(VERIFIED_ROLE_ID, `Approved by ${interaction.user.tag}`);
        clearMemberBrowserCache(guild.id);

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

      /* -------------------------- STAFF NAVIGATION ------------------------- */

      if (customId === "staff_panel_home") {
        return interaction.update(staffMainPanel());
      }

      if (customId === "staff_nav_orders") {
        return interaction.update(staffOrdersPanel());
      }

      if (customId === "staff_nav_products") {
        return interaction.update(staffProductsPanel());
      }

      if (customId === "staff_nav_categories") {
        return interaction.update(staffCategoriesPanel());
      }

      if (customId === "staff_nav_stock") {
        return interaction.update(staffStockPanel());
      }

      if (customId === "staff_nav_discounts") {
        return interaction.update(staffDiscountPanel());
      }

      if (customId === "staff_nav_moderation") {
        return interaction.update(staffModerationPanel());
      }

      /* --------------------------- STAFF ACTIONS -------------------------- */

      if (customId === "staff_add_product") {
        return interaction.update({
          content: "Choose the category you want to add a product to:",
          components: await staffCategorySelect("staff_add_product_select_category", "Choose a category…"),
        });
      }

      if (customId === "staff_edit_product") {
        return interaction.update({
          content: "Choose the category containing the product you want to edit:",
          components: await staffCategorySelect("staff_edit_product_select_category", "Choose a category…"),
        });
      }

      if (customId === "staff_move_product") {
        return interaction.update({
          content: "Choose the category containing the product you want to move:",
          components: await staffCategorySelect("staff_move_product_pick_category", "Choose a category…"),
        });
      }

      if (customId === "staff_delete_product") {
        return interaction.update({
          content: "Choose the category containing the product you want to delete:",
          components: await staffCategorySelect("staff_delete_product_pick_category", "Choose a category…"),
        });
      }

      if (customId === "staff_add_category") {
        return interaction.showModal(staffAddCategoryModal());
      }

      if (customId === "staff_rename_category") {
        return interaction.update({
          content: "Choose the category you want to rename:",
          components: await staffCategorySelect("staff_rename_category_select", "Choose a category…"),
        });
      }

      if (customId === "staff_delete_category") {
        return interaction.update({
          content: "Choose the category you want to delete:",
          components: await staffCategorySelect("staff_delete_category_select", "Choose a category…"),
        });
      }

      if (customId === "staff_adjust_stock") {
        return interaction.update({
          content: "Choose a category:",
          components: await staffCategorySelect("staff_stock_select_category", "Choose a category…"),
        });
      }

      if (customId === "staff_restock_all") {
        return interaction.update({
          content: "Are you sure you want to restock all items back to their default values?",
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("staff_restock_all_execute")
                .setLabel("Yes, restock all")
                .setStyle(ButtonStyle.Danger)
            ),
            navRow(),
          ],
        });
      }

      if (customId === "staff_create_discount") {
        return interaction.showModal(staffCreateDiscountModal());
      }

      if (customId === "staff_toggle_discount") {
        return interaction.showModal(staffToggleDiscountModal());
      }

      if (customId === "staff_lookup_order") {
        return interaction.showModal(staffOrderLookupModal());
      }

      if (customId === "staff_add_verified") {
        return interaction.showModal(staffMemberSearchModal("add_verified", "Add Verified Role"));
      }

      if (customId === "staff_remove_verified") {
        return interaction.showModal(staffMemberSearchModal("remove_verified", "Remove Verified Role"));
      }

      if (customId === "staff_timeout") {
        return interaction.showModal(staffMemberSearchModal("timeout", "Find Member To Timeout"));
      }

      if (customId === "staff_kick") {
        return interaction.showModal(staffMemberSearchModal("kick", "Find Member To Kick"));
      }

      if (customId === "staff_ban") {
        return interaction.showModal(staffMemberSearchModal("ban", "Find Member To Ban"));
      }

      if (
        customId === "staff_browse_all_members" ||
        customId === "staff_browse_verified_members" ||
        customId === "staff_browse_unverified_members"
      ) {
        await interaction.deferUpdate();

        const view =
          customId === "staff_browse_verified_members"
            ? "verified"
            : customId === "staff_browse_unverified_members"
            ? "unverified"
            : "all";

        const members = await getFilteredGuildMembers(interaction.guild, view);

        await interaction.message.edit({
          content: `Browsing ${memberBrowserTitle(view).toLowerCase()}:`,
          embeds: [buildMemberBrowserEmbed(members, view, 0)],
          components: buildMemberBrowserComponents(members, view, 0),
        });

        return;
      }

      if (
        customId.startsWith("staff_member_browser_prev:") ||
        customId.startsWith("staff_member_browser_next:") ||
        customId.startsWith("staff_member_browser_refresh:")
      ) {
        await interaction.deferUpdate();

        const [view, pageRaw] = customId.split(":").slice(1);
        const currentPage = parseInt(pageRaw, 10) || 0;
        let newPage = currentPage;

        if (customId.startsWith("staff_member_browser_prev:")) {
          newPage = Math.max(0, currentPage - 1);
        }

        if (customId.startsWith("staff_member_browser_next:")) {
          const membersForCount = await getFilteredGuildMembers(interaction.guild, view);
          const totalPages = Math.max(1, Math.ceil(membersForCount.length / MEMBER_BROWSER_PAGE_SIZE));
          newPage = Math.min(totalPages - 1, currentPage + 1);

          await interaction.message.edit({
            content: `Browsing ${memberBrowserTitle(view).toLowerCase()}:`,
            embeds: [buildMemberBrowserEmbed(membersForCount, view, newPage)],
            components: buildMemberBrowserComponents(membersForCount, view, newPage),
          });

          return;
        }

        const members = await getFilteredGuildMembers(
          interaction.guild,
          view,
          customId.startsWith("staff_member_browser_refresh:")
        );

        await interaction.message.edit({
          content: `Browsing ${memberBrowserTitle(view).toLowerCase()}:`,
          embeds: [buildMemberBrowserEmbed(members, view, newPage)],
          components: buildMemberBrowserComponents(members, view, newPage),
        });

        return;
      }

      if (customId.startsWith("staff_member_apply_verify:")) {
        await interaction.deferUpdate();

        const [, view, pageRaw, targetUserId] = customId.split(":");
        const page = parseInt(pageRaw, 10) || 0;
        const targetMember = await ensureTargetMember(interaction.guild, targetUserId);

        if (!targetMember) {
          await interaction.message.edit({
            content: "Could not find that member.",
            embeds: [],
            components: staffModerationPanel().components,
          });
          return;
        }

        const check = canActOnTarget(interaction.member, targetMember);
        if (!check.ok) {
          await interaction.message.edit({
            content: check.reason,
            embeds: [],
            components: staffModerationPanel().components,
          });
          return;
        }

        if (!targetMember.roles.cache.has(VERIFIED_ROLE_ID)) {
          await targetMember.roles.add(VERIFIED_ROLE_ID, `Added by ${interaction.user.tag}`);
          clearMemberBrowserCache(interaction.guild.id);
        }

        const refreshedMember = await ensureTargetMember(interaction.guild, targetUserId);

        await interaction.message.edit({
          content: `✅ Verified <@${targetUserId}>`,
          embeds: [buildMemberDetailEmbed(refreshedMember, view, page)],
          components: buildMemberDetailComponents(refreshedMember, view, page),
        });

        return;
      }

      if (customId.startsWith("staff_member_apply_unverify:")) {
        await interaction.deferUpdate();

        const [, view, pageRaw, targetUserId] = customId.split(":");
        const page = parseInt(pageRaw, 10) || 0;
        const targetMember = await ensureTargetMember(interaction.guild, targetUserId);

        if (!targetMember) {
          await interaction.message.edit({
            content: "Could not find that member.",
            embeds: [],
            components: staffModerationPanel().components,
          });
          return;
        }

        const check = canActOnTarget(interaction.member, targetMember);
        if (!check.ok) {
          await interaction.message.edit({
            content: check.reason,
            embeds: [],
            components: staffModerationPanel().components,
          });
          return;
        }

        if (targetMember.roles.cache.has(VERIFIED_ROLE_ID)) {
          await targetMember.roles.remove(VERIFIED_ROLE_ID, `Removed by ${interaction.user.tag}`);
          clearMemberBrowserCache(interaction.guild.id);
        }

        const refreshedMember = await ensureTargetMember(interaction.guild, targetUserId);

        await interaction.message.edit({
          content: `✅ Removed verified role from <@${targetUserId}>`,
          embeds: [buildMemberDetailEmbed(refreshedMember, view, page)],
          components: buildMemberDetailComponents(refreshedMember, view, page),
        });

        return;
      }

      if (customId === "staff_restock_all_execute") {
        await restockAllToDefault();

        return interaction.update({
          content: "✅ All stock reset to default values.",
          components: staffStockPanel().components,
        });
      }

      /* ---------------------------- SHOP BUTTONS --------------------------- */

      if (customId === "browse_categories") {
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
          await destroyShopSessionByChannel(
            interaction.channel,
            interaction.user.id,
            "Shop session closed by user"
          );
        }, 1500);

        return;
      }

      if (customId.startsWith("back_to_items:")) {
        trackCartUiMessage(interaction.user.id, interaction.channel.id, interaction.message.id);

        const [, categoryId] = customId.split(":");
        const category = await getCategoryById(categoryId);
        const itemComponents = await itemSelectComponents(categoryId);

        return interaction.update({
          content: `Category selected: **${category?.category_name || "Unknown"}**\nNow choose an item:`,
          components: itemComponents,
        });
      }

      if (customId.startsWith("add_qty:")) {
        trackCartUiMessage(interaction.user.id, interaction.channel.id, interaction.message.id);

        const [, categoryId, sku, qtyStr] = customId.split(":");
        const qty = parseInt(qtyStr, 10);

        const item = await getProductBySku(sku);
        if (!item) {
          return interaction.update({
            content: "❌ Item not found.",
            components: await categorySelectComponents(),
          });
        }

        const stockQty = await getStockForSku(item.sku);
        if (stockQty <= 0) {
          return interaction.update({
            content: "❌ That item is out of stock.",
            components: await categorySelectComponents(),
          });
        }

        await addCartItem(interaction.user.id, {
          sku: item.sku,
          name: item.product_name,
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
        const [, categoryId, sku] = customId.split(":");
        return interaction.showModal(qtyOtherModal(categoryId, sku));
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
            components: await categorySelectComponents(),
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
          await destroyShopSessionByChannel(
            interaction.channel,
            interaction.user.id,
            "Cart cleared and shop closed"
          );
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

          const receiptChannel = await createReceiptChannel(interaction.guild, interaction.user, orderId);

          await pool.query(`UPDATE orders SET receipt_channel_id=$1 WHERE order_id=$2`, [
            receiptChannel.id,
            orderId,
          ]);

          await receiptChannel.send({
            content:
              `<@${interaction.user.id}> **Thanks!** Your order has been received.\n\n` +
              `✅ Please pay by **bank transfer** using the details in the receipt below.\n` +
              `✅ After payment, upload a **screenshot of payment** in this private order chat before your order can be shipped.\n` +
              `⚠️ Failure to provide payment proof may lead to delays.\n\n` +
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

      /* ---------------------------- ORDER ACTIONS ------------------------- */

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

        const orderRes = await pool.query(`SELECT status, user_id FROM orders WHERE order_id=$1`, [orderId]);

        if (!orderRes.rows.length) {
          return interaction.reply({ content: "Order not found.", flags: 64 });
        }

        const currentStatus = orderRes.rows[0].status;
        const customerUserId = orderRes.rows[0].user_id;

        if (currentStatus === "cancelled") {
          return interaction.reply({ content: "This order is already cancelled.", flags: 64 });
        }

        if (currentStatus === "dispatched" || currentStatus === "completed") {
          return interaction.reply({ content: "Dispatched or completed orders cannot be cancelled.", flags: 64 });
        }

        const itemsRes = await pool.query(`SELECT sku, qty FROM order_items WHERE order_id=$1`, [orderId]);

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

        await pool.query(`UPDATE orders SET status='cancelled' WHERE order_id=$1`, [orderId]);

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
          return interaction.reply({ content: "Staff only.", flags: 64 });
        }

        const orderRes = await pool.query(`SELECT status FROM orders WHERE order_id=$1`, [orderId]);

        if (!orderRes.rows.length) {
          return interaction.reply({ content: "Order not found.", flags: 64 });
        }

        const currentStatus = orderRes.rows[0].status;

        if (currentStatus === "cancelled") {
          return interaction.reply({ content: "Cancelled orders cannot be completed.", flags: 64 });
        }

        if (currentStatus === "completed") {
          return interaction.reply({ content: "This order is already completed.", flags: 64 });
        }

        if (currentStatus !== "dispatched") {
          return interaction.reply({
            content: "Order must be marked as dispatched before it can be completed.",
            flags: 64,
          });
        }

        await pool.query(`UPDATE orders SET status='completed' WHERE order_id=$1`, [orderId]);

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

      /* ----------------------- EXTRA PRODUCT BUTTONS ---------------------- */

      if (customId.startsWith("staff_open_rename_product_modal:")) {
        const [, sku] = customId.split(":");
        const product = await getProductBySku(sku);
        if (!product) return interaction.reply({ content: "Product not found.", flags: 64 });

        return interaction.showModal(staffRenameProductModal(sku, product.product_name));
      }

      if (customId.startsWith("staff_open_price_modal:")) {
        const [, sku] = customId.split(":");
        const product = await getProductBySku(sku);
        if (!product) return interaction.reply({ content: "Product not found.", flags: 64 });

        return interaction.showModal(staffEditPriceModal(sku, product.price_pence));
      }

      if (customId.startsWith("staff_open_stock_modal_direct:")) {
        const [, sku] = customId.split(":");
        const product = await getProductBySku(sku);
        if (!product) return interaction.reply({ content: "Product not found.", flags: 64 });

        return interaction.showModal(staffStockQtyModal(sku, product.product_name));
      }

      if (customId.startsWith("staff_open_move_product_flow:")) {
        const [, sku] = customId.split(":");
        const product = await getProductBySku(sku);
        if (!product) return interaction.reply({ content: "Product not found.", flags: 64 });

        return interaction.update({
          content: `Choose the new category for **${product.product_name}** (${sku}):`,
          components: await staffCategorySelect(
            `staff_move_product_select_category:${sku}`,
            "Choose a new category…"
          ),
        });
      }

      if (customId.startsWith("staff_delete_product_confirm:")) {
        const [, sku] = customId.split(":");
        const deleted = await deleteProduct(sku);
        if (!deleted) return interaction.reply({ content: "Product not found.", flags: 64 });

        return interaction.update({
          content: `✅ Deleted product **${deleted.product_name}** (${deleted.sku})`,
          components: staffProductsPanel().components,
        });
      }
    }

    /* ------------------------- STRING SELECT MENUS ------------------------ */

    if (interaction.isStringSelectMenu()) {
      const { customId } = interaction;

      if (customId === "select_category" || customId.startsWith("select_item:")) {
        resetShopSessionTimeout(interaction.guild, interaction.user.id);
      }

      /* ----------------------- STAFF MEMBER BROWSER ----------------------- */

      if (customId.startsWith("staff_member_browser_select:")) {
        await interaction.deferUpdate();

        const [, view, pageRaw] = customId.split(":");
        const page = parseInt(pageRaw, 10) || 0;
        const targetUserId = interaction.values[0];
        const targetMember = await ensureTargetMember(interaction.guild, targetUserId);

        if (!targetMember) {
          await interaction.message.edit({
            content: "Could not find that member.",
            embeds: [],
            components: staffModerationPanel().components,
          });
          return;
        }

        await interaction.message.edit({
          content: `Viewing member from ${memberBrowserTitle(view).toLowerCase()}:`,
          embeds: [buildMemberDetailEmbed(targetMember, view, page)],
          components: buildMemberDetailComponents(targetMember, view, page),
        });

        return;
      }

      /* --------------------------- STAFF SELECTS -------------------------- */

      if (customId === "staff_stock_select_category") {
        const categoryId = interaction.values[0];

        return interaction.update({
          content: "Choose the product you want to update stock for:",
          components: await staffProductSelectByCategory(
            "staff_stock_select_product",
            categoryId,
            "Choose a product…"
          ),
        });
      }

      if (customId === "staff_stock_select_product") {
        const sku = interaction.values[0];
        const product = await getProductBySku(sku);
        if (!product) return interaction.reply({ content: "Product not found.", flags: 64 });

        return interaction.showModal(staffStockQtyModal(sku, product.product_name));
      }

      if (customId === "staff_add_product_select_category") {
        const categoryId = interaction.values[0];
        const category = await getCategoryById(categoryId);
        if (!category) return interaction.reply({ content: "Category not found.", flags: 64 });

        return interaction.showModal(staffAddProductModal(categoryId, category.category_name));
      }

      if (customId === "staff_edit_product_select_category") {
        const categoryId = interaction.values[0];

        return interaction.update({
          content: "Choose a product:",
          components: await staffProductSelectByCategory(
            "staff_edit_product_select_product",
            categoryId,
            "Choose a product…"
          ),
        });
      }

      if (customId === "staff_edit_product_select_product") {
        const sku = interaction.values[0];
        const product = await getProductBySku(sku);
        if (!product) return interaction.reply({ content: "Product not found.", flags: 64 });

        return interaction.update({
          content:
            `**${product.product_name}**\n` +
            `SKU: ${product.sku}\n` +
            `Category: ${product.category_name}\n` +
            `Price: ${money(product.price_pence)}\n` +
            `Stock: ${product.stock_qty}`,
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`staff_open_rename_product_modal:${sku}`)
                .setLabel("Rename")
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId(`staff_open_price_modal:${sku}`)
                .setLabel("Change Price")
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId(`staff_open_stock_modal_direct:${sku}`)
                .setLabel("Change Stock")
                .setStyle(ButtonStyle.Success)
            ),
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`staff_open_move_product_flow:${sku}`)
                .setLabel("Move Product")
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId(`staff_delete_product_confirm:${sku}`)
                .setLabel("Delete Product")
                .setStyle(ButtonStyle.Danger)
            ),
            navRow(),
          ],
        });
      }

      if (customId === "staff_move_product_pick_category") {
        const categoryId = interaction.values[0];

        return interaction.update({
          content: "Choose the product you want to move:",
          components: await staffProductSelectByCategory(
            "staff_move_product_select_product",
            categoryId,
            "Choose a product…"
          ),
        });
      }

      if (customId === "staff_move_product_select_product") {
        const sku = interaction.values[0];
        const product = await getProductBySku(sku);
        if (!product) return interaction.reply({ content: "Product not found.", flags: 64 });

        return interaction.update({
          content: `Choose the new category for **${product.product_name}** (${sku}):`,
          components: await staffCategorySelect(
            `staff_move_product_select_category:${sku}`,
            "Choose a new category…"
          ),
        });
      }

      if (customId.startsWith("staff_move_product_select_category:")) {
        const [, sku] = customId.split(":");
        const categoryId = interaction.values[0];
        const category = await getCategoryById(categoryId);
        const moved = await moveProductToCategory(sku, categoryId);

        if (!moved) return interaction.reply({ content: "Product not found.", flags: 64 });

        return interaction.update({
          content: `✅ Product moved to **${category?.category_name || "new category"}**`,
          components: staffProductsPanel().components,
        });
      }

      if (customId === "staff_delete_product_pick_category") {
        const categoryId = interaction.values[0];

        return interaction.update({
          content: "Choose the product you want to delete:",
          components: await staffProductSelectByCategory(
            "staff_delete_product_select_product",
            categoryId,
            "Choose a product…"
          ),
        });
      }

      if (customId === "staff_delete_product_select_product") {
        const sku = interaction.values[0];
        const deleted = await deleteProduct(sku);
        if (!deleted) return interaction.reply({ content: "Product not found.", flags: 64 });

        return interaction.update({
          content: `✅ Deleted product **${deleted.product_name}** (${deleted.sku})`,
          components: staffProductsPanel().components,
        });
      }

      if (customId === "staff_rename_category_select") {
        const categoryId = interaction.values[0];
        const category = await getCategoryById(categoryId);
        if (!category) return interaction.reply({ content: "Category not found.", flags: 64 });

        return interaction.showModal(staffRenameCategoryModal(categoryId, category.category_name));
      }

      if (customId === "staff_delete_category_select") {
        const categoryId = interaction.values[0];
        const category = await getCategoryById(categoryId);
        if (!category) return interaction.reply({ content: "Category not found.", flags: 64 });

        const deleted = await deleteCategory(categoryId);
        if (!deleted) return interaction.reply({ content: "Category not found.", flags: 64 });

        return interaction.update({
          content: `✅ Deleted category **${deleted.category_name}**`,
          components: staffCategoriesPanel().components,
        });
      }

      if (customId.startsWith("staff_member_search_select:")) {
        const [, action] = customId.split(":");
        const targetUserId = interaction.values[0];
        const targetMember = await ensureTargetMember(interaction.guild, targetUserId);

        if (!targetMember) {
          return interaction.update({
            content: "Could not find that member.",
            components: staffModerationPanel().components,
          });
        }

        const check = canActOnTarget(interaction.member, targetMember);
        if (!check.ok) {
          return interaction.update({
            content: check.reason,
            components: staffModerationPanel().components,
          });
        }

        if (action === "add_verified") {
          if (targetMember.roles.cache.has(VERIFIED_ROLE_ID)) {
            return interaction.update({
              content: "That member already has the verified role.",
              components: staffModerationPanel().components,
            });
          }

          await targetMember.roles.add(VERIFIED_ROLE_ID, `Added by ${interaction.user.tag}`);
          clearMemberBrowserCache(interaction.guild.id);

          return interaction.update({
            content: `✅ Added verified role to <@${targetMember.id}>`,
            components: staffModerationPanel().components,
          });
        }

        if (action === "remove_verified") {
          if (!targetMember.roles.cache.has(VERIFIED_ROLE_ID)) {
            return interaction.update({
              content: "That member does not currently have the verified role.",
              components: staffModerationPanel().components,
            });
          }

          await targetMember.roles.remove(VERIFIED_ROLE_ID, `Removed by ${interaction.user.tag}`);
          clearMemberBrowserCache(interaction.guild.id);

          return interaction.update({
            content: `✅ Removed verified role from <@${targetMember.id}>`,
            components: staffModerationPanel().components,
          });
        }

        if (action === "timeout") {
          return interaction.showModal(
            staffTimeoutModal(targetMember.id, targetMember.displayName || targetMember.user.username)
          );
        }

        if (action === "kick") {
          await targetMember.kick(`Kicked by ${interaction.user.tag}`);
          clearMemberBrowserCache(interaction.guild.id);

          return interaction.update({
            content: `✅ Kicked <@${targetMember.id}>`,
            components: staffModerationPanel().components,
          });
        }

        if (action === "ban") {
          return interaction.showModal(
            staffBanModal(targetMember.id, targetMember.displayName || targetMember.user.username)
          );
        }
      }

      /* ---------------------------- SHOP MENUS ---------------------------- */

      if (customId === "select_category") {
        trackCartUiMessage(interaction.user.id, interaction.channel.id, interaction.message.id);

        const categoryId = interaction.values[0];
        const category = await getCategoryById(categoryId);
        const itemComponents = await itemSelectComponents(categoryId);

        return interaction.update({
          content: `Category selected: **${category?.category_name || "Unknown"}**\nNow choose an item:`,
          components: itemComponents,
        });
      }

      if (customId.startsWith("select_item:")) {
        trackCartUiMessage(interaction.user.id, interaction.channel.id, interaction.message.id);

        const [, categoryId] = customId.split(":");
        const sku = interaction.values[0];

        const stockQty = await getStockForSku(sku);
        if (stockQty <= 0) {
          return interaction.update({
            content: "That item is out of stock.",
            components: await itemSelectComponents(categoryId),
          });
        }

        const rows = [];
        const maxQuickQty = Math.min(stockQty, 5);
        const quickButtons = [];

        for (let n = 1; n <= maxQuickQty; n += 1) {
          quickButtons.push(
            new ButtonBuilder()
              .setCustomId(`add_qty:${categoryId}:${sku}:${n}`)
              .setLabel(String(n))
              .setStyle(ButtonStyle.Secondary)
          );
        }

        if (quickButtons.length) {
          rows.push(new ActionRowBuilder().addComponents(...quickButtons));
        }

        rows.push(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`add_qty_other:${categoryId}:${sku}`)
              .setLabel("Other…")
              .setStyle(ButtonStyle.Primary)
              .setDisabled(stockQty <= 0),
            new ButtonBuilder()
              .setCustomId(`back_to_items:${categoryId}`)
              .setLabel("Back to Items")
              .setStyle(ButtonStyle.Secondary)
          )
        );

        rows.push(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("browse_categories")
              .setLabel("Back to Categories")
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId("shop_view_cart")
              .setLabel("View Basket")
              .setStyle(ButtonStyle.Secondary)
          )
        );

        return interaction.update({
          content: `Selected item — how many? (In stock: ${stockQty})`,
          components: rows,
        });
      }
    }

    /* ----------------------------- MODAL SUBMITS ------------------------- */

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
          content: `✅ Details saved. Your shop channel is ready.\nIt will auto close after 5 minutes of inactivity.`,
          components: [continueOrderRow],
        });

        setTimeout(async () => {
          try {
            await interaction.deleteReply();
          } catch {}
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
          return interaction.reply({ content: "All verification fields are required.", flags: 64 });
        }

        const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (!emailLooksValid) {
          return interaction.reply({ content: "Please enter a valid email address.", flags: 64 });
        }

        const phoneClean = phone.replace(/[^\d+]/g, "");
        if (phoneClean.length < 7) {
          return interaction.reply({ content: "Please enter a valid phone number.", flags: 64 });
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
          return interaction.reply({ content: "You are already verified.", flags: 64 });
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

      if (customId === "product_request_modal") {
        const requestedProduct = interaction.fields.getTextInputValue("requested_product")?.trim();
        const extraNotes = interaction.fields.getTextInputValue("extra_notes")?.trim();

        if (!requestedProduct) {
          return interaction.reply({ content: "Please enter the product you want to request.", flags: 64 });
        }

        const created = await createProductRequestRecord(
          interaction.user.id,
          interaction.user.tag,
          requestedProduct,
          extraNotes
        );

        const reviewChannel = await interaction.guild.channels
          .fetch(PRODUCT_REQUEST_REVIEW_CHANNEL_ID)
          .catch(() => null);

        if (!reviewChannel) {
          return interaction.reply({
            content:
              "Your request could not be forwarded because the review channel was not found. Check PRODUCT_REQUEST_REVIEW_CHANNEL_ID.",
            flags: 64,
          });
        }

        const embed = new EmbedBuilder()
          .setTitle(`Product Request #${created.request_id}`)
          .addFields(
            { name: "Requested by", value: `<@${interaction.user.id}>`, inline: true },
            { name: "Username", value: interaction.user.tag, inline: true },
            { name: "User ID", value: interaction.user.id, inline: true },
            { name: "Requested product", value: requestedProduct },
            { name: "Extra notes", value: extraNotes || "_None provided_" },
            { name: "Status", value: "pending", inline: true }
          )
          .setTimestamp(new Date(created.created_at));

        await reviewChannel.send({
          content: `<@&${STAFF_ROLE_ID}> New product request submitted for review.`,
          embeds: [embed],
        });

        return interaction.reply({
          content: "✅ Thanks. Your product request has been sent to staff for review.",
          flags: 64,
        });
      }

      /* ---------------------------- STAFF MODALS --------------------------- */

      if (customId === "staff_add_category_modal") {
        const categoryName = interaction.fields.getTextInputValue("category_name")?.trim();
        if (!categoryName) return interaction.reply({ content: "Category name is required.", flags: 64 });

        const created = await createCategory(categoryName);

        return interaction.reply({
          content: `✅ Category created: **${created.category_name}**`,
          flags: 64,
        });
      }

      if (customId.startsWith("staff_rename_category_modal:")) {
        const [, categoryId] = customId.split(":");
        const newName = interaction.fields.getTextInputValue("new_category_name")?.trim();

        const updated = await renameCategory(categoryId, newName);
        if (!updated) return interaction.reply({ content: "Category not found.", flags: 64 });

        return interaction.reply({
          content: `✅ Category renamed to **${updated.category_name}**`,
          flags: 64,
        });
      }

      if (customId.startsWith("staff_add_product_modal:")) {
        const [, categoryId] = customId.split(":");
        const sku = interaction.fields.getTextInputValue("sku")?.trim();
        const productName = interaction.fields.getTextInputValue("product_name")?.trim();
        const priceGbp = interaction.fields.getTextInputValue("price_gbp")?.trim();
        const stockQtyRaw = interaction.fields.getTextInputValue("stock_qty")?.trim();

        const pricePence = parsePriceToPence(priceGbp);
        const stockQty = parseInt(stockQtyRaw, 10);

        if (!sku || !productName) {
          return interaction.reply({ content: "SKU and product name are required.", flags: 64 });
        }

        if (pricePence === null) {
          return interaction.reply({ content: "Enter a valid GBP price.", flags: 64 });
        }

        if (!Number.isFinite(stockQty) || stockQty < 0) {
          return interaction.reply({ content: "Enter a valid stock quantity.", flags: 64 });
        }

        const created = await createProduct({
          categoryId,
          sku,
          productName,
          pricePence,
          stockQty,
        });

        return interaction.reply({
          content: `✅ Product created: **${created.product_name}** (${created.sku})`,
          flags: 64,
        });
      }

      if (customId.startsWith("staff_rename_product_modal:")) {
        const [, sku] = customId.split(":");
        const newName = interaction.fields.getTextInputValue("new_product_name")?.trim();

        const updated = await renameProduct(sku, newName);
        if (!updated) return interaction.reply({ content: "Product not found.", flags: 64 });

        return interaction.reply({
          content: `✅ Product renamed to **${updated.product_name}**`,
          flags: 64,
        });
      }

      if (customId.startsWith("staff_edit_price_modal:")) {
        const [, sku] = customId.split(":");
        const priceGbp = interaction.fields.getTextInputValue("price_gbp")?.trim();
        const pricePence = parsePriceToPence(priceGbp);

        if (pricePence === null) {
          return interaction.reply({ content: "Enter a valid GBP price.", flags: 64 });
        }

        const updated = await updateProductPrice(sku, pricePence);
        if (!updated) return interaction.reply({ content: "Product not found.", flags: 64 });

        return interaction.reply({
          content: `✅ Price updated for **${updated.product_name}** → ${money(updated.price_pence)}`,
          flags: 64,
        });
      }

      if (customId.startsWith("staff_stock_qty_modal:")) {
        const [, sku] = customId.split(":");
        const qtyRaw = interaction.fields.getTextInputValue("stock_qty")?.trim();
        const qty = parseInt(qtyRaw, 10);

        if (!Number.isFinite(qty) || qty < 0) {
          return interaction.reply({
            content: "Enter a valid stock quantity of 0 or more.",
            flags: 64,
          });
        }

        const updated = await updateProductStock(sku, qty);
        if (!updated) return interaction.reply({ content: "Product not found.", flags: 64 });

        return interaction.reply({
          content: `✅ Stock updated for **${updated.product_name}** (${updated.sku}) → ${updated.stock_qty}`,
          flags: 64,
        });
      }

      if (customId === "staff_orderlookup_modal") {
        const orderIdRaw = interaction.fields.getTextInputValue("lookup_order_id")?.trim();
        const orderId = parseInt(orderIdRaw, 10);

        if (!Number.isFinite(orderId) || orderId <= 0) {
          return interaction.reply({ content: "Enter a valid order ID.", flags: 64 });
        }

        const orderRes = await pool.query(`SELECT * FROM orders WHERE order_id=$1`, [orderId]);
        if (!orderRes.rows.length) {
          return interaction.reply({ content: "Order not found.", flags: 64 });
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
            {
              name: "Receipt Channel",
              value: order.receipt_channel_id ? `<#${order.receipt_channel_id}>` : "None",
            },
            { name: "Items", value: itemLines.join("\n") || "_No items_" }
          )
          .setTimestamp(new Date(order.created_at));

        return interaction.reply({
          embeds: [embed],
          flags: 64,
        });
      }

      if (customId === "staff_create_discount_modal") {
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
          content: `✅ Discount code **${code}** created or updated at ${percent}% and set active.`,
          flags: 64,
        });
      }

      if (customId === "staff_toggle_discount_modal") {
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
          return interaction.reply({ content: "Type either active or inactive.", flags: 64 });
        }

        const updated = await setDiscountCodeActiveState(code, active);
        if (!updated) {
          return interaction.reply({ content: "That discount code was not found.", flags: 64 });
        }

        return interaction.reply({
          content: `✅ Discount code **${updated.code}** is now **${updated.is_active ? "active" : "inactive"}**.`,
          flags: 64,
        });
      }

      if (customId.startsWith("staff_member_search_modal:")) {
        const [, action] = customId.split(":");
        const search = interaction.fields.getTextInputValue("member_search")?.trim();

        if (!search) {
          return interaction.reply({ content: "Enter a search term.", flags: 64 });
        }

        const options = {};
        if (action === "add_verified") options.excludeVerified = true;

        const matches = await searchGuildMembers(interaction.guild, search, options);

        if (!matches.length) {
          return interaction.reply({
            content: "No matching members found.",
            flags: 64,
          });
        }

        return interaction.reply({
          content: "Choose a member:",
          components: [
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId(`staff_member_search_select:${action}`)
                .setPlaceholder("Select a member…")
                .addOptions(memberSelectOptions(matches))
            ),
          ],
          flags: 64,
        });
      }

      if (customId.startsWith("staff_timeout_modal:")) {
        const [, userId] = customId.split(":");
        const targetMember = await ensureTargetMember(interaction.guild, userId);

        if (!targetMember) {
          return interaction.reply({ content: "Could not find that member.", flags: 64 });
        }

        const check = canActOnTarget(interaction.member, targetMember);
        if (!check.ok) {
          return interaction.reply({ content: check.reason, flags: 64 });
        }

        const minutesRaw = interaction.fields.getTextInputValue("timeout_minutes")?.trim();
        const reasonRaw = interaction.fields.getTextInputValue("timeout_reason")?.trim();
        const timeoutMs = timeoutMsFromMinutes(minutesRaw);

        if (!timeoutMs) {
          return interaction.reply({ content: "Enter a valid number of minutes.", flags: 64 });
        }

        const maxTimeoutMs = 28 * 24 * 60 * 60 * 1000;
        if (timeoutMs > maxTimeoutMs) {
          return interaction.reply({ content: "Timeout cannot exceed 28 days.", flags: 64 });
        }

        await targetMember.timeout(timeoutMs, reasonRaw || `Timed out by ${interaction.user.tag}`);
        clearMemberBrowserCache(interaction.guild.id);

        return interaction.reply({
          content: `✅ Timed out <@${targetMember.id}> for ${minutesRaw} minute(s).`,
          flags: 64,
        });
      }

      if (customId.startsWith("staff_ban_modal:")) {
        const [, userId] = customId.split(":");
        const targetMember = await ensureTargetMember(interaction.guild, userId);

        if (!targetMember) {
          return interaction.reply({ content: "Could not find that member.", flags: 64 });
        }

        const check = canActOnTarget(interaction.member, targetMember);
        if (!check.ok) {
          return interaction.reply({ content: check.reason, flags: 64 });
        }

        const reasonRaw = interaction.fields.getTextInputValue("ban_reason")?.trim();

        await targetMember.ban({
          reason: reasonRaw || `Banned by ${interaction.user.tag}`,
        });
        clearMemberBrowserCache(interaction.guild.id);

        return interaction.reply({
          content: `✅ Banned <@${targetMember.id}>`,
          flags: 64,
        });
      }

      if (customId.startsWith("qty_other_modal:")) {
        const [, , sku] = customId.split(":");
        const qtyRaw = interaction.fields.getTextInputValue("qty");
        const qty = parseInt(qtyRaw, 10);

        if (!Number.isFinite(qty) || qty <= 0) {
          return interaction.reply({
            content: "Please enter a valid quantity (number > 0).",
            flags: 64,
          });
        }

        const item = await getProductBySku(sku);
        if (!item) return interaction.reply({ content: "Item not found.", flags: 64 });

        const stockQty = await getStockForSku(item.sku);
        if (qty > stockQty) {
          return interaction.reply({
            content: `Only ${stockQty} in stock for ${item.product_name}.`,
            flags: 64,
          });
        }

        await addCartItem(interaction.user.id, {
          sku: item.sku,
          name: item.product_name,
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

/* -------------------------------- STARTUP ------------------------------- */

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
