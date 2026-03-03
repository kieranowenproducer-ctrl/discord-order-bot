import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

const TOKEN = process.env.BOT_TOKEN;
const ORDERS_CHANNEL_ID = process.env.ORDERS_CHANNEL_ID;

// ---- Safety checks ----
if (!TOKEN) throw new Error("Missing BOT_TOKEN env var");
if (!ORDERS_CHANNEL_ID) throw new Error("Missing ORDERS_CHANNEL_ID env var");

// ---- Your shop options (edit these safely) ----
const PRODUCTS = ["T-Shirt", "Hoodie", "Cap"];
const SIZES = ["XS", "S", "M", "L", "XL"];
const COLOURS = ["White", "Black", "Grey"];
const QUANTITIES = ["1", "2", "3", "4", "5"];

function makeSelect(customId, placeholder, items) {
  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .addOptions(items.map((x) => ({ label: x, value: x })));
}

function buildOrderKey(userId) {
  return `order:${userId}`;
}

// Simple in-memory store (resets if Railway restarts)
// Good enough for now because the user usually completes in one go.
const orders = new Map();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Register slash command(s)
  const commands = [
    new SlashCommandBuilder()
      .setName("order")
      .setDescription("Build an order using dropdowns"),
  ].map((c) => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  // Register per-guild for instant updates
  for (const guild of client.guilds.cache.values()) {
    await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), {
      body: commands,
    });
    console.log(`✅ Commands registered for guild: ${guild.name}`);
  }
});

client.on("interactionCreate", async (interaction) => {
  try {
    // /order command
    if (interaction.isChatInputCommand() && interaction.commandName === "order") {
      const key = buildOrderKey(interaction.user.id);
      orders.set(key, { product: null, size: null, colour: null, quantity: null });

      const row1 = new ActionRowBuilder().addComponents(
        makeSelect("select_product", "Select product", PRODUCTS)
      );
      const row2 = new ActionRowBuilder().addComponents(
        makeSelect("select_size", "Select size", SIZES)
      );
      const row3 = new ActionRowBuilder().addComponents(
        makeSelect("select_colour", "Select colour", COLOURS)
      );
      const row4 = new ActionRowBuilder().addComponents(
        makeSelect("select_quantity", "Select quantity", QUANTITIES)
      );

      const row5 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("confirm_order")
          .setLabel("Confirm Order")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("cancel_order")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({
        content: "Build your order using the dropdowns, then hit **Confirm Order**.",
        components: [row1, row2, row3, row4, row5],
        ephemeral: true,
      });
      return;
    }

    // Dropdown selections
    if (interaction.isStringSelectMenu()) {
      const key = buildOrderKey(interaction.user.id);
      const state = orders.get(key) || { product: null, size: null, colour: null, quantity: null };

      if (interaction.customId === "select_product") state.product = interaction.values[0];
      if (interaction.customId === "select_size") state.size = interaction.values[0];
      if (interaction.customId === "select_colour") state.colour = interaction.values[0];
      if (interaction.customId === "select_quantity") state.quantity = interaction.values[0];

      orders.set(key, state);

      // Update the ephemeral message with a “current selection” preview
      const preview =
        `**Current Selection**\n` +
        `Product: ${state.product ?? "—"}\n` +
        `Size: ${state.size ?? "—"}\n` +
        `Colour: ${state.colour ?? "—"}\n` +
        `Quantity: ${state.quantity ?? "—"}`;

      await interaction.update({
        content: `Build your order using the dropdowns, then hit **Confirm Order**.\n\n${preview}`,
        components: interaction.message.components,
      });
      return;
    }

    // Confirm / Cancel buttons
    if (interaction.isButton()) {
      const key = buildOrderKey(interaction.user.id);
      const state = orders.get(key);

      if (interaction.customId === "cancel_order") {
        orders.delete(key);
        await interaction.update({
          content: "❌ Order cancelled.",
          components: [],
        });
        return;
      }

      if (interaction.customId === "confirm_order") {
        if (!state?.product || !state?.size || !state?.colour || !state?.quantity) {
          await interaction.reply({
            content: "⚠️ Please choose **product, size, colour, and quantity** before confirming.",
            ephemeral: true,
          });
          return;
        }

        // Send to private #orders channel (owner view)
        const ordersChannel = await client.channels.fetch(ORDERS_CHANNEL_ID);

        if (!ordersChannel || !ordersChannel.isTextBased()) {
          throw new Error("ORDERS_CHANNEL_ID is not a text channel or bot cannot access it.");
        }

        const orderText =
          `📦 **New Order**\n` +
          `User: <@${interaction.user.id}>\n` +
          `Product: **${state.product}**\n` +
          `Size: **${state.size}**\n` +
          `Colour: **${state.colour}**\n` +
          `Quantity: **${state.quantity}**`;

        await ordersChannel.send({ content: orderText });

        // Clear stored state
        orders.delete(key);

        // Update the ephemeral message (no public spam)
        await interaction.update({
          content: "✅ Order submitted! A team member will follow up with payment.",
          components: [],
        });

        return;
      }
    }
  } catch (err) {
    console.error(err);

    // Try to respond safely no matter what interaction type it was
    if (interaction.isRepliable()) {
      const msg =
        "❌ Something went wrong while processing your order.\n" +
        "If you're the owner: check Railway Logs (likely missing permissions or channel ID).";

      // Avoid double-respond errors
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: msg, ephemeral: true });
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
    }
  }
});

client.login(TOKEN);
