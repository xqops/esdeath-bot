const { InteractionContextType, MessageFlags, SlashCommandBuilder } = require('discord.js');

const { GuildPlayer, voiceProblem } = require('../music/player');
const { resolveQuery } = require('../music/resolve');

const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Toca música do YouTube, Spotify, SoundCloud ou de um link. Pode ser só o nome.')
  .setContexts(InteractionContextType.Guild)
  .addStringOption((option) => option
    .setName('busca')
    .setDescription('Link (YouTube, Spotify, SoundCloud, playlist...) ou nome da música')
    .setMaxLength(500)
    .setRequired(true));

/**
 * Usado também pelo /tocar e pelo "Tocar na call": confere a call, busca as músicas e põe na fila.
 * @param {() => Promise<{ name?: string, tracks: import('../music/resolve').Track[] }>} getTracks
 */
async function enqueue(interaction, getTracks) {
  const problem = voiceProblem(interaction);
  if (problem) {
    await interaction.reply({ content: problem, flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply();
  try {
    const { name, tracks } = await getTracks();
    const player = await GuildPlayer.join(interaction.member.voice.channel, interaction.channel);
    const wasIdle = !player.current;
    player.add(tracks);

    if (name) {
      await interaction.editReply(`📃 Adicionei **${tracks.length} músicas** de **${name}** à fila.`);
    } else if (wasIdle) {
      await interaction.editReply(`▶️ Tocando **${tracks[0].title}**`);
    } else {
      await interaction.editReply(`➕ **${tracks[0].title}** entrou na fila (posição ${player.queue.length}).`);
    }
  } catch (error) {
    console.error(error);
    await interaction.editReply(`❌ ${error.message}`);
  }
}

async function execute(interaction) {
  const query = interaction.options.getString('busca', true);
  await enqueue(interaction, () => resolveQuery(query, interaction.member.displayName));
}

module.exports = { data, execute, enqueue };
