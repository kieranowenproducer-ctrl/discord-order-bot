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

if (!TOKEN) throw new Error("Missing BOT_TOKEN env var");
if (!ORDERS_CHANNEL_ID) throw new Error("Missing ORDERS_CHANNEL_ID env var");

// EDIT THESE OPTIONS AS YOU LIKE
const PRODUCTS = ["T-Shirt", "Hoodie", "Cap"];
const SIZES = ["XS", "S", "M", "L", "XL"];
const COLOURS = ["White", "Black", "Grey"];
const QUANTITIES = ["1", "2", "3", "4", "5"];

const orders = new Map(); // in-memory state per user

function makeSelect(customId, placeholder, items) {
  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .addOptions(items.map((x) => ({ label: x, value: x })));
}

function keyFor(userId) {
  return `order:${userId}`;
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", async () => {
  console.log(`✅ Bot ready: ${client.user.tag}`);
  console.log(`✅ Using ORDERS_CHANNEL_ID=${ORDERS_CHANNEL_ID}`);

  const commands = [
    new SlashCommandBuilder()
      .setName("order")
      .setDescription("Create a new order"),
  ].map((c) => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  // Register per-guild for instant updates
  for (const guild of client.guilds.cache.values()) {
    await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), {
      body: commands,
    });
    console.log(`✅ Registered /order for guild: ${guild.name}`);
  }
});

client.on("interactionCreate", async (interaction) => {
  try {
    // /order
    if (interaction.isChatInputCommand() && interaction.commandName === "order") {
      orders.set(keyFor(interaction.user.id), {
        product: null,
        size: null,
        colour: null,
        quantity: null,
      });

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

      const buttons = new ActionRowBuilder().addComponents(
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
        content:
          "Build your order using the dropdowns, then click **Confirm Order**.\n\n" +
          "✅ **IMPORTANT:** Orders are sent privately to the shop owner.",
        components: [row1, row2, row3, row4, buttons],
        ephemeral: true,
      });
      return;
    }

    // dropdowns
    if (interaction.isStringSelectMenu()) {
      const state = orders.get(keyFor(interaction.user.id)) || {
        product: null,
        size: null,
        colour: null,
        quantity: null,
      };

      if (interaction.customId === "select_product") state.product = interaction.values[0];
      if (interaction.customId === "select_size") state.size = interaction.values[0];
      if (interaction.customId === "select_colour") state.colour = interaction.values[0];
      if (interaction.customId === "select_quantity") state.quantity = interaction.values[0];

      orders.set(keyFor(interaction.user.id), state);

      const preview =
        `**Current selection**\n` +
        `Product: ${state.product ?? "—"}\n` +
        `Size: ${state.size ?? "—"}\n` +
        `Colour: ${state.colour ?? "—"}\n` +
        `Quantity: ${state.quantity ?? "—"}`;

      await interaction.update({
        content:
          "Build your order using the dropdowns, then click **Confirm Order**.\n\n" +
          preview,
        components: interaction.message.components,
      });
      return;
    }

    // buttons
    if (interaction.isButton()) {
      const state = orders.get(keyFor(interaction.user.id));

      if (interaction.customId === "cancel_order") {
        orders.delete(keyFor(interaction.user.id));
        await interaction.update({ content: "❌ Order cancelled.", components: [] });
        return;
      }

      if (interaction.customId === "confirm_order") {
        if (!state?.product || !state?.size || !state?.colour || !state?.quantity) {
          await interaction.reply({
            content: "⚠️ Please select product, size, colour, and quantity before confirming.",
            ephemeral: true,
          });
          return;
        }

        console.log(
          `📦 Confirm clicked by ${interaction.user.tag}: ${JSON.stringify(state)}`
        );

        // Fetch private orders channel and send the order there
        const ordersChannel = await client.channels.fetch(ORDERS_CHANNEL_ID);

        if (!ordersChannel || !ordersChannel.isTextBased()) {
          throw new Error(
            "ORDERS_CHANNEL_ID is invalid or bot cannot access the channel."
          );
        }

        const orderMsg =
          `📦 **New Order**\n` +
          `User: <@${interaction.user.id}>\n` +
          `Product: **${state.product}**\n` +
          `Size: **${state.size}**\n` +
          `Colour: **${state.colour}**\n` +
          `Quantity: **${state.quantity}**`;

        await ordersChannel.send({ content: orderMsg });
        console.log(`✅ Sent order to private channel ${ORDERS_CHANNEL_ID}`);

        orders.delete(keyFor(interaction.user.id));

        // Update ephemeral UI only
        await interaction.update({
          content: "✅ Order submitted! A team member will follow up with payment.",
          components: [],
        });
        return;
      }
    }
  } catch (err) {
    console.error("❌ interaction error:", err);

    const msg =
      "❌ Something went wrong.\n" +
      "Shop owner: check Railway Logs — usually wrong channel ID or missing permissions.";

    if (interaction.isRepliable()) {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: msg, ephemeral: true });
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
    }
  }
});

client.login(TOKEN);
