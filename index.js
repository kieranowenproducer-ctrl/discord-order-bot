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

// ✅ Edit these lists anytime
const PRODUCTS = ["Hoodie", "T-Shirt", "Joggers", "Cap"];
const SIZES = ["XS", "S", "M", "L", "XL"];
const COLOURS = ["Black", "White", "Navy", "Grey"];
const QUANTITIES = ["1", "2", "3", "4", "5"];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Register /order command
async function registerCommands() {
  const command = new SlashCommandBuilder()
    .setName("order")
    .setDescription("Start an order");

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  // Register globally (can take a while) OR per-guild (instant).
  // We'll do per-guild for speed: register on each guild the bot is in.
  for (const guild of client.guilds.cache.values()) {
    await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), {
      body: [command.toJSON()],
    });
  }

  console.log("✅ /order command registered");
}

// Helper: build dropdown
function makeSelect(customId, placeholder, items) {
  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .addOptions(items.map((x) => ({ label: x, value: x })));
}

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Make sure command registration sees guilds
  await registerCommands();
});

// In-memory “cart” for each user (simple + effective for starters)
const userDraft = new Map(); // key: userId => { product,size,colour,qty }

client.on("interactionCreate", async (interaction) => {
  try {
    // /order
    if (interaction.isChatInputCommand() && interaction.commandName === "order") {
      userDraft.set(interaction.user.id, {});

      const row1 = new ActionRowBuilder().addComponents(
        makeSelect("product", "Select product", PRODUCTS)
      );
      const row2 = new ActionRowBuilder().addComponents(
        makeSelect("size", "Select size", SIZES)
      );
      const row3 = new ActionRowBuilder().addComponents(
        makeSelect("colour", "Select colour", COLOURS)
      );
      const row4 = new ActionRowBuilder().addComponents(
        makeSelect("qty", "Select quantity", QUANTITIES)
      );

      const row5 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("confirm")
          .setLabel("Confirm Order")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("cancel")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({
        content: "Build your order using the dropdowns, then hit **Confirm Order**.",
        components: [row1, row2, row3, row4, row5],
        ephemeral: true, // only the user sees it
      });
      return;
    }

    // Dropdown selections
    if (interaction.isStringSelectMenu()) {
      const draft = userDraft.get(interaction.user.id) || {};
      const picked = interaction.values?.[0];

      if (interaction.customId === "product") draft.product = picked;
      if (interaction.customId === "size") draft.size = picked;
      if (interaction.customId === "colour") draft.colour = picked;
      if (interaction.customId === "qty") draft.qty = picked;

      userDraft.set(interaction.user.id, draft);

      const summary =
        `**Current order:**\n` +
        `• Product: ${draft.product ?? "—"}\n` +
        `• Size: ${draft.size ?? "—"}\n` +
        `• Colour: ${draft.colour ?? "—"}\n` +
        `• Qty: ${draft.qty ?? "—"}`;

      await interaction.update({
        content:
          "Build your order using the dropdowns, then hit **Confirm Order**.\n\n" + summary,
        components: interaction.message.components,
      });
      return;
    }

    // Buttons
    if (interaction.isButton()) {
      const draft = userDraft.get(interaction.user.id) || {};
      if (interaction.customId === "cancel") {
        userDraft.delete(interaction.user.id);
        await interaction.update({
          content: "❌ Order cancelled.",
          components: [],
        });
        return;
      }

      if (interaction.customId === "confirm") {
        const missing = ["product", "size", "colour", "qty"].filter((k) => !draft[k]);
        if (missing.length) {
          await interaction.reply({
            content: `Please select: **${missing.join(", ")}** before confirming.`,
            ephemeral: true,
          });
          return;
        }

        const ordersChannel = await client.channels.fetch(ORDERS_CHANNEL_ID);

        await ordersChannel.send(
          `🛒 **New Order**\n` +
            `User: <@${interaction.user.id}>\n` +
            `Product: **${draft.product}**\n` +
            `Size: **${draft.size}**\n` +
            `Colour: **${draft.colour}**\n` +
            `Quantity: **${draft.qty}**`
        );

        userDraft.delete(interaction.user.id);

        await interaction.update({
          content: "✅ Order submitted! A team member will follow up with payment.",
          components: [],
        });
        return;
      }
    }
  } catch (err) {
    console.error(err);
    if (interaction.isRepliable()) {
      await interaction.reply({
        content: "Something went wrong. Check bot logs and try again.",
        ephemeral: true,
      }).catch(() => {});
    }
  }
});

client.login(TOKEN);
