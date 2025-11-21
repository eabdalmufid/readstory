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
      rl.question(text, (answer) => {
         rl.close()
         resolve(answer)
      });
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
               fs.rmSync("./sessions", { recursive: true, force: true })
               break
            case DisconnectReason.multideviceMismatch:
               console.error("Nedd Multi Device Version, please update and rescan again...")
               fs.rmSync("./sessions", { recursive: true, force: true })
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

   sock.ev.on("messages.upsert", async ({ messages }) => {
      const msg = messages[0]
      if (!msg.message) return

      const from = jidNormalizedUser(msg.key.remoteJid.includes("@lid") ? msg.key.remoteJidAlt : msg.key.remoteJid)
      const isFromMe = msg.key.fromMe === true

      const msgType = Object.keys(msg.message)[0]
      const text =
         msgType === "conversation"
            ? msg.message.conversation
            : msgType === "extendedTextMessage"
               ? msg.message.extendedTextMessage.text
               : msg.message[msgType]?.caption || ""

      const prefixes = [".", "#", "!", "/"]
      const prefix = text && prefixes.find(p => text.startsWith(p))

      if (prefix && from !== "status@broadcast") {
         const body = text.slice(prefix.length).trim()
         const [rawCmd, ...restArgs] = body.split(/\s+/)
         const cmd = (rawCmd || "").toLowerCase()
         const args = restArgs // kalau perlu nanti

         switch (cmd) {
            case "ping":
               await sock.sendMessage(from, { text: `Speed: ${Date.now() - msg.messageTimestamp * 1000} ms` }, { quoted: msg })
               await sock.sendPresenceUpdate("unavailable", from)
               break
         }
         return
      }

      if (msg.key && !isFromMe && from === "status@broadcast") {
         await sock.readMessages([msg.key])
         await sock.sendMessage(jidNormalizedUser(sock.user.id), { text: `Read Story @${msg.key.participant.split("@")[0]}`, mentions: [msg.key.participant] }, { quoted: msg, ephemeralExpiration: 86400 })
         await sock.sendPresenceUpdate("unavailable", from)
      }
   })

   process.on("uncaughtException", console.error)
   process.on("unhandledRejection", console.error)
}

startSock()