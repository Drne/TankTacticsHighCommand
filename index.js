const Discord = require('discord.js');
const express = require('express');
const Database = require('@replit/database');
const axios = require('axios');
const app = express();
const port = 3000;

process.env.TZ = 'America/New_York'

const baseURL = "https://TankTacticsService.drewcolgin.repl.co/";

const db = new Database();

db.list().then(keys => {
  for(let i=0; i<keys.length; ++i){
      db.delete(keys[i]);
  }
});

app.get('/', (req, res) => res.send('I\'m alive, I promise'));

app.listen(port);

app.use(
  express.urlencoded({
    extended: true
  })
)

app.use(express.json())

const client = new Discord.Client();

const templateUserEntry = {
  name: null,
  gameId: null,
}

async function waitingForResponse(id) {
  const keys = await db.list()
  return keys.includes(id) && await db.get(id).then(user => user.name === null);
}

async function handleNewPlayer(discordId, name) {
  const response = await axios.get(`${baseURL}api/generate`)
  await db.set(discordId, {name, gameId: response.data})
  await axios.put(`${baseURL}api/register/${response.data}`, {name})
  const drew = await client.users.fetch(process.env.DREW_ID)
  await drew.send(`${name} registed with ID ${response.data}`)
  return response.data;
}

async function checkIfNameIsAvailable(name) {
  return await axios.get(`${baseURL}/api/nameCheck/${name}`).then(() => true).catch(() => false)
}

client.on('message', async (msg) => {
  if (msg.content.startsWith('/ping')) {
    msg.reply('Pong!')
  } else if (msg.content.startsWith('/invite')) {
    const inviteId = msg.content.split(' ')[1]
    const user = await client.users.fetch(inviteId);
    await msg.author.send(`Ok! Inviting ${user.username}`)
    await user.send("You've been invited to a game of Tank Tactics!\nTo accept this invitation, please respond with the name you'd like to use in the game.\nActual names encouraged e.g. `John`.\nOnce Set, this can not be changed!")
    await db.set(user.id, {...templateUserEntry})
  } else if (msg.channel.type === 'dm' && await waitingForResponse(msg.author.id)){
    const isAvailableName = await checkIfNameIsAvailable(msg.content);

    if (isAvailableName) {
      const gameId = await handleNewPlayer(msg.author.id, msg.content);
      msg.author.send(`Welcome to the war ${msg.content}\nYour game ID is \`${gameId}\`. *Keep this a secret!*\nPlease see the rules for the game in the \`da-rules\` channel.\n${process.env.INVITE_LINK}`)
    } else {
      msg.author.send("Name already taken. Please enter another")
    }
  }
})

client.on('guildMemberAdd', async (member) => {
  const role = await member.guild.roles.fetch('878020570686574602');
  await member.roles.add(role);
  let name = ''
  try {
    name = await db.get(member.id).name;
  } catch {
    name = ''
  }
  await member.setNickname(name)
})

client.login(process.env.DISCORD_TOKEN);

app.post("/api/event", async (req, res) => {
  try {
    const highCommandChannel = await client.channels.fetch('877974291063394335')
    await highCommandChannel.send(req.body.message)
    res.sendStatus(200);
  } catch {
    res.sendStatus(400);
  }
});
