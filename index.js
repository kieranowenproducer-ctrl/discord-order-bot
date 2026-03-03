import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Partials,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

// =====================
// ENV VARS (Railway)
// =====================
const TOKEN = process.env.BOT_TOKEN;
const ORDERS_CHANNEL_ID = process.env.ORDERS_CHANNEL_ID; // private staff channel ID (e.g. #orders)

if (!TOKEN) throw new Error("Missing BOT_TOKEN env var");
if (!ORDERS_CHANNEL_ID) throw new Error("Missing ORDERS_CHANNEL_ID env var");

// =====================
// BASIC BOT SETUP
// =====================
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel],
});

// =====================
// SIMPLE CATALOG (EDIT THESE)
// =====================
const PRODUCTS = ["T-Shirt", "Hoodie", "Shorts"];
const SIZES = ["XS", "S", "M", "L", "XL"];
const COLOURS = ["Black", "White", "Grey"];
const QUANTITIES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

// =====================
// ORDER STATE (in-memory)
// NOTE: This resets if the bot restarts.
// Good enough for your current setup.
// =====================
const pendingOrders = new Map(); // key: userId => { orderId, product, size, colour, quantity, createdAt }

// Order ID generator
function makeOrderId() {
  const now = new Date();
  const y = String(now.getFullYear()).slice(2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${y}${m}${d}-${rand}`;
}

// Helper to build select menus
function buildSelect(customId, placeholder, options) {
  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .addOptions(options.map((v) => ({ label: v, value: v })));
}

// =====================
// REGISTER /order COMMAND (per-guild quick method)
// =====================
async function registerCommands() {
  const orderCmd = new SlashCommandBuilder()
    .setName("order")
    .setDescription("Start an order (product, size, colour, quantity).");

  // Register to every guild the bot is currently in
  for (const [, guild] of client.guilds.cache) {
    await guild.commands.create(orderCmd);
  }
}

// =====================
// READY
// =====================
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    await registerCommands();
    console.log("✅ /order registered");
  } catch (e) {
    console.error("❌ Failed to register /order:", e);
  }
});

// =====================
// INTERACTIONS
// =====================
client.on("interactionCreate", async (interaction) => {
  try {
    // -------------------------
    // 1) /order slash command
    // -------------------------
    if (interaction.isChatInputCommand() && interaction.commandName === "order") {
      const orderId = makeOrderId();

      // Create a fresh pending order for this user
      pendingOrders.set(interaction.user.id, {
        orderId,
        product: null,
        size: null,
        colour: null,
        quantity: null,
        createdAt: Date.now(),
      });

      const row1 = new ActionRowBuilder().addComponents(
        buildSelect("sel_product", "Select product", PRODUCTS)
      );
      const row2 = new ActionRowBuilder().addComponents(
        buildSelect("sel_size", "Select size", SIZES)
      );
      const row3 = new ActionRowBuilder().addComponents(
        buildSelect("sel_colour", "Select colour", COLOURS)
      );
      const row4 = new ActionRowBuilder().addComponents(
        buildSelect("sel_quantity", "Select quantity", QUANTITIES)
      );

      const row5 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("btn_confirm")
          .setLabel("Confirm Order")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("btn_cancel")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({
        content:
          `Build your order using the dropdowns, then press **Confirm Order**.\n` +
          `Order ID: **${orderId}**`,
        components: [row1, row2, row3, row4, row5],
        ephemeral: true,
      });

      return;
    }

    // -------------------------
    // 2) Select menus
    // -------------------------
    if (interaction.isStringSelectMenu()) {
      const state = pendingOrders.get(interaction.user.id);
      if (!state) {
        await interaction.reply({
          content: "⚠️ No active order found. Run **/order** again.",
          ephemeral: true,
        });
        return;
      }

      const picked = interaction.values?.[0];

      if (interaction.customId === "sel_product") state.product = picked;
      if (interaction.customId === "sel_size") state.size = picked;
      if (interaction.customId === "sel_colour") state.colour = picked;
      if (interaction.customId === "sel_quantity") state.quantity = picked;

      pendingOrders.set(interaction.user.id, state);

      await interaction.deferUpdate(); // keep the ephemeral UI clean
      return;
    }

    // -------------------------
    // 3) Confirm / Cancel buttons
    // -------------------------
    if (interaction.isButton()) {
      const state = pendingOrders.get(interaction.user.id);

      if (interaction.customId === "btn_cancel") {
        pendingOrders.delete(interaction.user.id);
        await interaction.update({
          content: "❌ Order cancelled.",
          components: [],
        });
        return;
      }

      if (interaction.customId === "btn_confirm") {
        if (!state) {
          await interaction.reply({
            content: "⚠️ No active order found. Run **/order** again.",
            ephemeral: true,
          });
          return;
        }

        const missing = [];
        if (!state.product) missing.push("product");
        if (!state.size) missing.push("size");
        if (!state.colour) missing.push("colour");
        if (!state.quantity) missing.push("quantity");

        if (missing.length) {
          await interaction.reply({
            content: `⚠️ Please select: **${missing.join(", ")}** before confirming.`,
            ephemeral: true,
          });
          return;
        }

        // 3a) Post order to STAFF channel
        const staffChannel = await client.channels.fetch(ORDERS_CHANNEL_ID);

        const orderEmbed = new EmbedBuilder()
          .setTitle("🛒 New Order")
          .addFields(
            { name: "Order ID", value: `**${state.orderId}**`, inline: false },
            { name: "User", value: `${interaction.user} (${interaction.user.id})`, inline: false },
            { name: "Product", value: state.product, inline: true },
            { name: "Size", value: state.size, inline: true },
            { name: "Colour", value: state.colour, inline: true },
            { name: "Quantity", value: state.quantity, inline: true }
          )
          .setTimestamp();

        await staffChannel.send({ embeds: [orderEmbed] });

        // 3b) Confirm to customer (normal message)
        await interaction.reply({
          content: `✅ Order submitted! Now please enter your shipping details.`,
          ephemeral: true,
        });

        // 3c) Open shipping modal (pop-up)
        const modal = new ModalBuilder()
          .setCustomId(`shipping_modal:${state.orderId}`)
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

        const country = new TextInputBuilder()
          .setCustomId("ship_country")
          .setLabel("Country")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const phone = new TextInputBuilder()
          .setCustomId("ship_phone")
          .setLabel("Phone (optional)")
          .setStyle(TextInputStyle.Short)
          .setRequired(false);

        modal.addComponents(
          new ActionRowBuilder().addComponents(fullName),
          new ActionRowBuilder().addComponents(address1),
          new ActionRowBuilder().addComponents(city),
          new ActionRowBuilder().addComponents(postcode),
          new ActionRowBuilder().addComponents(country)
        );

        // phone in its own row (modals allow up to 5 rows)
        modal.addComponents(new ActionRowBuilder().addComponents(phone));

        // IMPORTANT: showModal must be its own response
        await interaction.showModal(modal);

        // Keep state (so staff can see order first; shipping comes right after)
        // We can delete now or keep briefly. We'll keep it 10 minutes then auto-clean.
        setTimeout(() => {
          const s = pendingOrders.get(interaction.user.id);
          if (s && s.orderId === state.orderId) pendingOrders.delete(interaction.user.id);
        }, 10 * 60 * 1000);

        return;
      }
    }

    // -------------------------
    // 4) Shipping modal submit
    // -------------------------
    if (interaction.isModalSubmit() && interaction.customId.startsWith("shipping_modal:")) {
      const orderId = interaction.customId.split(":")[1] || "UNKNOWN";

      const shipName = interaction.fields.getTextInputValue("ship_fullname");
      const shipAddress1 = interaction.fields.getTextInputValue("ship_address1");
      const shipCity = interaction.fields.getTextInputValue("ship_city");
      const shipPostcode = interaction.fields.getTextInputValue("ship_postcode");
      const shipCountry = interaction.fields.getTextInputValue("ship_country");
      const shipPhone = interaction.fields.getTextInputValue("ship_phone") || "—";

      const staffChannel = await client.channels.fetch(ORDERS_CHANNEL_ID);

      const shipEmbed = new EmbedBuilder()
        .setTitle("📦 Shipping Details")
        .addFields(
          { name: "Order ID", value: `**${orderId}**`, inline: false },
          { name: "User", value: `${interaction.user} (${interaction.user.id})`, inline: false },
          { name: "Full name", value: shipName, inline: false },
          { name: "Address line 1", value: shipAddress1, inline: false },
          { name: "City", value: shipCity, inline: true },
          { name: "Postcode", value: shipPostcode, inline: true },
          { name: "Country", value: shipCountry, inline: true },
          { name: "Phone", value: shipPhone, inline: false }
        )
        .setTimestamp();

      await staffChannel.send({ embeds: [shipEmbed] });

      await interaction.reply({
        content: "✅ Shipping details submitted. Thank you!",
        ephemeral: true,
      });

      return;
    }
  } catch (err) {
    console.error("❌ interactionCreate error:", err);

    // Try to respond safely if possible
    if (interaction.isRepliable()) {
      try {
        await interaction.reply({
          content: "⚠️ Something went wrong. Please try again.",
          ephemeral: true,
        });
      } catch {}
    }
  }
});

// =====================
// LOGIN
// =====================
client.login(TOKEN);
