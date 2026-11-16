const {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

const { replyWithCaptionGif, MAX_TEXT_LENGTH } = require('./legenda');

const MODAL_PREFIX = 'legendar:';
const TEXT_INPUT_ID = 'texto';

// Clique direito numa mensagem com gif > Apps > "Legendar GIF".
const data = new ContextMenuCommandBuilder()
  .setName('Legendar GIF')
  .setType(ApplicationCommandType.Message);

function findMediaUrl(message) {
  const attachment = message.attachments.find((a) => /^(image|video)\//.test(a.contentType ?? ''));
  if (attachment) return attachment.url;

  for (const embed of message.embeds) {
    // Gifs do Tenor/Giphy chegam como embed com vídeo.
    const url = embed.video?.url ?? embed.image?.url ?? embed.thumbnail?.url ?? embed.url;
    if (url) return url;
  }

  return message.content.match(/https?:\/\/\S+/)?.[0] ?? null;
}

async function execute(interaction) {
  const url = findMediaUrl(interaction.targetMessage);
  if (!url) {
    await interaction.reply({
      content: 'Não achei nenhum gif nessa mensagem 🤔',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // O link vai no customId pra recuperar quando o modal voltar (limite de 100 caracteres).
  const target = `${interaction.targetMessage.channelId}/${interaction.targetMessage.id}`;
  const modal = new ModalBuilder()
    .setCustomId(MODAL_PREFIX + target)
    .setTitle('Legendar GIF')
    .addLabelComponents(new LabelBuilder()
      .setLabel('Texto que vai em cima do gif')
      .setTextInputComponent(new TextInputBuilder()
        .setCustomId(TEXT_INPUT_ID)
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(MAX_TEXT_LENGTH)
        .setRequired(true)));

  await interaction.showModal(modal);
}

async function handleModal(interaction) {
  const [channelId, messageId] = interaction.customId.slice(MODAL_PREFIX.length).split('/');
  const text = interaction.fields.getTextInputValue(TEXT_INPUT_ID);

  await interaction.deferReply();

  const channel = await interaction.client.channels.fetch(channelId);
  const message = await channel.messages.fetch(messageId);
  await replyWithCaptionGif(interaction, findMediaUrl(message), text);
}

module.exports = { data, execute, handleModal, MODAL_PREFIX };
