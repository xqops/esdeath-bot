require('./logger');
const { Client, Events, GatewayIntentBits, MessageFlags } = require('discord.js');

const { token, music } = require('./config');
const commands = require('./commands');
const legendarMensagem = require('./commands/legendar-mensagem');

const commandsByName = new Map(commands.map((command) => [command.data.name, command]));
const player = music ? require('./music/player') : null;

// GuildVoiceStates: pra saber em qual call a pessoa está.
const intents = [GatewayIntentBits.Guilds];
if (music) intents.push(GatewayIntentBits.GuildVoiceStates);
const client = new Client({ intents });

client.once(Events.ClientReady, (ready) => {
  console.log(`✅ Logado como ${ready.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  console.log(`→ ${interaction.user.tag}: ${interaction.commandName ?? interaction.customId ?? interaction.type}`);
  try {
    if (interaction.isChatInputCommand() || interaction.isMessageContextMenuCommand()) {
      await commandsByName.get(interaction.commandName)?.execute(interaction);
    } else if (interaction.isModalSubmit()
      && interaction.customId.startsWith(legendarMensagem.MODAL_PREFIX)) {
      await legendarMensagem.handleModal(interaction);
    } else if (player && interaction.isButton()
      && interaction.customId.startsWith(player.BUTTON_PREFIX)) {
      await player.handleButton(interaction);
    }
  } catch (error) {
    console.error(error);
    if (!interaction.isRepliable()) return;
    const content = '❌ Algo deu errado, tenta de novo.';
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content }).catch(() => {});
    } else {
      await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

if (player) {
  // Alguém entrou ou saiu de uma call: se o bot ficou sozinho, ele sai depois de um tempo.
  client.on(Events.VoiceStateUpdate, (oldState) => {
    player.GuildPlayer.get(oldState.guild.id)?.checkAlone();
  });

  require('./music/yt-dlp').ensureYtDlp()
    .catch((error) => console.error('[música] yt-dlp:', error.message));
}

client.login(token);
