const Discord = require('discord.js');
const express = require('express');
const Database = require('@replit/database');
const axios = require('axios');
const app = express();
const port = 3000;

process.env.TZ = 'America/New_York'

const baseURL = "https://TankTacticsService.drewcolgin.repl.co/";

const db = new Database();


/// REMOVE THIS BEFORE LIVE
// db.list().then(keys => {
//   for(let i=0; i<keys.length; ++i){
//       db.delete(keys[i]);
//   }
// });

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
  await db.set(discordId, { name, gameId: response.data })
  await db.set(response.data, discordId);
  await axios.put(`${baseURL}api/register/${response.data}`, { name })
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
    await db.set(user.id, { ...templateUserEntry })
  } else if (msg.channel.type === 'dm' && await waitingForResponse(msg.author.id)) {
    await db.delete(msg.author.id);
    const isAvailableName = await checkIfNameIsAvailable(msg.content);

    if (isAvailableName) {
      const gameId = await handleNewPlayer(msg.author.id, msg.content);
      msg.author.send(`Welcome to the war ${msg.content}\nYour game key is \`${gameId}\`. **Keep this a secret!**\nPlease see the rules for the game in the \`da-rules\` channel.\nYour personal (and secret) link to play is:\n'https://www.drewcolgin.com/tank-tactics/#/${gameId}'\n\n${process.env.INVITE_LINK}`)
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

app.put("/api/updateRole", async (req, res) => {
  try {
    const tankTacticsGuild = await client.guilds.fetch("877973946962690048");
    const discordId = await db.get(req.body.id);
    const discordUser = await tankTacticsGuild.members.fetch(discordId);
    discordUser.roles.set([])
    if (req.body.role === 'jury') {
      const juryRole = await tankTacticsGuild.roles.fetch('878134297733763143');
      await discordUser.roles.add(juryRole);
    } else if (req.body.role === 'commander') {
      const commanderRole = await tankTacticsGuild.roles.fetch('878020570686574602');
      await discordUser.roles.add(commanderRole);

    }
    res.sendStatus(200);
  } catch (error) {
    console.log(error);
    res.sendStatus(400);
  }
});

app.post("/api/clearChats", async (req, res) => {
  try {
    const highCommandChannel = await client.channels.fetch('877974291063394335')
    for (let i = 0; i < 5; i++) {
      await highCommandChannel.bulkDelete(100);
    }
    res.sendStatus(200);
  } catch (error) {
    console.log(error)
    res.sendStatus(400);
  }
})