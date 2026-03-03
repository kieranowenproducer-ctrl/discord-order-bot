import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  ChannelType
} from "discord.js";
import pg from "pg";

const { Pool } = pg;

/**
 * =========================
 * ENV VARS (Railway)
 * =========================
 * Required:
 *  - BOT_TOKEN
 *  - CLIENT_ID
 *  - GUILD_ID
 *  - MENU_CHANNEL_ID   (public channel where the "Open menu" message lives)
 *  - ORDERS_CHANNEL_ID (private staff channel where orders are posted)
 *  - STAFF_ROLE_ID     (role id to tag on orders + grant thread access)
 *  - DATABASE_URL      (Railway Postgres provides this)
 *
 * Optional:
 *  - SHOP_NAME (default "Clothing Shop")
 *  - SHIPPING_FLAT_FEE (default "4.99")
 */
const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const MENU_CHANNEL_ID = process.env.MENU_CHANNEL_ID;
const ORDERS_CHANNEL_ID = process.env.ORDERS_CHANNEL_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;
const DATABASE_URL = process.env.DATABASE_URL;

const SHOP_NAME = process.env.SHOP_NAME || "Clothing Shop";
const SHIPPING_FLAT_FEE = Number(process.env.SHIPPING_FLAT_FEE || "4.99");

if (!BOT_TOKEN) throw new Error("Missing BOT_TOKEN");
if (!CLIENT_ID) throw new Error("Missing CLIENT_ID");
if (!GUILD_ID) throw new Error("Missing GUILD_ID");
if (!MENU_CHANNEL_ID) throw new Error("Missing MENU_CHANNEL_ID");
if (!ORDERS_CHANNEL_ID) throw new Error("Missing ORDERS_CHANNEL_ID");
if (!STAFF_ROLE_ID) throw new Error("Missing STAFF_ROLE_ID");
if (!DATABASE_URL) throw new Error("Missing DATABASE_URL");

/**
 * =========================
 * PRODUCT CATALOG (EDIT THIS)
 * =========================
 * Add/edit categories, products, sizes, colours, prices.
 * Prices are in GBP here, but you can change currency text in embeds.
 */
const CATALOG = [
  {
    id: "tops",
    name: "Tops",
    products: [
      { id: "tee", name: "T-Shirt", price: 19.99, sizes: ["XS", "S", "M", "L", "XL"], colours: ["Black", "White", "Navy"] },
      { id: "hoodie", name: "Hoodie", price: 39.99, sizes: ["S", "M", "L", "XL"], colours: ["Black", "Grey", "Navy"] }
    ]
  },
  {
    id: "bottoms",
    name: "Bottoms",
    products: [
      { id: "shorts", name: "Shorts", price: 24.99, sizes: ["S", "M", "L", "XL"], colours: ["Black", "Stone"] },
      { id: "joggers", name: "Joggers", price: 34.99, sizes: ["S", "M", "L", "XL"], colours: ["Black", "Grey"] }
    ]
  },
  {
    id: "accessories",
    name: "Accessories",
    products: [
      { id: "cap", name: "Cap", price: 14.99, sizes: ["One Size"], colours: ["Black", "White"] },
      { id: "socks", name: "Socks (Pair)", price: 7.99, sizes: ["One Size"], colours: ["White", "Black"] }
    ]
  }
];

/**
 * =========================
 * DB
 * =========================
 */
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false }
});

async function migrate() {
  // Profiles: shipping details
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      address1 TEXT NOT NULL,
      address2 TEXT,
      city TEXT NOT NULL,
      postcode TEXT NOT NULL,
      country TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Open carts (one active cart per user)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS carts (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_carts_user_open ON carts(user_id, status);
  `);

  // Cart items
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id BIGSERIAL PRIMARY KEY,
      cart_id BIGINT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      unit_price NUMERIC(10,2) NOT NULL,
      size TEXT NOT NULL,
      colour TEXT NOT NULL,
      qty INT NOT NULL CHECK (qty > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);
  `);

  // Orders (finalised checkouts)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      staff_channel_id TEXT NOT NULL,
      staff_message_id TEXT,
      subtotal NUMERIC(10,2) NOT NULL,
      shipping_fee NUMERIC(10,2) NOT NULL,
      total NUMERIC(10,2) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_name TEXT NOT NULL,
      unit_price NUMERIC(10,2) NOT NULL,
      size TEXT NOT NULL,
      colour TEXT NOT NULL,
      qty INT NOT NULL CHECK (qty > 0)
    );
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
  `);
}

async function getProfile(userId) {
  const r = await pool.query(`SELECT * FROM user_profiles WHERE user_id=$1`, [userId]);
  return r.rows[0] || null;
}

async function upsertProfile(userId, p) {
  await pool.query(
    `
    INSERT INTO user_profiles(user_id, full_name, email, address1, address2, city, postcode, country, updated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW())
    ON CONFLICT(user_id) DO UPDATE SET
      full_name=EXCLUDED.full_name,
      email=EXCLUDED.email,
      address1=EXCLUDED.address1,
      address2=EXCLUDED.address2,
      city=EXCLUDED.city,
      postcode=EXCLUDED.postcode,
      country=EXCLUDED.country,
      updated_at=NOW()
    `,
    [userId, p.full_name, p.email, p.address1, p.address2 || "", p.city, p.postcode, p.country]
  );
}

async function getOrCreateOpenCart(userId) {
  const existing = await pool.query(`SELECT * FROM carts WHERE user_id=$1 AND status='OPEN' ORDER BY id DESC LIMIT 1`, [userId]);
  if (existing.rows[0]) return existing.rows[0];
  const created = await pool.query(`INSERT INTO carts(user_id,status) VALUES($1,'OPEN') RETURNING *`, [userId]);
  return created.rows[0];
}

async function getCartItems(cartId) {
  const r = await pool.query(`SELECT * FROM cart_items WHERE cart_id=$1 ORDER BY id ASC`, [cartId]);
  return r.rows;
}

async function addCartItem(cartId, item) {
  await pool.query(
    `
    INSERT INTO cart_items(cart_id, category_id, product_id, product_name, unit_price, size, colour, qty)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)
    `,
    [cartId, item.category_id, item.product_id, item.product_name, item.unit_price, item.size, item.colour, item.qty]
  );
  await pool.query(`UPDATE carts SET updated_at=NOW() WHERE id=$1`, [cartId]);
}

async function updateCartItemQty(cartItemId, qty) {
  await pool.query(`UPDATE cart_items SET qty=$1, updated_at=NOW() WHERE id=$2`, [qty, cartItemId]);
}

async function removeCartItem(cartItemId) {
  await pool.query(`DELETE FROM cart_items WHERE id=$1`, [cartItemId]);
}

async function clearCart(cartId) {
  await pool.query(`DELETE FROM cart_items WHERE cart_id=$1`, [cartId]);
}

function money(n) {
  return `£${Number(n).toFixed(2)}`;
}

function findCategory(catId) {
  return CATALOG.find(c => c.id === catId);
}

function findProduct(catId, productId) {
  const cat = findCategory(catId);
  if (!cat) return null;
  return cat.products.find(p => p.id === productId) || null;
}

/**
 * =========================
 * DISCORD
 * =========================
 */
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel]
});

const COMMANDS = [
  {
    name: "setupshop",
    description: "Post (or refresh) the shop menu message in the menu channel."
  },
  {
    name: "resetprofile",
    description: "Delete your saved shipping profile (you will be prompted again)."
  },
  {
    name: "clearcart",
    description: "Clear your current cart."
  }
];

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: COMMANDS });
  console.log("✅ Slash commands registered");
}

function buildMenuMessageComponents() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("OPEN_MENU")
      .setLabel("Click to see our menu")
      .setStyle(ButtonStyle.Primary)
  );
  return [row];
}

function buildCategorySelect() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("SELECT_CATEGORY")
      .setPlaceholder("Choose a category...")
      .addOptions(
        CATALOG.map(c => ({
          label: c.name,
          value: c.id
        }))
      )
  );
}

function buildProductSelect(catId) {
  const cat = findCategory(catId);
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`SELECT_PRODUCT:${catId}`)
      .setPlaceholder("Choose an item...")
      .addOptions(
        cat.products.map(p => ({
          label: `${p.name} — ${money(p.price)}`,
          value: p.id
        }))
      )
  );
}

function buildSizeSelect(catId, productId) {
  const p = findProduct(catId, productId);
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`SELECT_SIZE:${catId}:${productId}`)
      .setPlaceholder("Choose a size...")
      .addOptions(
        p.sizes.map(s => ({
          label: s,
          value: s
        }))
      )
  );
}

function buildColourSelect(catId, productId, size) {
  const p = findProduct(catId, productId);
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`SELECT_COLOUR:${catId}:${productId}:${encodeURIComponent(size)}`)
      .setPlaceholder("Choose a colour...")
      .addOptions(
        p.colours.map(c => ({
          label: c,
          value: c
        }))
      )
  );
}

function buildQtyButtons(catId, productId, size, colour) {
  const base = `QTY:${catId}:${productId}:${encodeURIComponent(size)}:${encodeURIComponent(colour)}:`;
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(base + "1").setLabel("1").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(base + "2").setLabel("2").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(base + "3").setLabel("3").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(base + "4").setLabel("4").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(base + "5").setLabel("5").setStyle(ButtonStyle.Secondary)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(base + "6").setLabel("6").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(base + "7").setLabel("7").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(base + "8").setLabel("8").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(base + "9").setLabel("9").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(base + "OTHER").setLabel("Other…").setStyle(ButtonStyle.Primary)
  );
  return [row1, row2];
}

function buildCartControls() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("CART_ADD_MORE").setLabel("Add Another Item").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("CART_CHECKOUT").setLabel("Submit Order ✅").setStyle(ButtonStyle.Success)
  );
}

function buildShippingModal(existingProfile) {
  const modal = new ModalBuilder().setCustomId("SHIPPING_MODAL").setTitle("Shipping details");

  const fullName = new TextInputBuilder()
    .setCustomId("full_name")
    .setLabel("Full name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(existingProfile?.full_name || "");

  const email = new TextInputBuilder()
    .setCustomId("email")
    .setLabel("Email")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(existingProfile?.email || "");

  const address1 = new TextInputBuilder()
    .setCustomId("address1")
    .setLabel("Address line 1")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(existingProfile?.address1 || "");

  const address2 = new TextInputBuilder()
    .setCustomId("address2")
    .setLabel("Address line 2 (optional)")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setValue(existingProfile?.address2 || "");

  const cityPost = new TextInputBuilder()
    .setCustomId("city_postcode_country")
    .setLabel("City, Postcode, Country (comma separated)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(
      existingProfile
        ? `${existingProfile.city}, ${existingProfile.postcode}, ${existingProfile.country}`
        : "London, SW1A 1AA, UK"
    );

  modal.addComponents(
    new ActionRowBuilder().addComponents(fullName),
    new ActionRowBuilder().addComponents(email),
    new ActionRowBuilder().addComponents(address1),
    new ActionRowBuilder().addComponents(address2),
    new ActionRowBuilder().addComponents(cityPost)
  );

  return modal;
}

async function renderCartEmbed(userId) {
  const cart = await getOrCreateOpenCart(userId);
  const items = await getCartItems(cart.id);

  if (items.length === 0) {
    const empty = new EmbedBuilder()
      .setTitle(`${SHOP_NAME} — Your basket`)
      .setDescription("Your basket is empty. Add an item to continue.")
      .setColor(0x5865f2);
    return { embed: empty, components: [buildCategorySelect()] };
  }

  const subtotal = items.reduce((sum, i) => sum + Number(i.unit_price) * i.qty, 0);
  const shippingFee = SHIPPING_FLAT_FEE;
  const total = subtotal + shippingFee;

  const lines = items.map(i => `• **${i.product_name}** (${i.size}, ${i.colour}) × **${i.qty}** — ${money(Number(i.unit_price) * i.qty)}`);

  const embed = new EmbedBuilder()
    .setTitle(`${SHOP_NAME} — Your basket`)
    .setDescription(lines.join("\n"))
    .addFields(
      { name: "Subtotal", value: money(subtotal), inline: true },
      { name: "Shipping", value: money(shippingFee), inline: true },
      { name: "Total", value: money(total), inline: true }
    )
    .setColor(0x57f287);

  // Build per-item buttons (update/remove) in rows of 2 items (Discord limit)
  const itemControls = [];
  for (const i of items) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ITEM_UPDATE:${i.id}`)
        .setLabel(`Update Qty: ${i.product_name}`)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`ITEM_REMOVE:${i.id}`)
        .setLabel("Remove 🗑️")
        .setStyle(ButtonStyle.Danger)
    );
    itemControls.push(row);
    if (itemControls.length >= 5) break; // avoid too many component rows
  }

  return { embed, components: [...itemControls, buildCartControls()] };
}

async function postOrRefreshMenuMessage(guild) {
  const channel = await guild.channels.fetch(MENU_CHANNEL_ID);
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error("MENU_CHANNEL_ID must be a text channel in the server.");
  }

  const embed = new EmbedBuilder()
    .setTitle(`Welcome to ${SHOP_NAME}!`)
    .setDescription(
      [
        "**How it works:**",
        "1) Click the button below to get started",
        "2) Enter your shipping details",
        "3) Browse categories and select items",
        "4) Add multiple items to your basket",
        "5) Submit your order when you're done",
        "",
        "Once submitted, your order is sent to the team for invoicing and payment confirmation."
      ].join("\n")
    )
    .setColor(0x5865f2);

  await channel.send({ embeds: [embed], components: buildMenuMessageComponents() });
}

/**
 * =========================
 * INTERACTIONS
 * =========================
 */
client.on("interactionCreate", async (interaction) => {
  try {
    // Slash commands
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "setupshop") {
        await interaction.deferReply({ ephemeral: true });
        await postOrRefreshMenuMessage(interaction.guild);
        return interaction.editReply("✅ Posted the shop menu message in the menu channel.");
      }

      if (interaction.commandName === "resetprofile") {
        await interaction.deferReply({ ephemeral: true });
        await pool.query(`DELETE FROM user_profiles WHERE user_id=$1`, [interaction.user.id]);
        return interaction.editReply("✅ Your shipping profile was deleted. You’ll be prompted again next time.");
      }

      if (interaction.commandName === "clearcart") {
        await interaction.deferReply({ ephemeral: true });
        const cart = await getOrCreateOpenCart(interaction.user.id);
        await clearCart(cart.id);
        return interaction.editReply("✅ Your basket has been cleared.");
      }
    }

    // Button: open menu
    if (interaction.isButton() && interaction.customId === "OPEN_MENU") {
      const existing = await getProfile(interaction.user.id);
      if (!existing) {
        const modal = buildShippingModal(null);
        return interaction.showModal(modal);
      }

      await interaction.reply({
        ephemeral: true,
        content: "Choose a category to start shopping:",
        components: [buildCategorySelect()]
      });
      return;
    }

    // Shipping modal submission
    if (interaction.isModalSubmit() && interaction.customId === "SHIPPING_MODAL") {
      await interaction.deferReply({ ephemeral: true });

      const full_name = interaction.fields.getTextInputValue("full_name").trim();
      const email = interaction.fields.getTextInputValue("email").trim();
      const address1 = interaction.fields.getTextInputValue("address1").trim();
      const address2 = interaction.fields.getTextInputValue("address2").trim();
      const cityPost = interaction.fields.getTextInputValue("city_postcode_country").trim();

      const parts = cityPost.split(",").map(s => s.trim()).filter(Boolean);
      const city = parts[0] || "";
      const postcode = parts[1] || "";
      const country = parts[2] || "";

      if (!city || !postcode || !country) {
        return interaction.editReply("❌ Please enter **City, Postcode, Country** separated by commas (e.g., `London, SW1A 1AA, UK`).");
      }

      await upsertProfile(interaction.user.id, { full_name, email, address1, address2, city, postcode, country });

      return interaction.editReply({
        content: "✅ Shipping details saved. Now choose a category:",
        components: [buildCategorySelect()]
      });
    }

    // Category select
    if (interaction.isStringSelectMenu() && interaction.customId === "SELECT_CATEGORY") {
      await interaction.deferUpdate();
      const catId = interaction.values[0];

      // Safety: ensure shipping exists before proceeding
      const profile = await getProfile(interaction.user.id);
      if (!profile) {
        // If they somehow got here without shipping, force modal next time
        return interaction.followUp({ ephemeral: true, content: "Please enter shipping details first by clicking the menu button again." });
      }

      return interaction.followUp({
        ephemeral: true,
        content: `Category: **${findCategory(catId)?.name || catId}** — choose an item:`,
        components: [buildProductSelect(catId)]
      });
    }

    // Product select
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("SELECT_PRODUCT:")) {
      await interaction.deferUpdate();
      const [, catId] = interaction.customId.split(":");
      const productId = interaction.values[0];

      const p = findProduct(catId, productId);
      if (!p) return interaction.followUp({ ephemeral: true, content: "❌ Product not found. Try again." });

      return interaction.followUp({
        ephemeral: true,
        content: `**${p.name}** — choose a size:`,
        components: [buildSizeSelect(catId, productId)]
      });
    }

    // Size select
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("SELECT_SIZE:")) {
      await interaction.deferUpdate();
      const [, catId, productId] = interaction.customId.split(":");
      const size = interaction.values[0];

      return interaction.followUp({
        ephemeral: true,
        content: `Size **${size}** — choose a colour:`,
        components: [buildColourSelect(catId, productId, size)]
      });
    }

    // Colour select
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("SELECT_COLOUR:")) {
      await interaction.deferUpdate();
      const parts = interaction.customId.split(":");
      const catId = parts[1];
      const productId = parts[2];
      const size = decodeURIComponent(parts[3]);
      const colour = interaction.values[0];

      const p = findProduct(catId, productId);
      if (!p) return interaction.followUp({ ephemeral: true, content: "❌ Product not found. Try again." });

      return interaction.followUp({
        ephemeral: true,
        content: `Colour **${colour}** — how many?`,
        components: buildQtyButtons(catId, productId, size, colour)
      });
    }

    // Qty buttons
    if (interaction.isButton() && interaction.customId.startsWith("QTY:")) {
      await interaction.deferUpdate();

      const parts = interaction.customId.split(":");
      // QTY:catId:productId:size:colour:qty
      const catId = parts[1];
      const productId = parts[2];
      const size = decodeURIComponent(parts[3]);
      const colour = decodeURIComponent(parts[4]);
      const qtyRaw = parts[5];

      const p = findProduct(catId, productId);
      if (!p) return interaction.followUp({ ephemeral: true, content: "❌ Product not found. Try again." });

      if (qtyRaw === "OTHER") {
        // simplest "Other": just tell them to pick one of 1-9 for now
        return interaction.followUp({
          ephemeral: true,
          content: "For now, please choose a quantity between **1–9**. (If you want >9, tell me and I’ll add a numeric modal.)"
        });
      }

      const qty = Number(qtyRaw);
      if (!Number.isInteger(qty) || qty < 1) return interaction.followUp({ ephemeral: true, content: "❌ Invalid quantity." });

      // Ensure shipping exists
      const profile = await getProfile(interaction.user.id);
      if (!profile) {
        return interaction.followUp({ ephemeral: true, content: "Please enter shipping details first by clicking the menu button again." });
      }

      const cart = await getOrCreateOpenCart(interaction.user.id);
      await addCartItem(cart.id, {
        category_id: catId,
        product_id: productId,
        product_name: p.name,
        unit_price: p.price,
        size,
        colour,
        qty
      });

      const { embed, components } = await renderCartEmbed(interaction.user.id);
      return interaction.followUp({
        ephemeral: true,
        content: "✅ Added to basket.",
        embeds: [embed],
        components
      });
    }

    // Cart add more
    if (interaction.isButton() && interaction.customId === "CART_ADD_MORE") {
      await interaction.deferUpdate();
      return interaction.followUp({
        ephemeral: true,
        content: "Choose a category:",
        components: [buildCategorySelect()]
      });
    }

    // Remove item
    if (interaction.isButton() && interaction.customId.startsWith("ITEM_REMOVE:")) {
      await interaction.deferUpdate();
      const id = Number(interaction.customId.split(":")[1]);
      if (!Number.isFinite(id)) return interaction.followUp({ ephemeral: true, content: "❌ Invalid item id." });

      await removeCartItem(id);
      const { embed, components } = await renderCartEmbed(interaction.user.id);

      return interaction.followUp({
        ephemeral: true,
        content: "🗑️ Item removed.",
        embeds: [embed],
        components
      });
    }

    // Update qty (simple: cycles prompt to use +1/-1 buttons could be added; we’ll use a quick select)
    if (interaction.isButton() && interaction.customId.startsWith("ITEM_UPDATE:")) {
      await interaction.deferReply({ ephemeral: true });

      const id = Number(interaction.customId.split(":")[1]);
      if (!Number.isFinite(id)) return interaction.editReply("❌ Invalid item id.");

      const modal = new ModalBuilder().setCustomId(`UPDATE_QTY_MODAL:${id}`).setTitle("Update quantity");
      const qtyInput = new TextInputBuilder()
        .setCustomId("qty")
        .setLabel("Enter new quantity (1–9)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue("1");

      modal.addComponents(new ActionRowBuilder().addComponents(qtyInput));
      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("UPDATE_QTY_MODAL:")) {
      await interaction.deferReply({ ephemeral: true });

      const id = Number(interaction.customId.split(":")[1]);
      const qty = Number(interaction.fields.getTextInputValue("qty").trim());
      if (!Number.isInteger(qty) || qty < 1 || qty > 9) {
        return interaction.editReply("❌ Quantity must be a whole number between **1–9**.");
      }

      await updateCartItemQty(id, qty);

      const { embed, components } = await renderCartEmbed(interaction.user.id);
      return interaction.editReply({
        content: "✅ Quantity updated.",
        embeds: [embed],
        components
      });
    }

    // Checkout
    if (interaction.isButton() && interaction.customId === "CART_CHECKOUT") {
      await interaction.deferReply({ ephemeral: true });

      const profile = await getProfile(interaction.user.id);
      if (!profile) {
        return interaction.editReply("❌ You must enter shipping details before checkout. Click the menu button again.");
      }

      const cart = await getOrCreateOpenCart(interaction.user.id);
      const items = await getCartItems(cart.id);

      if (items.length === 0) {
        return interaction.editReply("Your basket is empty.");
      }

      const subtotal = items.reduce((sum, i) => sum + Number(i.unit_price) * i.qty, 0);
      const shippingFee = SHIPPING_FLAT_FEE;
      const total = subtotal + shippingFee;

      // Post to staff orders channel
      const staffChannel = await client.channels.fetch(ORDERS_CHANNEL_ID);
      if (!staffChannel || staffChannel.type !== ChannelType.GuildText) {
        return interaction.editReply("❌ Staff orders channel not found. Check ORDERS_CHANNEL_ID.");
      }

      const orderLines = items.map(i => `• **${i.product_name}** (${i.size}, ${i.colour}) × **${i.qty}** — ${money(Number(i.unit_price) * i.qty)}`).join("\n");

      const orderEmbed = new EmbedBuilder()
        .setTitle(`🧾 New Order — ${interaction.user.username}`)
        .setDescription(orderLines)
        .addFields(
          { name: "Customer", value: `<@${interaction.user.id}>`, inline: true },
          { name: "Email", value: profile.email, inline: true },
          {
            name: "Shipping Address",
            value: `${profile.full_name}\n${profile.address1}${profile.address2 ? `\n${profile.address2}` : ""}\n${profile.city}\n${profile.postcode}\n${profile.country}`,
            inline: false
          },
          { name: "Subtotal", value: money(subtotal), inline: true },
          { name: "Shipping", value: money(shippingFee), inline: true },
          { name: "Total", value: money(total), inline: true }
        )
        .setColor(0xfee75c)
        .setTimestamp(new Date());

      const staffMsg = await staffChannel.send({
        content: `<@&${STAFF_ROLE_ID}> **New order received**`,
        embeds: [orderEmbed]
      });

      // Save order + items in DB
      const orderRow = await pool.query(
        `INSERT INTO orders(user_id, staff_channel_id, staff_message_id, subtotal, shipping_fee, total)
         VALUES($1,$2,$3,$4,$5,$6)
         RETURNING *`,
        [interaction.user.id, String(ORDERS_CHANNEL_ID), String(staffMsg.id), subtotal, shippingFee, total]
      );

      const orderId = orderRow.rows[0].id;

      for (const i of items) {
        await pool.query(
          `INSERT INTO order_items(order_id, product_name, unit_price, size, colour, qty)
           VALUES($1,$2,$3,$4,$5,$6)`,
          [orderId, i.product_name, i.unit_price, i.size, i.colour, i.qty]
        );
      }

      // Optional: create a thread for staff <-> buyer comms (fails gracefully if perms not available)
      try {
        const thread = await staffMsg.startThread({
          name: `order-${interaction.user.username}-${orderId}`,
          autoArchiveDuration: 1440
        });

        // Add buyer (optional). If this fails due to permissions, it’s not fatal.
        try { await thread.members.add(interaction.user.id); } catch (_) {}

        // Post a short thread note
        await thread.send(`Order **#${orderId}** thread. Use this for updates/invoicing.`);
      } catch (_) {
        // ignore
      }

      // Clear cart after checkout
      await clearCart(cart.id);

      return interaction.editReply("✅ Order submitted! The team will follow up with invoicing / payment confirmation.");
    }

  } catch (err) {
    console.error("Interaction error:", err);

    // If interaction already replied/deferred, followUp; otherwise reply
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ ephemeral: true, content: "❌ Something went wrong. Please try again." });
      } else {
        await interaction.reply({ ephemeral: true, content: "❌ Something went wrong. Please try again." });
      }
    } catch (_) {}
  }
});

/**
 * =========================
 * STARTUP
 * =========================
 */
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

(async () => {
  await migrate();
  await registerCommands();
  await client.login(BOT_TOKEN);
})();
