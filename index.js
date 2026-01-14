console.log("🚀 BOT STARTING...")

const {
  default: makeWASocket,
  useMultiFileAuthState,
  getContentType
} = require("@whiskeysockets/baileys")

const Pino = require("pino")
const qrcode = require("qrcode-terminal")

/* ================= CONFIG ================= */
const OWNER = ["6288298699071"] // OWNER
let MODE_PUBLIC = true
let ONLY_GC = false
let ONLY_PC = false

let owners = new Set(OWNER)
let premium = new Set()

let antilinkAll = false
let welcomeOn = true
let goodbyeOn = true
/* ========================================= */

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./session")

  const sock = makeWASocket({
    auth: state,
    logger: Pino({ level: "silent" }),
    browser: ["Sonzcy", "Chrome", "20.0"]
  })

  sock.ev.on("creds.update", saveCreds)

  /* ===== CONNECTION ===== */
  sock.ev.on("connection.update", (update) => {
    const { connection, qr } = update
    if (qr) qrcode.generate(qr, { small: true })
    if (connection === "open") console.log("✅ BOT SONZCY ONLINE")
  })

  /* ===== WELCOME & GOODBYE ===== */
  sock.ev.on("group-participants.update", async ({ id, participants, action }) => {
    const meta = await sock.groupMetadata(id)

    for (let user of participants) {
      const jid = typeof user === "string" ? user : user.id
      if (!jid) continue

      const nomor = jid.split("@")[0]

      if (action === "add" && welcomeOn) {
        await sock.sendMessage(id, {
          text: `「 SELAMAT DATANG 👋 」

@${nomor}
Selamat datang di *${meta.subject}*

📌 Harap patuhi aturan grup
🚫 No link / spam / judol`,
          mentions: [jid]
        })
      }

      if (action === "remove" && goodbyeOn) {
        await sock.sendMessage(id, {
          text: `👋 @${nomor} telah keluar dari grup`,
          mentions: [jid]
        })
      }
    }
  })

  /* ===== MESSAGE HANDLER ===== */
  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0]
    if (!msg || !msg.message || msg.key.fromMe) return

    const from = msg.key.remoteJid
    const isGroup = from.endsWith("@g.us")
    const sender = isGroup ? msg.key.participant : from
    const senderNum = sender.split("@")[0]

    const type = getContentType(msg.message)
    const text =
      type === "conversation"
        ? msg.message.conversation
        : msg.message.extendedTextMessage?.text || ""

    const isOwner = owners.has(senderNum)

    if (!MODE_PUBLIC && !isOwner) return
    if (ONLY_GC && !isGroup) return
    if (ONLY_PC && isGroup) return

    /* ===== ADMIN CHECK ===== */
    let isAdmin = false
    let isBotAdmin = false
    if (isGroup) {
      const meta = await sock.groupMetadata(from)
      const admins = meta.participants.filter(p => p.admin).map(p => p.id)
      isAdmin = admins.includes(sender)

      const botJid = sock.user.id.split(":")[0] + "@s.whatsapp.net"
      isBotAdmin = admins.includes(botJid)
    }

    /* ===== ANTILINK AUTO (HAPUS + KICK) ===== */
    if (
      isGroup &&
      antilinkAll &&
      !isAdmin &&
      /chat\.whatsapp\.com|wa\.me|instagram\.com|t\.me|http|https|www/i.test(text)
    ) {
      await sock.sendMessage(from, { delete: msg.key })

      await sock.sendMessage(from, {
        text: `「 Tautan Terdeteksi 🚫 」

@${senderNum} mengirim tautan
⛔ Auto kick diaktifkan`,
        mentions: [sender]
      })

      if (isBotAdmin) {
        await sock.groupParticipantsUpdate(from, [sender], "remove")
      }
      return
    }

    if (!text.startsWith(".")) return
    const command = text.toLowerCase().split(" ")[0]
    const args = text.split(" ").slice(1)

    /* ===== TARGET ===== */
    const ctx = msg.message.extendedTextMessage?.contextInfo
    const target =
      ctx?.mentionedJid?.length
        ? ctx.mentionedJid
        : ctx?.participant
        ? [ctx.participant]
        : []

    /* ===== MENU ===== */
    if (command === ".menu") {
      return sock.sendMessage(from, {
        text: `🤖「 Bot Sonzcy 」
Mode: ${MODE_PUBLIC ? "Public" : "Self"}

╭──• OWNER
├ .addowner
├ .listowner
├ .addprem
├ .listprem
├ .self / .public

╭──• GROUP
├ .open / .close
├ .kick
├ .promote / .demote
├ .antilinkall
├ .welcome on/off
├ .goodbye on/off`
      })
    }

    /* ===== OWNER ===== */
    if (command === ".self" && isOwner) MODE_PUBLIC = false
    if (command === ".public" && isOwner) MODE_PUBLIC = true

    if (command === ".addowner" && isOwner && args[0]) {
      owners.add(args[0])
      return sock.sendMessage(from, { text: `✅ Owner ditambah: ${args[0]}` })
    }

    if (command === ".listowner") {
      return sock.sendMessage(from, { text: [...owners].join("\n") })
    }

    if (command === ".addprem" && isOwner && args[0]) {
      premium.add(args[0])
      return sock.sendMessage(from, { text: `⭐ Premium: ${args[0]}` })
    }

    if (command === ".listprem") {
      return sock.sendMessage(from, { text: [...premium].join("\n") })
    }

    /* ===== GROUP CONTROL ===== */
    if (command === ".open" && isGroup && isAdmin)
      return sock.groupSettingUpdate(from, "not_announcement")

    if (command === ".close" && isGroup && isAdmin)
      return sock.groupSettingUpdate(from, "announcement")

    if (command === ".kick" && isGroup && isAdmin && isBotAdmin && target.length)
      return sock.groupParticipantsUpdate(from, target, "remove")

    if (command === ".promote" && isGroup && isAdmin && isBotAdmin && target.length)
      return sock.groupParticipantsUpdate(from, target, "promote")

    if (command === ".demote" && isGroup && isAdmin && isBotAdmin && target.length)
      return sock.groupParticipantsUpdate(from, target, "demote")

    if (command === ".antilinkall" && isAdmin) {
      antilinkAll = !antilinkAll
      return sock.sendMessage(from, {
        text: `🚫 Antilink ALL: ${antilinkAll ? "AKTIF" : "MATI"}`
      })
    }

    if (command === ".welcome" && isAdmin) {
      welcomeOn = args[0] === "on"
      return sock.sendMessage(from, {
        text: `🎉 Welcome: ${welcomeOn ? "ON" : "OFF"}`
      })
    }

    if (command === ".goodbye" && isAdmin) {
      goodbyeOn = args[0] === "on"
      return sock.sendMessage(from, {
        text: `👋 Goodbye: ${goodbyeOn ? "ON" : "OFF"}`
      })
    }
  })
}

startBot()
