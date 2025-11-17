import makeWASocket, { delay, useMultiFileAuthState, fetchLatestWaWebVersion, jidNormalizedUser, DisconnectReason, Browsers } from "@whiskeysockets/baileys"
import pino from "pino"
import { Boom } from "@hapi/boom"
import fs from "fs"
import readline from "node:readline"

const question = (text) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        return new Promise((resolve) => {
            rl.question(text, resolve);
        });
};

const startSock = async () => {
   const { state, saveCreds } = await useMultiFileAuthState("./sessions")
   const { version, isLatest } = await fetchLatestWaWebVersion()

   console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`)

   const sock = makeWASocket({
      version,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      auth: state,
      browser: Browsers.ubuntu('Chrome'),
      markOnlineOnConnect: false
   })

   // login dengan pairing
   if (!sock.authState.creds.registered) {
      console.log("- Silakan masukkan nomor WhatsApp Anda, misalnya 628xxxx") 
      let phone = await question("\x1b[32m- Nomor Anda: \x1b[39m") 
      let phoneNumber = phone.replace(/[^0-9]/g, '')
      const PHONE_CC = await (await fetch('https://raw.githubusercontent.com/eabdalmufid/Databasee/refs/heads/main/data/countryphonecode.json')).json()
      if (!Object.keys(PHONE_CC).some(v => phoneNumber.startsWith(v))) throw "Start with your country's WhatsApp code, Example : 62xxx"

      await delay(3000)
      let code = await sock.requestPairingCode(phoneNumber, "WHATSAPP")
      console.log(`\x1b[32m- Kode Tautan: ${code?.match(/.{1,4}/g)?.join("-") || code}\x1b[39m`)
   }

   // kanggo info, restart or close
   sock.ev.on("connection.update", (update) => {
      const { lastDisconnect, connection } = update
      if (connection) {
         console.info(`Connection Status : ${connection}`)
      }

      if (connection === "close") {
         let reason = new Boom(lastDisconnect?.error)?.output.statusCode

         switch (reason) {
            case DisconnectReason.badSession:
               console.info(`Bad Session File, Restart Required`)
               startSock()
               break
            case DisconnectReason.connectionClosed:
               console.info("Connection Closed, Restart Required")
               startSock()
               break
            case DisconnectReason.connectionLost:
               console.info("Connection Lost from Server, Reconnecting...")
               startSock()
               break
            case DisconnectReason.connectionReplaced:
               console.info("Connection Replaced, Restart Required")
               startSock()
               break
            case DisconnectReason.restartRequired:
               console.info("Restart Required, Restarting...")
               startSock()
               break
            case DisconnectReason.loggedOut:
               console.error("Device has Logged Out, please rescan again...")
               fs.rmdirSync("./sessions")
               break
            case DisconnectReason.multideviceMismatch:
               console.error("Nedd Multi Device Version, please update and rescan again...")
               fs.rmdirSync("./sessions")
               break
            default: 
               console.log("Aku ra ngerti masalah opo iki")
               startSock()
         }
      }

      if (connection === "open") {
         sock.sendMessage(jidNormalizedUser(sock.user.id), { text: `${sock.user?.name || "Bot"} has Connected...` }, { ephemeralExpiration: 86400 })
      }
   })

   // write session kang
   sock.ev.on("creds.update", saveCreds)

   // bagian pembaca status ono ng kene
   sock.ev.on("messages.upsert", async ({ messages }) => {
      let message = messages[0]
      if(!message.message) return
      await sock.sendPresenceUpdate("unavailable", message.key.remoteJid)

      if (message.key && !message.key.fromMe && message.key.remoteJid === "status@broadcast") {
         await sock.readMessages([message.key])
         await sock.sendMessage(jidNormalizedUser(sock.user.id), { text: `Read Story @${message.key.participant.split("@")[0]}`, mentions: [message.key.participant] }, { quoted: message, ephemeralExpiration: 86400 })
      }
   })

   process.on("uncaughtException", console.error)
   process.on("unhandledRejection", console.error)
}

startSock()