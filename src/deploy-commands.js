const { REST, Routes } = require('discord.js');

const { token, clientId, guildId } = require('./config');
const commands = require('./commands');

const body = commands.map((command) => command.data.toJSON());
const rest = new REST().setToken(token);

const route = guildId
  ? Routes.applicationGuildCommands(clientId, guildId)
  : Routes.applicationCommands(clientId);

rest.put(route, { body })
  .then(() => console.log(`✅ ${body.length} comandos registrados${guildId ? ' no servidor' : ' globalmente'}.`))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
