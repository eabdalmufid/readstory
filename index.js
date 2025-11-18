import makeWASocket, { delay, useMultiFileAuthState, fetchLatestWaWebVersion, jidNormalizedUser, DisconnectReason, Browsers } from "@whiskeysockets/baileys"
import pino from "pino"
import { Boom } from "@hapi/boom"
import fs from "fs"
import readline from "node:readline"

const question = (text) => {
   const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
   return new Promise((resolve) => rl.question(text, resolve))
}

const startSock = async () => {
   const { state, saveCreds } = await useMultiFileAuthState("./sessions")
   const { version } = await fetchLatestWaWebVersion()

   const sock = makeWASocket({
      version,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      auth: state,
      browser: Browsers.ubuntu('Chrome'),
      markOnlineOnConnect: false
   })

   // Login dengan pairing code
   if (!sock.authState.creds.registered) {
      const phone = await question("\x1b[32mMasukkan nomor WhatsApp (contoh: 628xxx): \x1b[39m") 
      const phoneNumber = phone.replace(/[^0-9]/g, '')
      
      const PHONE_CC = await (await fetch('https://raw.githubusercontent.com/eabdalmufid/Databasee/refs/heads/main/data/countryphonecode.json')).json()
      if (!Object.keys(PHONE_CC).some(v => phoneNumber.startsWith(v))) {
         throw "Mulai dengan kode negara WhatsApp Anda, contoh: 62xxx"
      }

      await delay(3000)
      const code = await sock.requestPairingCode(phoneNumber)
      console.log(`\x1b[32mKode Pairing: ${code?.match(/.{1,4}/g)?.join("-") || code}\x1b[39m`)
   }

   // Handle connection updates
   sock.ev.on("connection.update", (update) => {
      const { lastDisconnect, connection } = update
      
      if (connection === "close") {
         const reason = new Boom(lastDisconnect?.error)?.output.statusCode
         const shouldReconnect = reason !== DisconnectReason.loggedOut && reason !== DisconnectReason.multideviceMismatch
         
         if (shouldReconnect) {
            startSock()
         } else {
            fs.rmdirSync("./sessions", { recursive: true })
         }
      }

      if (connection === "open") {
         sock.sendMessage(jidNormalizedUser(sock.user.id), { text: "Bot Connected ✓" }, { ephemeralExpiration: 86400 })
      }
   })

   sock.ev.on("creds.update", saveCreds)

   // Auto read WhatsApp stories
   sock.ev.on("messages.upsert", async ({ messages }) => {
      const msg = messages[0]
      if (!msg.message) return

      if (msg.key.remoteJid === "status@broadcast" && !msg.key.fromMe) {
         await sock.readMessages([msg.key])
         await sock.sendMessage(
            jidNormalizedUser(sock.user.id), 
            { text: `Story dibaca: @${msg.key.participant.split("@")[0]}`, mentions: [msg.key.participant] },
            { ephemeralExpiration: 86400 }
         )
      }
   })
}

startSock()