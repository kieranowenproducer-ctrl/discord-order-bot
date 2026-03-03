// index.js
// Discord Shop Bot (discord.js v14 + Postgres)
// - No cart_json usage (fixes your earlier issue)
// - Modal limited to 5 inputs (fixes Invalid Form Body error)
// - Creates private receipt channels for each order, staff can add payment link

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

const ORDERS_CATEGORY_ID = process.env.ORDERS_CATEGORY_ID; // category where private receipt channels are created
const ORDERS_CHANNEL_ID = process.env.ORDERS_CHANNEL_ID;   // optional (not required for this version)
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;

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
  // Railway Postgres typically requires SSL in production
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

async function initDb() {
  // We use a proper relational schema (no cart_json), so you won't hit that error again.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY,
      full_name TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shipping_profiles (
      user_id TEXT PRIMARY KEY REFERENCES user_profiles(user_id) ON DELETE CASCADE,
      address TEXT,
      city TEXT,
      postcode TEXT,
      country TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS carts (
      cart_id BIGSERIAL PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
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
      address TEXT,
      city TEXT,
      postcode TEXT,
      country TEXT,
      subtotal_pence INT NOT NULL,
      shipping_pence INT NOT NULL,
      total_pence INT NOT NULL,
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
      sku TEXT NOT NULL,
      name TEXT NOT NULL,
      size TEXT NOT NULL,
      color TEXT NOT NULL,
      qty INT NOT NULL CHECK (qty > 0),
      price_pence INT NOT NULL CHECK (price_pence >= 0)
    );
  `);
}

async function upsertProfile(userId, fullName, shipping) {
  await pool.query(
    `
    INSERT INTO user_profiles (user_id, full_name, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET full_name = EXCLUDED.full_name, updated_at = NOW();
    `,
    [userId, fullName]
  );

  await pool.query(
    `
    INSERT INTO shipping_profiles (user_id, address, city, postcode, country, updated_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET address = EXCLUDED.address,
        city = EXCLUDED.city,
        postcode = EXCLUDED.postcode,
        country = EXCLUDED.country,
        updated_at = NOW();
    `,
    [userId, shipping.address, shipping.city, shipping.postcode, shipping.country]
  );
}

async function getOrCreateCart(userId) {
  const existing = await pool.query(`SELECT cart_id FROM carts WHERE user_id=$1 AND status='open'`, [userId]);
  if (existing.rows.length) return existing.rows[0].cart_id;

  const created = await pool.query(
    `INSERT INTO carts (user_id, status, updated_at) VALUES ($1, 'open', NOW()) RETURNING cart_id`,
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

function money(pence) {
  return `£${(pence / 100).toFixed(2)}`;
}

/* ----------------------------- SHOP CATALOG ----------------------------- */

const SHIPPING_PENCE = 499;

const CATALOG = {
  "T-Shirts": [
    { sku: "TSHIRT-001", name: "T-Shirt", price_pence: 1999, sizes: ["S", "M", "L", "XL"], colors: ["White", "Black", "Grey"] },
  ],
  Hoodies: [
    { sku: "HOODIE-001", name: "Hoodie", price_pence: 3999, sizes: ["S", "M", "L", "XL"], colors: ["Grey", "Black"] },
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
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("open_menu")
      .setLabel("Click to see our menu")
      .setStyle(ButtonStyle.Primary)
  );
  return [row];
}

function categorySelectComponents() {
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("select_category")
      .setPlaceholder("Choose a category…")
      .addOptions(categoryOptions)
  );
  return [row];
}

function itemSelectComponents(category) {
  const items = CATALOG[category] || [];
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`select_item:${category}`)
      .setPlaceholder("Choose an item…")
      .addOptions(
        items.map((it) => ({
          label: `${it.name} — ${money(it.price_pence)}`,
          value: it.sku,
        }))
      )
  );
  return [row];
}

function sizeSelectComponents(category, sku) {
  const item = (CATALOG[category] || []).find((x) => x.sku === sku);
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`select_size:${category}:${sku}`)
      .setPlaceholder("Choose a size…")
      .addOptions(item.sizes.map((s) => ({ label: s, value: s })))
  );
  return [row];
}

function colorSelectComponents(category, sku, size) {
  const item = (CATALOG[category] || []).find((x) => x.sku === sku);
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`select_color:${category}:${sku}:${size}`)
      .setPlaceholder("Choose a colour…")
      .addOptions(item.colors.map((c) => ({ label: c, value: c })))
  );
  return [row];
}

function qtyButtonsComponents(category, sku, size, color) {
  const row1 = new ActionRowBuilder().addComponents(
    ...[1, 2, 3, 4, 5].map((n) =>
      new ButtonBuilder()
        .setCustomId(`add_qty:${category}:${sku}:${size}:${color}:${n}`)
        .setLabel(String(n))
        .setStyle(ButtonStyle.Secondary)
    )
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`add_qty_other:${category}:${sku}:${size}:${color}`)
      .setLabel("Other…")
      .setStyle(ButtonStyle.Primary)
  );

  return [row1, row2];
}

function cartActionsComponents() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("cart_add_more").setLabel("Add Another Item").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("cart_submit").setLabel("Submit Order ✅").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("cart_clear").setLabel("Clear Cart").setStyle(ButtonStyle.Danger)
  );
  return [row];
}

/* -------------------------- MODALS (MAX 5 INPUTS) ------------------------- */

function shippingModal() {
  // Exactly 5 fields (Discord modal limit)
  const modal = new ModalBuilder().setCustomId("shipping_modal").setTitle("Shipping details");

  const fullName = new TextInputBuilder()
    .setCustomId("full_name")
    .setLabel("Full name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const address = new TextInputBuilder()
    .setCustomId("address")
    .setLabel("Address")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  const city = new TextInputBuilder()
    .setCustomId("city")
    .setLabel("City")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const postcode = new TextInputBuilder()
    .setCustomId("postcode")
    .setLabel("Postcode")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const country = new TextInputBuilder()
    .setCustomId("country")
    .setLabel("Country")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(fullName),
    new ActionRowBuilder().addComponents(address),
    new ActionRowBuilder().addComponents(city),
    new ActionRowBuilder().addComponents(postcode),
    new ActionRowBuilder().addComponents(country)
  );

  return modal;
}

function qtyOtherModal(category, sku, size, color) {
  const modal = new ModalBuilder()
    .setCustomId(`qty_other_modal:${category}:${sku}:${size}:${color}`)
    .setTitle("Quantity");

  const qty = new TextInputBuilder()
    .setCustomId("qty")
    .setLabel("Enter quantity (number)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(qty));
  return modal;
}

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
      // @everyone denied
      {
        id: guild.roles.everyone.id,
        deny: ["ViewChannel"],
      },
      // customer allowed
      {
        id: user.id,
        allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
      },
      // staff role allowed
      {
        id: STAFF_ROLE_ID,
        allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
      },
      // bot allowed
      {
        id: guild.members.me.id,
        allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "ManageChannels"],
      },
    ],
  });

  return channel;
}

function receiptEmbed(orderId, items, subtotal, shipping, total, shippingProfile) {
  const lines = items.map(
    (it) => `• **${it.name}** (${it.size}, ${it.color}) × ${it.qty} — ${money(it.qty * it.price_pence)}`
  );

  return new EmbedBuilder()
    .setTitle(`Clothing Shop — Receipt (Order #${orderId})`)
    .setDescription(lines.join("\n") || "_No items_")
    .addFields(
      { name: "Subtotal", value: money(subtotal), inline: true },
      { name: "Shipping", value: money(shipping), inline: true },
      { name: "Total", value: money(total), inline: true },
      {
        name: "Shipping to",
        value: `${shippingProfile.full_name}\n${shippingProfile.address}\n${shippingProfile.city}\n${shippingProfile.postcode}\n${shippingProfile.country}`,
      }
    )
    .setFooter({ text: "Staff: use the button below to add a payment link." });
}

function staffReceiptControls(orderId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`staff_add_paylink:${orderId}`)
        .setLabel("Add payment link")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`staff_mark_paid:${orderId}`)
        .setLabel("Mark as paid ✅")
        .setStyle(ButtonStyle.Success)
    ),
  ];
}

/* ------------------------------ INTERACTIONS ----------------------------- */

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "ping") {
        return interaction.reply({ content: "pong ✅", ephemeral: true });
      }

      if (interaction.commandName === "setupshop") {
        const menuChannel = await client.channels.fetch(MENU_CHANNEL_ID);

        const content =
          `**Welcome to Clothing Shop!**\n\n` +
          `**How it works:**\n` +
          `1) Click the button below to get started\n` +
          `2) Enter your shipping details\n` +
          `3) Browse categories and select items\n` +
          `4) Add multiple items to your basket\n` +
          `5) Submit your order when you're done\n\n` +
          `Once submitted, you'll receive a **private receipt channel** where the team can send your payment link.`;

        await menuChannel.send({
          content,
          components: menuMessageComponents(),
        });

        return interaction.reply({ content: "✅ Shop menu message posted/refreshed in the menu channel.", ephemeral: true });
      }
    }

    /* ------------------------------ BUTTONS ------------------------------ */

    if (interaction.isButton()) {
      const { customId } = interaction;

      if (customId === "open_menu") {
        // Step 1: force shipping details (5-field modal)
        return interaction.showModal(shippingModal());
      }

      if (customId.startsWith("add_qty:")) {
        const [, category, sku, size, color, qtyStr] = customId.split(":");
        const qty = parseInt(qtyStr, 10);

        const item = (CATALOG[category] || []).find((x) => x.sku === sku);
        if (!item) return interaction.reply({ content: "Item not found.", ephemeral: true });

        await addCartItem(interaction.user.id, {
          sku: item.sku,
          name: item.name,
          size,
          color,
          qty,
          price_pence: item.price_pence,
        });

        const cart = await getCartSummary(interaction.user.id);

        const basketLines = cart.items.map(
          (it) => `• **${it.name}** (${it.size}, ${it.color}) × ${it.qty} — ${money(it.qty * it.price_pence)}`
        );

        return interaction.reply({
          content:
            `✅ **Added to basket.**\n\n` +
            `**Your basket**\n` +
            `${basketLines.join("\n")}\n\n` +
            `**Subtotal:** ${money(cart.subtotal_pence)}\n` +
            `**Shipping:** ${money(SHIPPING_PENCE)}\n` +
            `**Total:** ${money(cart.subtotal_pence + SHIPPING_PENCE)}`,
          components: cartActionsComponents(),
          ephemeral: true,
        });
      }

      if (customId.startsWith("add_qty_other:")) {
        const [, category, sku, size, color] = customId.split(":");
        return interaction.showModal(qtyOtherModal(category, sku, size, color));
      }

      if (customId === "cart_add_more") {
        // Go back to categories
        return interaction.reply({
          content: "Choose a category:",
          components: categorySelectComponents(),
          ephemeral: true,
        });
      }

      if (customId === "cart_clear") {
        await clearCart(interaction.user.id);
        return interaction.reply({ content: "🗑️ Cart cleared.", ephemeral: true });
      }

      if (customId === "cart_submit") {
        const cart = await getCartSummary(interaction.user.id);
        if (!cart.items.length) return interaction.reply({ content: "Your cart is empty.", ephemeral: true });

        // Fetch shipping/profile
        const profileRes = await pool.query(
          `
          SELECT up.full_name, sp.address, sp.city, sp.postcode, sp.country
          FROM user_profiles up
          JOIN shipping_profiles sp ON sp.user_id = up.user_id
          WHERE up.user_id = $1
          `,
          [interaction.user.id]
        );

        if (!profileRes.rows.length) {
          return interaction.reply({
            content: "I don't have your shipping details yet. Click the menu button again and enter your details.",
            ephemeral: true,
          });
        }

        const shippingProfile = profileRes.rows[0];
        const subtotal = cart.subtotal_pence;
        const shipping = SHIPPING_PENCE;
        const total = subtotal + shipping;

        // Create order
        const orderRes = await pool.query(
          `
          INSERT INTO orders (user_id, full_name, address, city, postcode, country, subtotal_pence, shipping_pence, total_pence, status)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')
          RETURNING order_id
          `,
          [
            interaction.user.id,
            shippingProfile.full_name,
            shippingProfile.address,
            shippingProfile.city,
            shippingProfile.postcode,
            shippingProfile.country,
            subtotal,
            shipping,
            total,
          ]
        );

        const orderId = orderRes.rows[0].order_id;

        // Copy cart_items -> order_items
        for (const it of cart.items) {
          await pool.query(
            `
            INSERT INTO order_items (order_id, sku, name, size, color, qty, price_pence)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            `,
            [orderId, it.sku, it.name, it.size, it.color, it.qty, it.price_pence]
          );
        }

        // Create receipt private channel
        const guild = interaction.guild;
        const receiptChannel = await createReceiptChannel(guild, interaction.user, orderId);

        // Update order with receipt channel id
        await pool.query(`UPDATE orders SET receipt_channel_id=$1 WHERE order_id=$2`, [receiptChannel.id, orderId]);

        // Post receipt + staff controls
        await receiptChannel.send({
          content: `<@${interaction.user.id}> **Thanks!** Your order has been received.\n<@&${STAFF_ROLE_ID}> please add a payment link below.`,
          embeds: [receiptEmbed(orderId, cart.items, subtotal, shipping, total, shippingProfile)],
          components: staffReceiptControls(orderId),
        });

        // Clear cart
        await clearCart(interaction.user.id);

        return interaction.reply({
          content: `✅ Order submitted! Your private receipt channel is: <#${receiptChannel.id}>`,
          ephemeral: true,
        });
      }

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

        return interaction.reply({
          content: `✅ Order #${orderId} marked as paid.`,
          ephemeral: false,
        });
      }
    }

    /* ------------------------------ SELECT MENUS ------------------------------ */

    if (interaction.isStringSelectMenu()) {
      const { customId } = interaction;

      if (customId === "select_category") {
        const category = interaction.values[0];
        return interaction.reply({
          content: `Now choose an item:`,
          components: itemSelectComponents(category),
          ephemeral: true,
        });
      }

      if (customId.startsWith("select_item:")) {
        const [, category] = customId.split(":");
        const sku = interaction.values[0];

        return interaction.reply({
          content: `Selected item. Choose a size:`,
          components: sizeSelectComponents(category, sku),
          ephemeral: true,
        });
      }

      if (customId.startsWith("select_size:")) {
        const [, category, sku] = customId.split(":");
        const size = interaction.values[0];

        return interaction.reply({
          content: `Size **${size}** selected. Choose a colour:`,
          components: colorSelectComponents(category, sku, size),
          ephemeral: true,
        });
      }

      if (customId.startsWith("select_color:")) {
        const [, category, sku, size] = customId.split(":");
        const color = interaction.values[0];

        return interaction.reply({
          content: `Colour **${color}** selected — how many?`,
          components: qtyButtonsComponents(category, sku, size, color),
          ephemeral: true,
        });
      }
    }

    /* ------------------------------ MODAL SUBMITS ------------------------------ */

    if (interaction.isModalSubmit()) {
      const { customId } = interaction;

      if (customId === "shipping_modal") {
        const full_name = interaction.fields.getTextInputValue("full_name")?.trim();
        const address = interaction.fields.getTextInputValue("address")?.trim();
        const city = interaction.fields.getTextInputValue("city")?.trim();
        const postcode = interaction.fields.getTextInputValue("postcode")?.trim();
        const country = interaction.fields.getTextInputValue("country")?.trim();

        if (!full_name || !address || !city || !postcode || !country) {
          return interaction.reply({ content: "All fields are required.", ephemeral: true });
        }

        await upsertProfile(interaction.user.id, full_name, { address, city, postcode, country });

        // After shipping saved, show categories
        return interaction.reply({
          content: "✅ Details saved. Choose a category:",
          components: categorySelectComponents(),
          ephemeral: true,
        });
      }

      if (customId.startsWith("qty_other_modal:")) {
        const [, category, sku, size, color] = customId.split(":");
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
          size,
          color,
          qty,
          price_pence: item.price_pence,
        });

        const cart = await getCartSummary(interaction.user.id);
        const basketLines = cart.items.map(
          (it) => `• **${it.name}** (${it.size}, ${it.color}) × ${it.qty} — ${money(it.qty * it.price_pence)}`
        );

        return interaction.reply({
          content:
            `✅ **Added to basket.**\n\n` +
            `**Your basket**\n` +
            `${basketLines.join("\n")}\n\n` +
            `**Subtotal:** ${money(cart.subtotal_pence)}\n` +
            `**Shipping:** ${money(SHIPPING_PENCE)}\n` +
            `**Total:** ${money(cart.subtotal_pence + SHIPPING_PENCE)}`,
          components: cartActionsComponents(),
          ephemeral: true,
        });
      }

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
  } catch (err) {
    console.error(err);
    if (interaction.isRepliable()) {
      try {
        await interaction.reply({ content: `❌ Error: ${err.message}`, ephemeral: true });
      } catch {
        // ignore
      }
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
