// playground.ts
import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import { DiscordAdapter } from "./src/adapters/audio/discordAdapter.js";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

(async () => {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });

  await client.login(process.env.DISCORD_BOT_TOKEN);

  client.on("ready", async () => {
    console.log(`Logged in as ${client.user?.tag}!`);

    const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID!);
    const channel = await guild.channels.fetch(process.env.DISCORD_CHANNEL_ID!);

    if (!channel?.isVoiceBased()) {
      throw new Error("Not a voice channel");
    }

    const adapter = new DiscordAdapter({
      guildId: guild.id,
      channelId: channel.id,
      adapterCreator: guild.voiceAdapterCreator as any,
      selfId: client.user!.id,
    });

    console.log("Listening for voice data...");

    let chunkCount = 0;
    for await (const chunk of adapter.pull()) {
      chunkCount++;
      console.log(`PCM chunk #${chunkCount}:`, chunk.data.length); // Should be 1920

      // Log first 10 chunks then periodically
      if (chunkCount > 10 && chunkCount % 50 !== 0) {
        continue;
      }
    }
  });

  client.on("error", (error) => {
    console.error("Discord client error:", error);
  });
})().catch(console.error);
