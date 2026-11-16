const path = require('node:path');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');

const FONT_FAMILY = 'CaptionFont';
const EMOJI_FAMILY = 'CaptionEmoji';
const fontsDir = path.join(__dirname, '..', '..', 'assets', 'fonts');
GlobalFonts.registerFromPath(path.join(fontsDir, 'RobotoCondensed.ttf'), FONT_FAMILY);
GlobalFonts.registerFromPath(path.join(fontsDir, 'NotoEmoji.ttf'), EMOJI_FAMILY);

// Quebra o texto em linhas que caibam na largura (quebra palavras gigantes também).
function wrapText(ctx, text, maxWidth) {
  const lines = [];

  for (const paragraph of text.split(/\r?\n/)) {
    let current = '';

    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
        continue;
      }

      if (current) lines.push(current);

      // Palavra sozinha maior que a linha: corta em pedaços.
      current = '';
      for (const char of word) {
        if (ctx.measureText(current + char).width > maxWidth && current) {
          lines.push(current);
          current = char;
        } else {
          current += char;
        }
      }
    }

    lines.push(current);
  }

  return lines;
}

/**
 * Gera a faixa branca com o texto preto centralizado (estilo meme de legenda).
 * @returns {Buffer} PNG com a largura pedida e altura proporcional ao texto.
 */
function renderCaptionBar(text, width) {
  const fontSize = Math.max(18, Math.round(width / 9));
  const lineHeight = Math.round(fontSize * 1.15);
  const paddingX = Math.round(width * 0.05);
  const paddingY = Math.round(fontSize * 0.45);
  // Emoji: colorido com a fonte do Windows; fora dele (ex.: Discloud), a Noto Emoji em preto.
  const font = `800 ${fontSize}px ${FONT_FAMILY}, "Segoe UI Emoji", ${EMOJI_FAMILY}`;

  const measure = createCanvas(width, 10).getContext('2d');
  measure.font = font;
  const lines = wrapText(measure, text.trim(), width - paddingX * 2);

  const height = lines.length * lineHeight + paddingY * 2;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#000000';
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  lines.forEach((line, i) => {
    ctx.fillText(line, width / 2, paddingY + lineHeight * i + lineHeight / 2);
  });

  return canvas.toBuffer('image/png');
}

module.exports = { renderCaptionBar };
