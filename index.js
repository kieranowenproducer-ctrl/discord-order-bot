// index.js
// Discord.js v14
// Flow:
// 1) /order -> shows dropdowns + Confirm/Cancel
// 2) Confirm -> opens Shipping modal (LEGAL: showModal is the ONLY response)
// 3) Modal submit -> posts full order + shipping to private staff channel (ORDERS_CHANNEL_ID)
// 4) Customer gets ephemeral confirmation

const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
} = require("discord.js");

const BOT_TOKEN = process.env.BOT_TOKEN;
const ORDERS_CHANNEL_ID = process.env.ORDERS_CHANNEL_ID;

// Optional (recommended): restrict where /order can be used
const ORDER_CHANNEL_ID = process.env.ORDER_CHANNEL_ID; // your public #order-here channel id

// Optional (recommended): auto-register slash commands
const CLIENT_ID = process.env.CLIENT_ID; // your Discord application client id
const GUILD_ID = process.env.GUILD_ID;   // your server id (guild id) for instant command updates

if (!BOT_TOKEN) throw new Error("Missing BOT_TOKEN env var");
if (!ORDERS_CHANNEL_ID) throw new Error("Missing ORDERS_CHANNEL_ID env var");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel],
});

// In-memory order state (good enough for your current setup)
const ordersByUser = new Map(); // key: userId -> value: order object

function makeOrderId() {
  return `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

function buildOrderComponents(userId) {
  const state = ordersByUser.get(userId) || {};

  const product = new StringSelectMenuBuilder()
    .setCustomId(`sel_product:${userId}`)
    .setPlaceholder(state.product ? `Product: ${state.product}` : "Select product")
    .addOptions(
      { label: "T-Shirt", value: "T-Shirt" },
      { label: "Hoodie", value: "Hoodie" },
      { label: "Shorts", value: "Shorts" }
    );

  const size = new StringSelectMenuBuilder()
    .setCustomId(`sel_size:${userId}`)
    .setPlaceholder(state.size ? `Size: ${state.size}` : "Select size")
    .addOptions(
      { label: "XS", value: "XS" },
      { label: "S", value: "S" },
      { label: "M", value: "M" },
      { label: "L", value: "L" },
      { label: "XL", value: "XL" }
    );

  const colour = new StringSelectMenuBuilder()
    .setCustomId(`sel_colour:${userId}`)
    .setPlaceholder(state.colour ? `Colour: ${state.colour}` : "Select colour")
    .addOptions(
      { label: "Black", value: "Black" },
      { label: "White", value: "White" },
      { label: "Navy", value: "Navy" }
    );

  const quantity = new StringSelectMenuBuilder()
    .setCustomId(`sel_quantity:${userId}`)
    .setPlaceholder(state.quantity ? `Quantity: ${state.quantity}` : "Select quantity")
    .addOptions(
      { label: "1", value: "1" },
      { label: "2", value: "2" },
      { label: "3", value: "3" },
      { label: "4", value: "4" },
      { label: "5", value: "5" }
    );

  const confirm = new ButtonBuilder()
    .setCustomId(`btn_confirm:${userId}`)
    .setLabel("Confirm Order")
    .setStyle(ButtonStyle.Success);

  const cancel = new ButtonBuilder()
    .setCustomId(`btn_cancel:${userId}`)
    .setLabel("Cancel")
    .setStyle(ButtonStyle.Secondary);

  return [
    new ActionRowBuilder().addComponents(product),
    new ActionRowBuilder().addComponents(size),
    new ActionRowBuilder().addComponents(colour),
    new ActionRowBuilder().addComponents(quantity),
    new ActionRowBuilder().addComponents(confirm, cancel),
  ];
}

async function registerCommands() {
  // If you don't want auto-registration, you can remove this whole function.
  if (!CLIENT_ID || !GUILD_ID) return;

  const commands = [
    new SlashCommandBuilder()
      .setName("order")
      .setDescription("Start an order")
      .toJSON(),
  ];

  const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);

  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commands,
  });

  console.log("✅ Slash command registered to guild.");
}

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  try {
    await registerCommands();
  } catch (e) {
    console.error("❌ Command registration failed:", e);
  }
});

client.on("interactionCreate", async (interaction) => {
  try {
    // ---------------------------
    // Slash command: /order
    // ---------------------------
    if (interaction.isChatInputCommand() && interaction.commandName === "order") {
      if (ORDER_CHANNEL_ID && interaction.channelId !== ORDER_CHANNEL_ID) {
        await interaction.reply({
          content: "⚠️ Please use /order in the order channel.",
          ephemeral: true,
        });
        return;
      }

      // Start/reset user's order state
      ordersByUser.set(interaction.user.id, {
        orderId: makeOrderId(),
        product: null,
        size: null,
        colour: null,
        quantity: null,
      });

      await interaction.reply({
        content: "Build your order using the dropdowns, then hit **Confirm Order**.",
        components: buildOrderComponents(interaction.user.id),
        ephemeral: true, // IMPORTANT: keeps the UI private to the customer
      });
      return;
    }

    // ---------------------------
    // Select menus
    // ---------------------------
    if (interaction.isStringSelectMenu()) {
      const [kind, userId] = interaction.customId.split(":");
      if (interaction.user.id !== userId) {
        await interaction.reply({ content: "⚠️ This menu isn't for you.", ephemeral: true });
        return;
      }

      const state = ordersByUser.get(userId);
      if (!state) {
        await interaction.reply({ content: "⚠️ No active order. Run /order again.", ephemeral: true });
        return;
      }

      const choice = interaction.values?.[0];

      if (kind === "sel_product") state.product = choice;
      if (kind === "sel_size") state.size = choice;
      if (kind === "sel_colour") state.colour = choice;
      if (kind === "sel_quantity") state.quantity = choice;

      ordersByUser.set(userId, state);

      // Update the ephemeral message UI
      await interaction.update({
        content: "Build your order using the dropdowns, then hit **Confirm Order**.",
        components: buildOrderComponents(userId),
      });
      return;
    }

    // ---------------------------
    // Buttons
    // ---------------------------
    if (interaction.isButton()) {
      const [btn, userId] = interaction.customId.split(":");
      if (interaction.user.id !== userId) {
        await interaction.reply({ content: "⚠️ This button isn't for you.", ephemeral: true });
        return;
      }

      const state = ordersByUser.get(userId);
      if (!state) {
        await interaction.reply({ content: "⚠️ No active order. Run /order again.", ephemeral: true });
        return;
      }

      if (btn === "btn_cancel") {
        ordersByUser.delete(userId);
        await interaction.reply({ content: "✅ Order cancelled.", ephemeral: true });
        return;
      }

      if (btn === "btn_confirm") {
        const missing = [];
        if (!state.product) missing.push("product");
        if (!state.size) missing.push("size");
        if (!state.colour) missing.push("colour");
        if (!state.quantity) missing.push("quantity");

        if (missing.length) {
          await interaction.reply({
            content: `⚠️ Please select: ${missing.join(", ")}`,
            ephemeral: true,
          });
          return;
        }

        // ✅ LEGAL: showModal is the ONE initial response here (no reply/defer beforehand)
        const modal = new ModalBuilder()
          .setCustomId(`shipping_modal:${userId}:${state.orderId}`)
          .setTitle("Shipping Details");

        const fullName = new TextInputBuilder()
          .setCustomId("ship_fullname")
          .setLabel("Full name")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const address1 = new TextInputBuilder()
          .setCustomId("ship_address1")
          .setLabel("Address line 1")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const city = new TextInputBuilder()
          .setCustomId("ship_city")
          .setLabel("City")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const postcode = new TextInputBuilder()
          .setCustomId("ship_postcode")
          .setLabel("Postcode")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const phone = new TextInputBuilder()
          .setCustomId("ship_phone")
          .setLabel("Phone number")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(fullName),
          new ActionRowBuilder().addComponents(address1),
          new ActionRowBuilder().addComponents(city),
          new ActionRowBuilder().addComponents(postcode),
          new ActionRowBuilder().addComponents(phone)
        );

        await interaction.showModal(modal);
        return;
      }
    }

    // ---------------------------
    // Modal submit (shipping)
    // ---------------------------
    if (interaction.isModalSubmit()) {
      const [prefix, userId, orderId] = interaction.customId.split(":");
      if (prefix !== "shipping_modal") return;

      if (interaction.user.id !== userId) {
        await interaction.reply({ content: "⚠️ This modal isn't for you.", ephemeral: true });
        return;
      }

      const state = ordersByUser.get(userId);
      if (!state || state.orderId !== orderId) {
        await interaction.reply({
          content: "⚠️ Order session expired. Please run /order again.",
          ephemeral: true,
        });
        return;
      }

      const shipFullName = interaction.fields.getTextInputValue("ship_fullname");
      const shipAddress1 = interaction.fields.getTextInputValue("ship_address1");
      const shipCity = interaction.fields.getTextInputValue("ship_city");
      const shipPostcode = interaction.fields.getTextInputValue("ship_postcode");
      const shipPhone = interaction.fields.getTextInputValue("ship_phone");

      // Post to PRIVATE staff channel only
      const staffChannel = await client.channels.fetch(ORDERS_CHANNEL_ID);

      const embed = new EmbedBuilder()
        .setTitle("🛒 New Order (with Shipping)")
        .addFields(
          { name: "Order ID", value: `**${state.orderId}**` },
          { name: "Customer", value: `${interaction.user} (${interaction.user.id})` },

          { name: "Product", value: state.product, inline: true },
          { name: "Size", value: state.size, inline: true },
          { name: "Colour", value: state.colour, inline: true },
          { name: "Quantity", value: state.quantity, inline: true },

          { name: "Full name", value: shipFullName },
          { name: "Address", value: shipAddress1 },
          { name: "City", value: shipCity, inline: true },
          { name: "Postcode", value: shipPostcode, inline: true },
          { name: "Phone", value: shipPhone, inline: true }
        )
        .setTimestamp();

      await staffChannel.send({ embeds: [embed] });

      // Customer confirmation (private)
      await interaction.reply({
        content: "✅ Order submitted! A team member will follow up with payment.",
        ephemeral: true,
      });

      // Clear state
      ordersByUser.delete(userId);
      return;
    }
  } catch (err) {
    console.error("❌ interactionCreate error:", err);

    // Try to safely reply if possible (avoid crashing silently)
    if (!interaction.deferred && !interaction.replied) {
      try {
        await interaction.reply({
          content: "⚠️ Something went wrong. Please try /order again.",
          ephemeral: true,
        });
      } catch {}
    }
  }
});

client.login(BOT_TOKEN);
