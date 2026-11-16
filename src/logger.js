const fs = require('node:fs');
const path = require('node:path');
const { format } = require('node:util');

// Copia tudo que sai no console pra logs/bot.log (com data e hora).
const logDir = path.join(__dirname, '..', 'logs');
fs.mkdirSync(logDir, { recursive: true });
const logFile = fs.createWriteStream(path.join(logDir, 'bot.log'), { flags: 'a' });

for (const level of ['log', 'warn', 'error']) {
  const original = console[level].bind(console);
  console[level] = (...args) => {
    original(...args);
    logFile.write(`[${new Date().toLocaleString('pt-BR')}] ${format(...args)}\n`);
  };
}
