import "dotenv/config"

import makeWASocket, { delay, useMultiFileAuthState, fetchLatestWaWebVersion, makeInMemoryStore, jidNormalizedUser, PHONENUMBER_MCC, DisconnectReason, Browsers } from "@whiskeysockets/baileys"
import pino from "pino"
import { Boom } from "@hapi/boom"
import fs from "fs"

const logger = pino({ timestamp: () => `,"time":"${new Date().toJSON()}"` }).child({ class: "sock" })
logger.level = "fatal"

const useStore = process.argv.includes('--store')
const usePairingCode = process.env.PAIRING_NUMBER

const store = useStore ? makeInMemoryStore({ logger }) : undefined

const startSock = async () => {
   const { state, saveCreds } = await useMultiFileAuthState("./sessions")
   const { version, isLatest } = await fetchLatestWaWebVersion()

   console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`)

   const sock = makeWASocket.default({
      version,
      logger,
      printQRInTerminal: !usePairingCode,
      auth: state,
      browser: Browsers.ubuntu('Chrome'),
      markOnlineOnConnect: false,
      getMessage
   })

   if (useStore) store.bind(sock.ev)

   // login dengan pairing
   if (usePairingCode && !sock.authState.creds.registered) {
      let phoneNumber = usePairingCode.replace(/[^0-9]/g, '')

      if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) throw "Start with your country's WhatsApp code, Example : 62xxx"

      await delay(3000)
      let code = await sock.requestPairingCode(phoneNumber)
      console.log(`\x1b[32m${code?.match(/.{1,4}/g)?.join("-") || code}\x1b[39m`)
   }

   // ngewei info, restart or close
   sock.ev.on("connection.update", (update) => {
      const { lastDisconnect, connection, qr } = update
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
         sock.sendPresenceUpdate('unavailable')
         sock.sendMessage(jidNormalizedUser(sock.user.id), { text: `${sock.user?.name} has Connected...` }, { ephemeralExpiration: 86400 })
      }
   })

   // write session kang
   sock.ev.on("creds.update", saveCreds)
   
   // presence update
   sock.ev.on('presence.update', async () => {
      await sock.sendPresenceUpdate('unavailable')
   })

   // bagian pepmbaca status ono ng kene
   sock.ev.on("messages.upsert", async ({ messages }) => {
      let message = messages[0]

      if (message.key && !message.key.fromMe && message.key.remoteJid === "status@broadcast") {
         await sock.readMessages([message.key])
         await sock.sendMessage(jidNormalizedUser(sock.user.id), { text: `Read Story @${message.key.participant.split("@")[0]}`, mentions: [message.key.participant] }, { quoted: message, ephemeralExpiration: 86400 })
      }
   })

   process.on("uncaughtException", console.error)
   process.on("unhandledRejection", console.error)
}

// opsional
async function getMessage(key) {
   try {
      if (useStore) {
         const jid = jidNormalizedUser(key.remoteJid)
         const msg = await store.loadMessage(jid, key.id)

         return msg?.message || ""
      }

      return ""
   } catch { }
}

startSock()