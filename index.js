require("dotenv").config();

const {
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
  ChannelType,
  PermissionsBitField,
} = require("discord.js");

const { Pool } = require("pg");

// =====================
// ENV (Railway Variables)
// =====================
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// Where the menu is posted / customers order (e.g. #order-here)
const MENU_CHANNEL_ID = process.env.MENU_CHANNEL_ID;

// Role that represents your staff (can see orders)
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;

// Category where private order channels will be created
const ORDERS_CATEGORY_ID = process.env.ORDERS_CATEGORY_ID;

// Optional DB (Railway Postgres): DATABASE_URL or PG* vars
const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_PRIVATE_URL;

// Hard fail if core env missing
if (!DISCORD_TOKEN) throw new Error("Missing DISCORD_TOKEN");
if (!CLIENT_ID) throw new Error("Missing CLIENT_ID");
if (!GUILD_ID) throw new Error("Missing GUILD_ID");
if (!MENU_CHANNEL_ID) throw new Error("Missing MENU_CHANNEL_ID");
if (!STAFF_ROLE_ID) throw new Error("Missing STAFF_ROLE_ID");
if (!ORDERS_CATEGORY_ID) throw new Error("Missing ORDERS_CATEGORY_ID");

// =====================
// Database (Postgres)
// =====================
const pool = DATABASE_URL
  ? new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

// If no DB, we will still work but shipping/cart resets on restart.
const memory = {
  shipping: new Map(), // userId -> profile
  cart: new Map(),     // userId -> cart array
};

async function dbInit() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shipping_profiles (
      user_id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      line1 TEXT NOT NULL,
      line2 TEXT,
      city TEXT NOT NULL,
      postcode TEXT NOT NULL,
      country TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS carts (
      user_id TEXT PRIMARY KEY,
      cart_json JSONB NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}

async function getShippingProfile(userId) {
  if (!pool) return memory.shipping.get(userId) || null;
  const res = await pool.query(`SELECT * FROM shipping_profiles WHERE user_id=$1`, [userId]);
  if (!res.rows.length) return null;
  const r = res.rows[0];
  return {
    fullName: r.full_name,
    email: r.email,
    line1: r.line1,
    line2: r.line2 || "",
    city: r.city,
    postcode: r.postcode,
    country: r.country,
  };
}

async function upsertShippingProfile(userId, profile) {
  if (!pool) {
    memory.shipping.set(userId, profile);
    return;
  }
  await pool.query(
    `
    INSERT INTO shipping_profiles (user_id, full_name, email, line1, line2, city, postcode, country, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      full_name=EXCLUDED.full_name,
      email=EXCLUDED.email,
      line1=EXCLUDED.line1,
      line2=EXCLUDED.line2,
      city=EXCLUDED.city,
      postcode=EXCLUDED.postcode,
      country=EXCLUDED.country,
      updated_at=NOW()
    `,
    [
      userId,
      profile.fullName,
      profile.email,
      profile.line1,
      profile.line2 || "",
      profile.city,
      profile.postcode,
      profile.country,
    ]
  );
}

async function getCart(userId) {
  if (!pool) return memory.cart.get(userId) || [];
  const res = await pool.query(`SELECT cart_json FROM carts WHERE user_id=$1`, [userId]);
  if (!res.rows.length) return [];
  return res.rows[0].cart_json || [];
}

async function setCart(userId, cartArr) {
  if (!pool) {
    memory.cart.set(userId, cartArr);
    return;
  }
  await pool.query(
    `
    INSERT INTO carts (user_id, cart_json, updated_at)
    VALUES ($1,$2,NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      cart_json=EXCLUDED.cart_json,
      updated_at=NOW()
    `,
    [userId, cartArr]
  );
}

async function clearCart(userId) {
  await setCart(userId, []);
}

// =====================
// Catalog (Clothing Example)
// =====================
const SHIPPING_FLAT = 4.99;

const CATALOG = [
  {
    id: "hoodies",
    label: "Hoodies",
    items: [
      { id: "hoodie_classic", name: "Classic Hoodie", price: 39.99, sizes: ["XS","S","M","L","XL"], colours: ["Black","Grey","Navy","White"] },
      { id: "hoodie_zip", name: "Zip Hoodie", price: 44.99, sizes: ["S","M","L","XL"], colours: ["Black","Grey"] },
    ],
  },
  {
    id: "tshirts",
    label: "T-Shirts",
    items: [
      { id: "tee_classic", name: "Classic Tee", price: 19.99, sizes: ["XS","S","M","L","XL"], colours: ["Black","White","Navy"] },
      { id: "tee_oversized", name: "Oversized Tee", price: 24.99, sizes: ["S","M","L","XL"], colours: ["Black","Stone","White"] },
    ],
  },
  {
    id: "caps",
    label: "Caps",
    items: [
      { id: "cap_logo", name: "Logo Cap", price: 14.99, sizes: ["One Size"], colours: ["Black","Navy","White"] },
    ],
  },
];

// helpers
function money(n) {
  return `£${Number(n).toFixed(2)}`;
}

function findCategory(catId) {
  return CATALOG.find((c) => c.id === catId) || null;
}

function findItem(catId, itemId) {
  const c = findCategory(catId);
  if (!c) return null;
  return c.items.find((i) => i.id === itemId) || null;
}

function calcTotals(cart) {
  const subtotal = cart.reduce((sum, line) => sum + line.lineTotal, 0);
  const shipping = cart.length ? SHIPPING_FLAT : 0;
  const total = subtotal + shipping;
  return { subtotal, shipping, total };
}

function buildCartEmbed(cart) {
  const { subtotal, shipping, total } = calcTotals(cart);

  const lines = cart.length
    ? cart.map((l, idx) => {
        return `**${idx + 1}. ${l.name}** (${l.size}, ${l.colour}) × **${l.qty}** — ${money(l.lineTotal)}`;
      }).join("\n")
    : "_Your basket is empty._";

  const embed = new EmbedBuilder()
    .setTitle("Clothing Shop — Your basket")
    .setDescription(lines)
    .addFields(
      { name: "Subtotal", value: money(subtotal), inline: true },
      { name: "Shipping", value: money(shipping), inline: true },
      { name: "Total", value: money(total), inline: true }
    )
    .setFooter({ text: "Use the buttons below to add/remove items, then submit your order." });

  return embed;
}

function buildReceiptEmbed({ orderLabel, customerTag, profile, cart }) {
  const { subtotal, shipping, total } = calcTotals(cart);

  const itemsText = cart.map((l) => `• ${l.name} (${l.size}, ${l.colour}) × ${l.qty} — ${money(l.lineTotal)}`).join("\n");

  const address = [
    profile.fullName,
    profile.line1,
    profile.line2 || null,
    profile.city,
    profile.postcode,
    profile.country,
  ].filter(Boolean).join("\n");

  return new EmbedBuilder()
    .setTitle(`🧾 New Order — ${orderLabel}`)
    .setDescription(itemsText || "_No items_")
    .addFields(
      { name: "Customer", value: `${customerTag}`, inline: true },
      { name: "Email", value: profile.email, inline: true },
      { name: "Shipping Address", value: address, inline: false },
      { name: "Subtotal", value: money(subtotal), inline: true },
      { name: "Shipping", value: money(shipping), inline: true },
      { name: "Total", value: money(total), inline: true }
    )
    .setFooter({ text: "Post the payment link in this channel once ready." });
}

// =====================
// Discord Client
// =====================
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel],
});

// =====================
// Slash Commands
// =====================
const commands = [
  {
    name: "setupshop",
    description: "Post (or refresh) the shop menu message in the menu channel.",
  },
  {
    name: "resetprofile",
    description: "Delete your saved shipping profile (you will be prompted again).",
  },
  {
    name: "clearcart",
    description: "Clear your current cart.",
  },
];

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log("✅ Slash commands registered");
}

// =====================
// UI Builders
// =====================
function menuMessageComponents() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("start_order")
      .setLabel("Click to see our menu")
      .setStyle(ButtonStyle.Primary)
  );

  return [row];
}

function categorySelectRow() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("select_category")
    .setPlaceholder("Choose a category…")
    .addOptions(CATALOG.map((c) => ({ label: c.label, value: c.id })));

  return [new ActionRowBuilder().addComponents(menu)];
}

function itemSelectRow(catId) {
  const c = findCategory(catId);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`select_item:${catId}`)
    .setPlaceholder("Choose an item…")
    .addOptions(
      c.items.map((i) => ({
        label: `${i.name} — ${money(i.price)}`,
        value: i.id,
      }))
    );

  return [new ActionRowBuilder().addComponents(menu)];
}

function sizeSelectRow(catId, itemId) {
  const item = findItem(catId, itemId);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`select_size:${catId}:${itemId}`)
    .setPlaceholder("Choose a size…")
    .addOptions(item.sizes.map((s) => ({ label: s, value: s })));

  return [new ActionRowBuilder().addComponents(menu)];
}

function colourSelectRow(catId, itemId, size) {
  const item = findItem(catId, itemId);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`select_colour:${catId}:${itemId}:${encodeURIComponent(size)}`)
    .setPlaceholder("Choose a colour…")
    .addOptions(item.colours.map((c) => ({ label: c, value: c })));

  return [new ActionRowBuilder().addComponents(menu)];
}

function qtyButtonsRow(catId, itemId, size, colour) {
  const base = `qty:${catId}:${itemId}:${encodeURIComponent(size)}:${encodeURIComponent(colour)}:`;
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(base + "1").setLabel("1").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(base + "2").setLabel("2").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(base + "3").setLabel("3").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(base + "4").setLabel("4").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(base + "5").setLabel("5").setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(base + "6").setLabel("6").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(base + "7").setLabel("7").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(base + "8").setLabel("8").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(base + "9").setLabel("9").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(base + "other").setLabel("Other…").setStyle(ButtonStyle.Primary),
    ),
  ];
}

function basketActionRows(cart) {
  const rows = [];

  // "Update Qty" button per first line only (keep it simple)
  // You can extend later to per-line updates with selects.
  const hasItems = cart.length > 0;

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("basket_add_another")
        .setLabel("Add Another Item")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("basket_submit")
        .setLabel("Submit Order ✅")
        .setStyle(ButtonStyle.Success)
        .setDisabled(!hasItems),
    )
  );

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("basket_remove_last")
        .setLabel("Remove Last 🗑️")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!hasItems),
      new ButtonBuilder()
        .setCustomId("basket_clear")
        .setLabel("Clear Basket")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!hasItems),
    )
  );

  return rows;
}

// =====================
// Shipping Modal
// =====================
function buildShippingModal() {
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

  const line1 = new TextInputBuilder()
    .setCustomId("line1")
    .setLabel("Address line 1")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const line2 = new TextInputBuilder()
    .setCustomId("line2")
    .setLabel("Address line 2 (optional)")
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  const cityPostCountry = new TextInputBuilder()
    .setCustomId("city_post_country")
    .setLabel("City, Postcode, Country (comma separated)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("e.g. London, SW1A 1AA, UK");

  modal.addComponents(
    new ActionRowBuilder().addComponents(fullName),
    new ActionRowBuilder().addComponents(email),
    new ActionRowBuilder().addComponents(line1),
    new ActionRowBuilder().addComponents(line2),
    new ActionRowBuilder().addComponents(cityPostCountry),
  );

  return modal;
}

// =====================
// Private Order Channel (THE NEW PART)
// =====================
async function createPrivateOrderChannel({
  guild,
  customerId,
  staffRoleId,
  ordersCategoryId,
  channelName,
}) {
  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: ordersCategoryId,
    permissionOverwrites: [
      {
        id: guild.id, // @everyone
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
      {
        id: staffRoleId,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      },
      {
        id: customerId,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      },
      {
        id: guild.members.me.id, // bot
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ManageChannels,
        ],
      },
    ],
  });

  return channel;
}

// =====================
// Menu Posting
// =====================
async function postOrRefreshMenu(guild) {
  const channel = await guild.channels.fetch(MENU_CHANNEL_ID);
  if (!channel) throw new Error("MENU_CHANNEL_ID not found");

  const embed = new EmbedBuilder()
    .setTitle("Welcome to the Shop!")
    .setDescription(
      [
        "**How it works:**",
        "1) Click the button below to get started",
        "2) Enter your name, email and shipping address",
        "3) Browse categories and select items",
        "4) Add multiple items to your basket",
        "5) Submit your order when you're done",
        "",
        "✅ After submitting, a **private order channel** will be created for you where staff will send a payment link.",
      ].join("\n")
    );

  await channel.send({
    embeds: [embed],
    components: menuMessageComponents(),
  });
}

// =====================
// Interaction Handling
// =====================
client.on("interactionCreate", async (interaction) => {
  try {
    // Slash commands
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "setupshop") {
        await interaction.deferReply({ ephemeral: true });
        await postOrRefreshMenu(interaction.guild);
        await interaction.editReply("✅ Shop menu posted in the menu channel.");
        return;
      }

      if (interaction.commandName === "resetprofile") {
        await interaction.deferReply({ ephemeral: true });
        if (pool) {
          await pool.query(`DELETE FROM shipping_profiles WHERE user_id=$1`, [interaction.user.id]);
        } else {
          memory.shipping.delete(interaction.user.id);
        }
        await interaction.editReply("✅ Your shipping profile has been reset. You’ll be prompted again next time.");
        return;
      }

      if (interaction.commandName === "clearcart") {
        await interaction.deferReply({ ephemeral: true });
        await clearCart(interaction.user.id);
        await interaction.editReply("✅ Your cart has been cleared.");
        return;
      }
    }

    // Button interactions
    if (interaction.isButton()) {
      const userId = interaction.user.id;

      // Start Order
      if (interaction.customId === "start_order") {
        const profile = await getShippingProfile(userId);
        if (!profile) {
          // force shipping first
          await interaction.showModal(buildShippingModal());
          return;
        }

        // show categories (ephemeral)
        await interaction.reply({
          content: "Thanks! Choose a category:",
          components: categorySelectRow(),
          ephemeral: true,
        });
        return;
      }

      // Basket actions
      if (interaction.customId === "basket_add_another") {
        await interaction.reply({
          content: "Choose a category:",
          components: categorySelectRow(),
          ephemeral: true,
        });
        return;
      }

      if (interaction.customId === "basket_remove_last") {
        const cart = await getCart(userId);
        cart.pop();
        await setCart(userId, cart);

        await interaction.reply({
          content: cart.length ? "🗑️ Removed last item." : "🗑️ Basket is now empty.",
          embeds: [buildCartEmbed(cart)],
          components: basketActionRows(cart),
          ephemeral: true,
        });
        return;
      }

      if (interaction.customId === "basket_clear") {
        await clearCart(userId);
        const cart = [];
        await interaction.reply({
          content: "✅ Basket cleared.",
          embeds: [buildCartEmbed(cart)],
          components: basketActionRows(cart),
          ephemeral: true,
        });
        return;
      }

      // ✅ Submit Order -> Create PRIVATE order channel + receipt + ping staff
      if (interaction.customId === "basket_submit") {
        const profile = await getShippingProfile(userId);
        if (!profile) {
          await interaction.reply({
            content: "⚠️ Missing shipping details. Please start again and fill out your shipping info.",
            ephemeral: true,
          });
          return;
        }

        const cart = await getCart(userId);
        if (!cart.length) {
          await interaction.reply({ content: "Your basket is empty.", ephemeral: true });
          return;
        }

        // Create channel name
        const orderNumber = Date.now().toString().slice(-6);
        const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, "");
        const channelName = `order-${safeName}-${orderNumber}`;

        const orderChannel = await createPrivateOrderChannel({
          guild: interaction.guild,
          customerId: userId,
          staffRoleId: STAFF_ROLE_ID,
          ordersCategoryId: ORDERS_CATEGORY_ID,
          channelName,
        });

        const receipt = buildReceiptEmbed({
          orderLabel: channelName,
          customerTag: `<@${userId}>`,
          profile,
          cart,
        });

        await orderChannel.send({
          content: `@here <@&${STAFF_ROLE_ID}> **New order received** from <@${userId}>.\n\n**Post the Stripe payment link in this channel.**`,
          embeds: [receipt],
        });

        await orderChannel.send({
          content: `✅ **Customer:** this is your private order channel.\nStaff will send your payment link here shortly.`,
        });

        // Optional: DM the customer with the channel mention
        try {
          await interaction.user.send(`✅ Your order was received. Please check this channel for payment: ${orderChannel}`);
        } catch (_) {}

        // Confirm to customer in the menu channel (ephemeral)
        await interaction.reply({
          content: `✅ Order submitted! Your private order channel is: ${orderChannel}`,
          ephemeral: true,
        });

        // Clear cart after submit
        await clearCart(userId);
        return;
      }

      // Quantity buttons
      if (interaction.customId.startsWith("qty:")) {
        // qty:catId:itemId:size:colour:qty
        const parts = interaction.customId.split(":");
        const catId = parts[1];
        const itemId = parts[2];
        const size = decodeURIComponent(parts[3]);
        const colour = decodeURIComponent(parts[4]);
        const qtyStr = parts[5];

        if (qtyStr === "other") {
          await interaction.reply({
            content: "Type a quantity number (1–99) in the chat, then press Enter.",
            ephemeral: true,
          });

          // NOTE: For simplicity, we avoid message listeners.
          // If you want "Other..." fully implemented, tell me and I’ll add it cleanly.
          return;
        }

        const qty = Number(qtyStr);
        if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
          await interaction.reply({ content: "Invalid quantity.", ephemeral: true });
          return;
        }

        const item = findItem(catId, itemId);
        if (!item) {
          await interaction.reply({ content: "Item not found.", ephemeral: true });
          return;
        }

        const cart = await getCart(userId);
        const lineTotal = item.price * qty;

        cart.push({
          catId,
          itemId,
          name: item.name,
          unitPrice: item.price,
          size,
          colour,
          qty,
          lineTotal,
        });

        await setCart(userId, cart);

        await interaction.reply({
          content: "✅ Added to basket.",
          embeds: [buildCartEmbed(cart)],
          components: basketActionRows(cart),
          ephemeral: true,
        });

        return;
      }
    }

    // Select menus
    if (interaction.isStringSelectMenu()) {
      const userId = interaction.user.id;

      // Must have shipping first (hard enforcement)
      const profile = await getShippingProfile(userId);
      if (!profile) {
        await interaction.reply({ content: "Please enter shipping details first.", ephemeral: true });
        await interaction.showModal(buildShippingModal());
        return;
      }

      // Choose category
      if (interaction.customId === "select_category") {
        const catId = interaction.values[0];
        await interaction.reply({
          content: `✅ Selected category: **${findCategory(catId)?.label || catId}**\nNow choose an item:`,
          components: itemSelectRow(catId),
          ephemeral: true,
        });
        return;
      }

      // Choose item
      if (interaction.customId.startsWith("select_item:")) {
        const catId = interaction.customId.split(":")[1];
        const itemId = interaction.values[0];
        await interaction.reply({
          content: `✅ Selected item. Choose a size:`,
          components: sizeSelectRow(catId, itemId),
          ephemeral: true,
        });
        return;
      }

      // Choose size
      if (interaction.customId.startsWith("select_size:")) {
        const [, catId, itemId] = interaction.customId.split(":");
        const size = interaction.values[0];
        await interaction.reply({
          content: `✅ Size **${size}** selected. Choose a colour:`,
          components: colourSelectRow(catId, itemId, size),
          ephemeral: true,
        });
        return;
      }

      // Choose colour
      if (interaction.customId.startsWith("select_colour:")) {
        const [, catId, itemId, encSize] = interaction.customId.split(":");
        const size = decodeURIComponent(encSize);
        const colour = interaction.values[0];

        await interaction.reply({
          content: `✅ Colour **${colour}** selected — how many?`,
          components: qtyButtonsRow(catId, itemId, size, colour),
          ephemeral: true,
        });
        return;
      }
    }

    // Shipping modal submit
    if (interaction.isModalSubmit()) {
      if (interaction.customId !== "shipping_modal") return;

      const fullName = interaction.fields.getTextInputValue("full_name").trim();
      const email = interaction.fields.getTextInputValue("email").trim();
      const line1 = interaction.fields.getTextInputValue("line1").trim();
      const line2 = interaction.fields.getTextInputValue("line2").trim();
      const cpc = interaction.fields.getTextInputValue("city_post_country").trim();

      // Parse "City, Postcode, Country"
      const parts = cpc.split(",").map((p) => p.trim()).filter(Boolean);
      if (parts.length < 3) {
        await interaction.reply({
          content: "⚠️ Please format as: City, Postcode, Country (comma separated).",
          ephemeral: true,
        });
        return;
      }

      const city = parts[0];
      const postcode = parts[1];
      const country = parts.slice(2).join(", ");

      const profile = { fullName, email, line1, line2, city, postcode, country };
      await upsertShippingProfile(interaction.user.id, profile);

      // After saving, show categories
      await interaction.reply({
        content: "✅ Shipping saved. Choose a category:",
        components: categorySelectRow(),
        ephemeral: true,
      });

      return;
    }
  } catch (err) {
    console.error(err);
    // Always try to respond without breaking UX
    if (interaction.isRepliable()) {
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ content: `⚠️ Error: ${err.message}`, ephemeral: true });
        } else {
          await interaction.reply({ content: `⚠️ Error: ${err.message}`, ephemeral: true });
        }
      } catch (_) {}
    }
  }
});

// =====================
// Startup
// =====================
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

(async () => {
  await registerCommands();
  await dbInit();
  await client.login(DISCORD_TOKEN);
})();
