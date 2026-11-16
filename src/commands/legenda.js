const {
  AttachmentBuilder,
  MessageFlags,
  SlashCommandBuilder,
} = require('discord.js');

const { makeCaptionGif } = require('../media/make-caption-gif');

const MAX_TEXT_LENGTH = 200;

const data = new SlashCommandBuilder()
  .setName('legenda')
  .setDescription('Coloca um texto em cima de um gif (estilo meme).')
  .addStringOption((option) => option
    .setName('texto')
    .setDescription('O texto que vai em cima do gif')
    .setMaxLength(MAX_TEXT_LENGTH)
    .setRequired(true))
  .addAttachmentOption((option) => option
    .setName('gif')
    .setDescription('Envie o gif (ou vídeo/imagem)'))
  .addStringOption((option) => option
    .setName('link')
    .setDescription('Ou cole o link do gif (Tenor, Giphy, link direto...)'));

// Usado também pelo menu de contexto: gera o gif e responde na interação já "deferida".
async function replyWithCaptionGif(interaction, url, text) {
  try {
    // Limite de upload do servidor (10 MB sem boost); deixa uma folga.
    const limit = interaction.attachmentSizeLimit ?? 10 * 1024 * 1024;
    const gif = await makeCaptionGif({ url, text, maxBytes: limit - 256 * 1024 });
    await interaction.editReply({
      files: [new AttachmentBuilder(gif, { name: 'legenda.gif' })],
    });
  } catch (error) {
    console.error(error);
    await interaction.editReply({ content: `❌ ${error.message}` });
  }
}

async function execute(interaction) {
  const text = interaction.options.getString('texto', true);
  const attachment = interaction.options.getAttachment('gif');
  const link = interaction.options.getString('link');

  const url = attachment?.url ?? link;
  if (!url) {
    await interaction.reply({
      content: 'Manda um gif no campo `gif` ou cola um link no campo `link` 😉',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply();
  await replyWithCaptionGif(interaction, url, text);
}

module.exports = { data, execute, replyWithCaptionGif, MAX_TEXT_LENGTH };
