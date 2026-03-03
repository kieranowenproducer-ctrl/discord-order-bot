import 'dotenv/config';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  InteractionType,
  ModalBuilder,
  PermissionFlagsBits,
  REST,
  Routes,
  SelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

import pg from 'pg';
const { Pool } = pg;

/**
 * ========= ENV / REQUIRED VARS =========
 */
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const MENU_CHANNEL_ID = process.env.MENU_CHANNEL_ID;
const ORDERS_CHANNEL_ID = process.env.ORDERS_CHANNEL_ID;
const ORDERS_CATEGORY_ID = process.env.ORDERS_CATEGORY_ID; // optional, but you have it
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;

const DATABASE_URL = process.env.DATABASE_URL;

function requireEnv(name, val) {
  if (!val) throw new Error(`Missing ${name}`);
}

requireEnv('DISCORD_TOKEN', DISCORD_TOKEN);
requireEnv('CLIENT_ID', CLIENT_ID);
requireEnv('GUILD_ID', GUILD_ID);
requireEnv('MENU_CHANNEL_ID', MENU_CHANNEL_ID);
requireEnv('ORDERS_CHANNEL_ID', ORDERS_CHANNEL_ID);
requireEnv('STAFF_ROLE_ID', STAFF_ROLE_ID);
requireEnv('DATABASE_URL', DATABASE_URL);

/**
 * ========= DB =========
 * IMPORTANT: We DO NOT use cart_json anywhere.
 * We store cart as normalized rows: carts + cart_items
 */
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function dbInit() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS shipping_profiles (
      user_id TEXT PRIMARY KEY REFERENCES user_profiles(user_id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      address1 TEXT NOT NULL,
      address2 TEXT,
      city TEXT NOT NULL,
      postcode TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT 'UK',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS carts (
      user_id TEXT PRIMARY KEY REFERENCES user_profiles(user_id) ON DELETE CASCADE,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      item_name TEXT NOT NULL,
      size TEXT NOT NULL,
      color TEXT NOT NULL,
      unit_price_pence INT NOT NULL,
      quantity INT NOT NULL CHECK (quantity > 0),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
      customer_username TEXT NOT NULL,
      subtotal_pence INT NOT NULL,
      shipping_pence INT NOT NULL,
      total_pence INT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      receipt_thread_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      item_name TEXT NOT NULL,
      size TEXT NOT NULL,
      color TEXT NOT NULL,
      unit_price_pence INT NOT NULL,
      quantity INT NOT NULL CHECK (quantity > 0)
    );
  `);
}

async function ensureUser(userId) {
  await pool.query(`INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [userId]);
  await pool.query(`INSERT INTO carts (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [userId]);
}

function money(pence) {
  return `£${(pence / 100).toFixed(2)}`;
}

const SHIPPING_PENCE = 499;

/**
 * ========= SHOP CATALOG =========
 * Edit these products and prices however you like.
 * Prices are in PENCE to avoid decimals.
 */
const CATALOG = {
  'T-Shirts': [
    { name: 'T-Shirt', prices: { default: 1999 }, sizes: ['S', 'M', 'L', 'XL'], colors: ['White', 'Black', 'Navy', 'Grey'] },
  ],
  Hoodies: [
    { name: 'Hoodie', prices: { default: 3999 }, sizes: ['S', 'M', 'L', 'XL'], colors: ['Black', 'Grey', 'White'] },
  ],
  Caps: [
    { name: 'Cap', prices: { default: 1499 }, sizes: ['One Size'], colors: ['Black', 'White'] },
  ],
};

/**
 * ========= IN-MEMORY SESSION (per user step) =========
 * This avoids needing extra DB columns for "current step".
 * If bot restarts, user can just click menu again.
 */
const sessions = new Map(); // userId -> { step, category, itemName, size, color }

function setSession(userId, patch) {
  const cur = sessions.get(userId) || {};
  sessions.set(userId, { ...cur, ...patch });
}

function clearSession(userId) {
  sessions.delete(userId);
}

/**
 * ========= DISCORD CLIENT =========
 */
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

/**
 * ========= SLASH COMMANDS =========
 */
const commands = [
  {
    name: 'setupshop',
    description: 'Post (or refresh) the shop menu message in the menu channel',
  },
  {
    name: 'clearcart',
    description: 'Clear your cart',
  },
  {
    name: 'resetprofile',
    description: 'Delete your saved shipping profile (you will be prompted again)',
  },
];

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
}

/**
 * ========= UI BUILDERS =========
 */
function menuWelcomeMessage() {
  const embed = new EmbedBuilder()
    .setTitle('Welcome to Clothing Shop!')
    .setDescription(
      [
        '**How it works:**',
        '1) Click the button below to get started',
        '2) Enter your shipping details',
        '3) Browse categories and select items',
        '4) Add multiple items to your basket',
        '5) Submit your order when you’re done',
        '',
        'Once submitted, you’ll receive a **private receipt thread** where the team can send your payment link.',
      ].join('\n')
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('shop_open').setLabel('Click to see our menu').setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

function categorySelect() {
  const options = Object.keys(CATALOG).map((cat) => ({
    label: cat,
    value: cat,
  }));

  return new ActionRowBuilder().addComponents(
    new SelectMenuBuilder()
      .setCustomId('shop_category')
      .setPlaceholder('Select a category…')
      .addOptions(options)
  );
}

function itemSelect(category) {
  const items = CATALOG[category] || [];
  const options = items.map((i) => ({ label: i.name, value: i.name }));
  return new ActionRowBuilder().addComponents(
    new SelectMenuBuilder()
      .setCustomId('shop_item')
      .setPlaceholder('Select an item…')
      .addOptions(options)
  );
}

function sizeSelect(category, itemName) {
  const item = (CATALOG[category] || []).find((x) => x.name === itemName);
  const options = (item?.sizes || ['One Size']).map((s) => ({ label: s, value: s }));
  return new ActionRowBuilder().addComponents(
    new SelectMenuBuilder().setCustomId('shop_size').setPlaceholder('Select a size…').addOptions(options)
  );
}

function colorSelect(category, itemName) {
  const item = (CATALOG[category] || []).find((x) => x.name === itemName);
  const options = (item?.colors || ['Default']).map((c) => ({ label: c, value: c }));
  return new ActionRowBuilder().addComponents(
    new SelectMenuBuilder().setCustomId('shop_color').setPlaceholder('Select a colour…').addOptions(options)
  );
}

function qtyButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    [1, 2, 3, 4, 5].map((n) =>
      new ButtonBuilder().setCustomId(`shop_qty_${n}`).setLabel(String(n)).setStyle(ButtonStyle.Secondary)
    )
  );

  const row2 = new ActionRowBuilder().addComponents(
    [6, 7, 8, 9].map((n) =>
      new ButtonBuilder().setCustomId(`shop_qty_${n}`).setLabel(String(n)).setStyle(ButtonStyle.Secondary)
    ),
    new ButtonBuilder().setCustomId('shop_qty_other').setLabel('Other…').setStyle(ButtonStyle.Primary)
  );

  return [row1, row2];
}

function basketActions() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cart_add_more').setLabel('Add Another Item').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('cart_clear').setLabel('Clear Basket').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('cart_submit').setLabel('Submit Order ✅').setStyle(ButtonStyle.Success)
  );
}

function shippingModal() {
  const modal = new ModalBuilder().setCustomId('shipping_modal').setTitle('Shipping details');

  const fullName = new TextInputBuilder().setCustomId('full_name').setLabel('Full name').setStyle(TextInputStyle.Short).setRequired(true);
  const email = new TextInputBuilder().setCustomId('email').setLabel('Email').setStyle(TextInputStyle.Short).setRequired(true);
  const address1 = new TextInputBuilder().setCustomId('address1').setLabel('Address line 1').setStyle(TextInputStyle.Short).setRequired(true);
  const address2 = new TextInputBuilder().setCustomId('address2').setLabel('Address line 2 (optional)').setStyle(TextInputStyle.Short).setRequired(false);
  const city = new TextInputBuilder().setCustomId('city').setLabel('City').setStyle(TextInputStyle.Short).setRequired(true);
  const postcode = new TextInputBuilder().setCustomId('postcode').setLabel('Postcode').setStyle(TextInputStyle.Short).setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(fullName),
    new ActionRowBuilder().addComponents(email),
    new ActionRowBuilder().addComponents(address1),
    new ActionRowBuilder().addComponents(address2),
    new ActionRowBuilder().addComponents(city),
    new ActionRowBuilder().addComponents(postcode)
  );

  return modal;
}

function otherQtyModal() {
  const modal = new ModalBuilder().setCustomId('qty_modal').setTitle('Quantity');

  const qty = new TextInputBuilder()
    .setCustomId('qty')
    .setLabel('Enter quantity (1–99)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(qty));
  return modal;
}

/**
 * ========= CART / ORDER HELPERS =========
 */
async function getCart(userId) {
  const { rows } = await pool.query(
    `SELECT id, category, item_name, size, color, unit_price_pence, quantity
     FROM cart_items
     WHERE user_id = $1
     ORDER BY created_at ASC`,
    [userId]
  );
  return rows;
}

async function addToCart(userId, { category, itemName, size, color, unitPricePence, quantity }) {
  await pool.query(
    `INSERT INTO cart_items (user_id, category, item_name, size, color, unit_price_pence, quantity)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [userId, category, itemName, size, color, unitPricePence, quantity]
  );
  await pool.query(`UPDATE carts SET updated_at = NOW() WHERE user_id = $1`, [userId]);
}

async function clearCart(userId) {
  await pool.query(`DELETE FROM cart_items WHERE user_id = $1`, [userId]);
  await pool.query(`UPDATE carts SET updated_at = NOW() WHERE user_id = $1`, [userId]);
}

function calcTotals(cartRows) {
  const subtotal = cartRows.reduce((sum, r) => sum + r.unit_price_pence * r.quantity, 0);
  const shipping = cartRows.length ? SHIPPING_PENCE : 0;
  const total = subtotal + shipping;
  return { subtotal, shipping, total };
}

function renderBasketEmbed(cartRows) {
  const { subtotal, shipping, total } = calcTotals(cartRows);

  const lines = cartRows.length
    ? cartRows.map((r) => `• **${r.item_name}** (${r.size}, ${r.color}) × **${r.quantity}** — ${money(r.unit_price_pence * r.quantity)}`)
    : ['(Basket is empty)'];

  return new EmbedBuilder()
    .setTitle('Clothing Shop — Your basket')
    .setDescription(lines.join('\n'))
    .addFields(
      { name: 'Subtotal', value: money(subtotal), inline: true },
      { name: 'Shipping', value: money(shipping), inline: true },
      { name: 'Total', value: money(total), inline: true }
    );
}

async function getShipping(userId) {
  const { rows } = await pool.query(`SELECT * FROM shipping_profiles WHERE user_id = $1`, [userId]);
  return rows[0] || null;
}

async function upsertShipping(userId, profile) {
  await pool.query(
    `INSERT INTO shipping_profiles (user_id, full_name, email, address1, address2, city, postcode, country)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'UK')
     ON CONFLICT (user_id) DO UPDATE SET
       full_name = EXCLUDED.full_name,
       email = EXCLUDED.email,
       address1 = EXCLUDED.address1,
       address2 = EXCLUDED.address2,
       city = EXCLUDED.city,
       postcode = EXCLUDED.postcode,
       country = EXCLUDED.country,
       updated_at = NOW()`,
    [userId, profile.full_name, profile.email, profile.address1, profile.address2, profile.city, profile.postcode]
  );
}

async function deleteShipping(userId) {
  await pool.query(`DELETE FROM shipping_profiles WHERE user_id = $1`, [userId]);
}

/**
 * Creates a PRIVATE receipt thread in the orders channel and adds the customer.
 * This is the “customer receipt channel” you wanted.
 */
async function createReceiptThread({ guild, ordersChannelId, customerUser, orderId }) {
  const ordersChannel = await guild.channels.fetch(ordersChannelId);
  if (!ordersChannel || ordersChannel.type !== ChannelType.GuildText) {
    throw new Error('ORDERS_CHANNEL_ID must be a normal text channel');
  }

  // Private thread so only added members + staff (with perms) can see
  const thread = await ordersChannel.threads.create({
    name: `order-${customerUser.username}-${orderId}`,
    autoArchiveDuration: 1440, // 24h
    type: ChannelType.PrivateThread,
    reason: `Receipt thread for order ${orderId}`,
  });

  // Add customer to the private thread
  await thread.members.add(customerUser.id);

  return thread;
}

/**
 * ========= INTERACTION HANDLERS =========
 */
async function postMenuMessage() {
  const ch = await client.channels.fetch(MENU_CHANNEL_ID);
  if (!ch || ch.type !== ChannelType.GuildText) throw new Error('MENU_CHANNEL_ID must be a text channel');

  const msg = await ch.send(menuWelcomeMessage());
  return msg;
}

async function respondEphemeral(interaction, content, components = []) {
  if (interaction.deferred || interaction.replied) {
    return interaction.followUp({ content, components, ephemeral: true });
  }
  return interaction.reply({ content, components, ephemeral: true });
}

async function handleShopOpen(interaction) {
  const userId = interaction.user.id;
  await ensureUser(userId);

  const shipping = await getShipping(userId);
  if (!shipping) {
    // Force shipping profile first
    await interaction.showModal(shippingModal());
    return;
  }

  clearSession(userId);
  setSession(userId, { step: 'category' });

  await respondEphemeral(interaction, 'Select a category:', [categorySelect()]);
}

async function handleCategory(interaction) {
  const userId = interaction.user.id;
  const category = interaction.values[0];
  setSession(userId, { step: 'item', category });

  await respondEphemeral(interaction, `Selected category: **${category}**\nNow choose an item:`, [itemSelect(category)]);
}

async function handleItem(interaction) {
  const userId = interaction.user.id;
  const itemName = interaction.values[0];
  const session = sessions.get(userId);
  if (!session?.category) return respondEphemeral(interaction, 'Session expired. Click the menu button again.');

  setSession(userId, { step: 'size', itemName });

  await respondEphemeral(interaction, `Selected item: **${itemName}**\nChoose a size:`, [sizeSelect(session.category, itemName)]);
}

async function handleSize(interaction) {
  const userId = interaction.user.id;
  const size = interaction.values[0];
  const session = sessions.get(userId);
  if (!session?.category || !session?.itemName) return respondEphemeral(interaction, 'Session expired. Click the menu button again.');

  setSession(userId, { step: 'color', size });

  await respondEphemeral(interaction, `Size **${size}** selected.\nChoose a colour:`, [colorSelect(session.category, session.itemName)]);
}

async function handleColor(interaction) {
  const userId = interaction.user.id;
  const color = interaction.values[0];
  const session = sessions.get(userId);
  if (!session?.category || !session?.itemName || !session?.size) return respondEphemeral(interaction, 'Session expired. Click the menu button again.');

  setSession(userId, { step: 'qty', color });

  const item = (CATALOG[session.category] || []).find((x) => x.name === session.itemName);
  await respondEphemeral(interaction, `Colour **${color}** selected — how many?`, qtyButtons());
}

async function handleQty(interaction, quantity) {
  const userId = interaction.user.id;
  const session = sessions.get(userId);
  if (!session?.category || !session?.itemName || !session?.size || !session?.color) {
    return respondEphemeral(interaction, 'Session expired. Click the menu button again.');
  }

  const item = (CATALOG[session.category] || []).find((x) => x.name === session.itemName);
  const unitPricePence = item?.prices?.default ?? 0;

  await addToCart(userId, {
    category: session.category,
    itemName: session.itemName,
    size: session.size,
    color: session.color,
    unitPricePence,
    quantity,
  });

  clearSession(userId);

  const cartRows = await getCart(userId);
  const embed = renderBasketEmbed(cartRows);

  await respondEphemeral(interaction, '✅ Added to basket.', [basketActions()]);
  // Follow-up with basket details (still ephemeral)
  await interaction.followUp({ embeds: [embed], ephemeral: true });
}

async function handleSubmitOrder(interaction) {
  const userId = interaction.user.id;
  await ensureUser(userId);

  const cartRows = await getCart(userId);
  if (!cartRows.length) return respondEphemeral(interaction, 'Your basket is empty.');

  const shipping = await getShipping(userId);
  if (!shipping) {
    await interaction.showModal(shippingModal());
    return;
  }

  const { subtotal, shipping: ship, total } = calcTotals(cartRows);

  // Create order
  const orderRes = await pool.query(
    `INSERT INTO orders (user_id, customer_username, subtotal_pence, shipping_pence, total_pence, status)
     VALUES ($1,$2,$3,$4,$5,'PENDING')
     RETURNING id`,
    [userId, interaction.user.username, subtotal, ship, total]
  );
  const orderId = orderRes.rows[0].id;

  // Create order_items from cart
  for (const r of cartRows) {
    await pool.query(
      `INSERT INTO order_items (order_id, category, item_name, size, color, unit_price_pence, quantity)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [orderId, r.category, r.item_name, r.size, r.color, r.unit_price_pence, r.quantity]
    );
  }

  // Clear cart
  await clearCart(userId);

  // Create receipt thread
  const thread = await createReceiptThread({
    guild: interaction.guild,
    ordersChannelId: ORDERS_CHANNEL_ID,
    customerUser: interaction.user,
    orderId,
  });

  await pool.query(`UPDATE orders SET receipt_thread_id = $1 WHERE id = $2`, [thread.id, orderId]);

  // Post receipt in thread
  const receiptEmbed = new EmbedBuilder()
    .setTitle(`New Order — #${orderId}`)
    .setDescription(
      cartRows
        .map((r) => `• **${r.item_name}** (${r.size}, ${r.color}) × **${r.quantity}** — ${money(r.unit_price_pence * r.quantity)}`)
        .join('\n')
    )
    .addFields(
      { name: 'Customer', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Email', value: shipping.email, inline: true },
      {
        name: 'Shipping Address',
        value: `${shipping.full_name}\n${shipping.address1}${shipping.address2 ? `\n${shipping.address2}` : ''}\n${shipping.city}\n${shipping.postcode}\n${shipping.country}`,
      },
      { name: 'Subtotal', value: money(subtotal), inline: true },
      { name: 'Shipping', value: money(ship), inline: true },
      { name: 'Total', value: money(total), inline: true }
    );

  await thread.send({
    content: `<@&${STAFF_ROLE_ID}> New order received ✅`,
    embeds: [receiptEmbed],
  });

  await thread.send(`Hi <@${interaction.user.id}> — thanks! We’ll send your payment link here shortly.`);

  // Tell customer where their receipt is
  await respondEphemeral(
    interaction,
    `✅ Order submitted! Your private receipt thread is ready: **${thread.name}**\n(You can reply there and we’ll send the payment link in that thread.)`
  );
}

/**
 * ========= MAIN INTERACTION ROUTER =========
 */
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // Slash commands
    if (interaction.isChatInputCommand()) {
      const userId = interaction.user.id;
      await ensureUser(userId);

      if (interaction.commandName === 'setupshop') {
        // Optional: only allow admins to run
        // if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return respondEphemeral(interaction, 'Admin only.');
        await postMenuMessage();
        return respondEphemeral(interaction, '✅ Shop menu message posted/refreshed in the menu channel.');
      }

      if (interaction.commandName === 'clearcart') {
        await clearCart(userId);
        return respondEphemeral(interaction, '✅ Your basket has been cleared.');
      }

      if (interaction.commandName === 'resetprofile') {
        await deleteShipping(userId);
        return respondEphemeral(interaction, '✅ Shipping profile deleted. Next order will prompt you again.');
      }
    }

    // Buttons
    if (interaction.isButton()) {
      const id = interaction.customId;

      if (id === 'shop_open') return handleShopOpen(interaction);
      if (id === 'cart_add_more') {
        clearSession(interaction.user.id);
        setSession(interaction.user.id, { step: 'category' });
        return respondEphemeral(interaction, 'Select a category:', [categorySelect()]);
      }
      if (id === 'cart_clear') {
        await clearCart(interaction.user.id);
        return respondEphemeral(interaction, '✅ Basket cleared.');
      }
      if (id === 'cart_submit') return handleSubmitOrder(interaction);

      if (id.startsWith('shop_qty_')) {
        const qtyStr = id.replace('shop_qty_', '');
        const qty = Number(qtyStr);
        if (!Number.isFinite(qty) || qty < 1) return respondEphemeral(interaction, 'Invalid quantity.');
        return handleQty(interaction, qty);
      }

      if (id === 'shop_qty_other') {
        return interaction.showModal(otherQtyModal());
      }
    }

    // Select menus
    if (interaction.isSelectMenu()) {
      const id = interaction.customId;
      if (id === 'shop_category') return handleCategory(interaction);
      if (id === 'shop_item') return handleItem(interaction);
      if (id === 'shop_size') return handleSize(interaction);
      if (id === 'shop_color') return handleColor(interaction);
    }

    // Modals
    if (interaction.type === InteractionType.ModalSubmit) {
      if (interaction.customId === 'shipping_modal') {
        const userId = interaction.user.id;
        await ensureUser(userId);

        const profile = {
          full_name: interaction.fields.getTextInputValue('full_name'),
          email: interaction.fields.getTextInputValue('email'),
          address1: interaction.fields.getTextInputValue('address1'),
          address2: interaction.fields.getTextInputValue('address2'),
          city: interaction.fields.getTextInputValue('city'),
          postcode: interaction.fields.getTextInputValue('postcode'),
        };

        await upsertShipping(userId, profile);

        clearSession(userId);
        setSession(userId, { step: 'category' });

        return respondEphemeral(interaction, '✅ Shipping details saved. Now select a category:', [categorySelect()]);
      }

      if (interaction.customId === 'qty_modal') {
        const qtyRaw = interaction.fields.getTextInputValue('qty').trim();
        const qty = Number(qtyRaw);
        if (!Number.isFinite(qty) || qty < 1 || qty > 99) {
          return respondEphemeral(interaction, 'Please enter a number between 1 and 99.');
        }
        return handleQty(interaction, qty);
      }
    }
  } catch (err) {
    console.error(err);
    try {
      await respondEphemeral(interaction, `❌ Error: ${err.message || String(err)}`);
    } catch {}
  }
});

/**
 * ========= STARTUP =========
 */
client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
});

(async () => {
  await dbInit();
  await registerCommands();
  console.log('Slash commands registered');
  await client.login(DISCORD_TOKEN);
})();
