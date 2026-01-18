"use strict";

/*
=========================================
 BOT WHATSAPP SONZCY - UPGRADE FINAL
 1 FILE UTUH - PRIVATE & GROUP READY
 Fitur: AI, Media, Grup, AFK, Auto Security
=========================================
*/

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  getContentType,
  downloadContentFromMessage
} = require("@whiskeysockets/baileys");

const Pino = require("pino");
const fs = require("fs");
const path = require("path");
const qrcode = require("qrcode-terminal");
const axios = require("axios");

/* ================= CONFIG ================= */

const BOT_NAME = "Sonzcy";
let MODE = "public"; // public / self
const OWNER = ["6288298699071"]; // 🔴 GANTI NOMOR KAMU
const SESSION_DIR = "./session";
const TMP_DIR = "./tmp";

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

/* ================= DATABASE ================= */

const DB_FILE = "./database.json";
let db = {
  afk: {},
  welcome: {},
  antilink: {},
  antibadword: {}
};
if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE));

const saveDB = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));


/* ================= UTIL ================= */

const sleep = ms => new Promise(res => setTimeout(res, ms));
const isOwner = jid => OWNER.includes(jid.split("@")[0]);
const pickRandom = arr => arr[Math.floor(Math.random() * arr.length)];

async function streamToBuffer(stream) {
  let buffer = Buffer.from([]);
  for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
  return buffer;
}

/* ================= AUTO SECURITY ================= */

process.on("uncaughtException", err => console.log("[ERROR]", err));
process.on("unhandledRejection", err => console.log("[PROMISE ERROR]", err));

/* ================= AI DUMMY ================= */

async function askAI(text) {
  return `🤖 AI Sonzcy\n\nPertanyaan:\n${text}\n\nJawaban sementara:\nAI aktif (upgrade siap API)`;
}

/* ================= MAIN BOT ================= */

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: Pino({ level: "silent" }),
    auth: state,
    printQRInTerminal: false,
    browser: ["Sonzcy Bot", "Chrome", "1.0"]
  });

  /* ===== CONNECTION ===== */
  sock.ev.on("connection.update", update => {
    const { connection, qr, lastDisconnect } = update;
    if (qr) {
      qrcode.generate(qr, { small: true });
      console.log("📱 Scan QR di atas");
    }
    if (connection === "open") console.log(`✅ BOT ${BOT_NAME} ONLINE`);
    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) {
        console.log("♻️ Reconnecting...");
        startBot();
      } else console.log("❌ Logout. Hapus folder session.");
    }
  });

  sock.ev.on("creds.update", saveCreds);

  /* ===== GROUP PARTICIPANT EVENTS ===== */
  sock.ev.on("group-participants.update", async update => {
    const id = update.id;
    if (!db.welcome[id]) return;

    for (const user of update.participants) {
      try {
        if (update.action === "add") {
          await sock.sendMessage(id, {
            text: `👋 Welcome @${user.split("@")[0]}`,
            mentions: [user]
          });
        }
        if (update.action === "remove") {
          await sock.sendMessage(id, {
            text: `👋 Goodbye @${user.split("@")[0]}`,
            mentions: [user]
          });
        }
      } catch {}
    }
  });

  /* ===== MESSAGES HANDLER ===== */
  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const msg = messages[0];
      if (!msg.message) return;
      if (msg.key.remoteJid === "status@broadcast") return;

      const from = msg.key.remoteJid;
      const isGroup = from.endsWith("@g.us");
      const sender = isGroup ? msg.key.participant : from;
      const type = getContentType(msg.message);

      const body =
        type === "conversation"
          ? msg.message.conversation
          : type === "extendedTextMessage"
          ? msg.message.extendedTextMessage.text
          : "";

      if (!body) return;
      if (MODE === "self" && !isOwner(sender)) return;

      /* ===== AFK AUTO REPLY ===== */
      if (isGroup) {
        const mentioned =
          msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        for (const jid of mentioned) {
          if (db.afk[jid])
            await sock.sendMessage(from, {
              text: `⚠️ @${jid.split("@")[0]} sedang AFK\nAlasan: ${db.afk[jid]}`,
              mentions: [jid]
            });
        }
      }

      const prefix = ".";
      if (!body.startsWith(prefix)) return;
      const args = body.slice(1).trim().split(/ +/);
      const command = args.shift().toLowerCase();
      const text = args.join(" ");

      /* ===== GROUP PARTICIPANTS HANDLER ===== */
sock.ev.on("group-participants.update", async update => {
  const gid = update.id;
  if (!gid) return;

  for (const user of update.participants) {
    const uname = user.split("@")[0];
    if (update.action === "add") {
      // Welcome ramah
      await sock.sendMessage(gid, {
        text: `👋 Selamat datang @${uname} di grup *${(await sock.groupMetadata(gid)).subject}*!\nSemoga betah ya 😊`,
        mentions: [user]
      });
    }
    if (update.action === "remove") {
      await sock.sendMessage(gid, {
        text: `😢 @${uname} telah meninggalkan grup.`,
        mentions: [user]
      });
    }
  }
});

/* ===== MESSAGE HANDLER ===== */
sock.ev.on("messages.upsert", async ({ messages }) => {
  const msg = messages[0];
  if (!msg.message || msg.key.remoteJid === "status@broadcast") return;

  const from = msg.key.remoteJid;
  const isGroup = from.endsWith("@g.us");
  const sender = isGroup ? msg.key.participant : from;
  const type = getContentType(msg.message);
  const body =
    type === "conversation"
      ? msg.message.conversation
      : type === "extendedTextMessage"
      ? msg.message.extendedTextMessage.text
      : "";

  // Hapus link otomatis jika .antilink aktif
  if (db.antilink[from] && /https?:\/\//i.test(body) && !isOwner(sender)) {
    await sock.sendMessage(from, { text: "❌ Link terdeteksi, pesan dihapus." });
    await sock.sendMessage(from, { delete: { remoteJid: from, id: msg.key.id, fromMe: false } });
    return;
  }

  // Hapus pesan virtex jika .antivirtex aktif
  if (db.antivirtex[from] && body && body.length > 5000 && !isOwner(sender)) {
    await sock.sendMessage(from, { text: "❌ Pesan terlalu panjang / virtex, dihapus." });
    await sock.sendMessage(from, { delete: { remoteJid: from, id: msg.key.id, fromMe: false } });
    return;
  }

  // ... lanjut ke command handler
});


      /* ================= COMMAND ================= */
      switch (command) {

        /* ===== MENU ===== */
        case "menu":
          await sock.sendMessage(from, {
            text: `🤖 *${BOT_NAME}* Mode: ${MODE}\n\n` +
              `👤 USER\n• .menu\n• .ping\n• .afk <alasan>\n• .unafk\n\n` +
              `👥 GROUP\n• .welcome on/off\n• .goodbye on/off\n• .hidetag\n• .listadmin\n• .listmember\n• .antilink on/off\n• .antibadword on/off\n\n` +
              `👑 OWNER\n• .self\n• .public\n• .restart\n• .shutdown\n\n` +
              `🛠 MEDIA\n• .sticker\n• .toimg\n• .tts\n• .ocr\n\n` +
              `💡 AI\n• .ask pertanyaan`
          });
        break;
        case "antivirtex":
  if (!isGroup || !isOwner(sender)) return;
  if (args[0] === "on") db.antivirtex[from] = true;
  else if (args[0] === "off") { if (db.antivirtex) delete db.antivirtex[from]; }
  saveDB();
  await sock.sendMessage(from, { text: `Antivirtex ${args[0]}` });
break;
        /* ===== PING ===== */
        case "ping":
          await sock.sendMessage(from, { text: "🏓 PONG" });
        break;

        /* ===== AFK ===== */
        case "afk":
          db.afk[sender] = text || "AFK";
          saveDB();
          await sock.sendMessage(from, { text: "AFK aktif" });
        break;

        case "unafk":
          delete db.afk[sender];
          saveDB();
          await sock.sendMessage(from, { text: "AFK nonaktif" });
        break;

        /* ===== WELCOME / GOODBYE ===== */
        case "welcome":
          if (!isGroup || !isOwner(sender)) return;
          if (args[0] === "on") db.welcome[from] = true;
          else if (args[0] === "off") delete db.welcome[from];
          saveDB();
          await sock.sendMessage(from, { text: `Welcome ${args[0]}` });
        break;

        case "goodbye":
          if (!isGroup || !isOwner(sender)) return;
         case "goodbye":
  if (!isGroup || !isOwner(sender)) return;
  if (args[0] === "on") {
    db.goodbye = db.goodbye || {};
    db.goodbye[from] = true;
  } else if (args[0] === "off") {
    if (db.goodbye) delete db.goodbye[from];
  }
  saveDB();
  await sock.sendMessage(from, { text: `Goodbye ${args[0]}` });
break;

          saveDB();
          await sock.sendMessage(from, { text: `Goodbye ${args[0]}` });
        break;

        /* ===== HIDETAG ===== */
        case "hidetag":
          if (!isGroup || !isOwner(sender)) return;
          const meta = await sock.groupMetadata(from);
          await sock.sendMessage(from, {
            text: args.join(" ") || "Hidetag",
            mentions: meta.participants.map(p => p.id)
          });
        break;

        /* ===== LIST ADMIN & MEMBER ===== */
        case "listadmin":
          if (!isGroup) return;
          const metaAdmin = await sock.groupMetadata(from);
          const admins = metaAdmin.participants.filter(p => p.admin);
          let adminText = "👮 Admin Grup:\n\n";
          admins.forEach(a => adminText += `• @${a.id.split("@")[0]}\n`);
          await sock.sendMessage(from, { text: adminText, mentions: admins.map(a => a.id) });
        break;

        case "listmember":
          if (!isGroup) return;
          const metaMem = await sock.groupMetadata(from);
          let memText = `👥 Member (${metaMem.participants.length})\n\n`;
          metaMem.participants.forEach(m => memText += `• @${m.id.split("@")[0]}\n`);
          await sock.sendMessage(from, { text: memText, mentions: metaMem.participants.map(m => m.id) });
        break;

        /* ===== OWNER COMMAND ===== */
        case "self":
          if (!isOwner(sender)) return;
          MODE = "self";
          await sock.sendMessage(from, { text: "Mode SELF aktif" });
        break;

        case "public":
          if (!isOwner(sender)) return;
          MODE = "public";
          await sock.sendMessage(from, { text: "Mode PUBLIC aktif" });
        break;

        case "restart":
          if (!isOwner(sender)) return;
          await sock.sendMessage(from, { text: "Restarting..." });
          process.exit(0);
        break;

        case "shutdown":
          if (!isOwner(sender)) return;
          await sock.sendMessage(from, { text: "Bot dimatikan" });
          process.exit(0);
        break;

        /* ===== AI ===== */
        case "ask":
          if (!text) return sock.sendMessage(from, { text: "Masukkan pertanyaan." });
          const ai = await askAI(text);
          await sock.sendMessage(from, { text: ai });
        break;

        /* ===== MEDIA ===== */
        case "sticker":
        case "s":
          try {
            const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted) return sock.sendMessage(from, { text: "Reply gambar / video." });
            const qType = getContentType(quoted);
            if (!["imageMessage", "videoMessage"].includes(qType))
              return sock.sendMessage(from, { text: "Reply gambar / video." });
            const stream = await downloadContentFromMessage(quoted[qType], qType.replace("Message",""));
            const buffer = await streamToBuffer(stream);
            await sock.sendMessage(from, { sticker: buffer });
          } catch { return; }
        break;

        case "toimg":
          try {
            const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted || !quoted.stickerMessage) return sock.sendMessage(from, { text: "Reply sticker." });
            const stream = await downloadContentFromMessage(quoted.stickerMessage, "sticker");
            const buffer = await streamToBuffer(stream);
            await sock.sendMessage(from, { image: buffer, caption: "Converted" });
          } catch {}
        break;

        case "tts":
          if (!text) return sock.sendMessage(from, { text: "Masukkan teks." });
          const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=id&client=tw-ob&q=${encodeURIComponent(text)}`;
          await sock.sendMessage(from, { audio: { url }, mimetype: "audio/mp4", ptt: true });
        break;

        default:
        break;
      }

      /* ===== AUTO ANTI LINK ===== */
      if (isGroup & db.antilink[from]) {
        const linkRegex = /(https?:\/\/|www\.)\S+/gi;
        if (linkRegex.test(body)) {
          await sock.sendMessage(from, { text: `⚠️ Link tidak diizinkan!` });
          try { await sock.sendMessage(from, { delete: { remoteJid: from, id: msg.key.id, fromMe: false } }); } catch {}
        }
      }

      /* ===== AUTO ANTI BAD WORD ===== */
      if (isGroup && db.antibadword[from]) {
        const badWords = ["anjing","babi","bangsat","kontol","memek"]; // contoh
        if (badWords.some(w => body.toLowerCase().includes(w))) {
          await sock.sendMessage(from, { text: `⚠️ Kata kasar tidak diizinkan!` });
          try { await sock.sendMessage(from, { delete: { remoteJid: from, id: msg.key.id, fromMe: false } }); } catch {}
        }
      }

    } catch (e) { console.log("MSG ERROR:", e); }
  });
}

/* ================= START BOT ================= */
startBot();
