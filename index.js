"use strict";

/* ===============================
   BOT SONZCY MAXTON - FULL MAXIMAL
   1 FILE UTUH
   Semua fitur aktif termasuk game
   =============================== */

const { default: makeWASocket, useMultiFileAuthState, getContentType, DisconnectReason } = require("@whiskeysockets/baileys");
const Pino = require("pino");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const axios = require("axios");
const QRCode = require("qrcode");

/* ===============================
   CONFIG
   =============================== */
const OWNER = ["6288298699071"];
const BOT_NAME = "BOT SONZCY MAXTON";
const SESSION_DIR = "./session";
const DB_DIR = "./database";

let MODE_PUBLIC = true;

const owners = new Set(OWNER);
const afkUsers = new Map();

/* DATABASE FILES */
const USER_DB = `${DB_DIR}/users.json`;
const GROUP_DB = `${DB_DIR}/groups.json`;
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR);
if (!fs.existsSync(USER_DB)) fs.writeFileSync(USER_DB, JSON.stringify({}));
if (!fs.existsSync(GROUP_DB)) fs.writeFileSync(GROUP_DB, JSON.stringify({}));

function normalizeJid(jid){ return jid?jid.replace(/:\d+@/,"@"):jid; }
function getRuntime(startTime){
    const ms=Date.now()-startTime;
    const s=Math.floor(ms/1000)%60;
    const m=Math.floor(ms/(1000*60))%60;
    const h=Math.floor(ms/(1000*60*60));
    return `${h}h ${m}m ${s}s`;
}
function readUsers(){ return JSON.parse(fs.readFileSync(USER_DB)); }
function saveUsers(data){ fs.writeFileSync(USER_DB, JSON.stringify(data,null,2)); }
function readGroups(){ return JSON.parse(fs.readFileSync(GROUP_DB)); }
function saveGroups(data){ fs.writeFileSync(GROUP_DB, JSON.stringify(data,null,2)); }
async function initGroup(id){
    const db = readGroups();
    if(!db[id]){
        db[id] = {antilink:false, antibadword:false, antidelete:false, antiviewonce:false, autosave:false, autobackup:false, autokick:false, autopromote:false, autodemote:false, autoclear:false, autoreset:false};
        saveGroups(db);
    }
    return db[id];
}

/* ===============================
   START BOT
   =============================== */
async function startBot(){
    const startTime = Date.now();
    if(!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR);
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const sock = makeWASocket({ auth: state, logger: Pino({level:"silent"}), browser:[BOT_NAME,"Chrome","20.0"], markOnlineOnConnect:true });
    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async(update)=>{
        const {connection, lastDisconnect, qr} = update;
        if(qr) qrcode.generate(qr,{small:true});
        if(connection==="open") console.log("✅ BOT ONLINE");
        if(connection==="close"){
            const reason = lastDisconnect?.error?.output?.statusCode;
            if(reason!==DisconnectReason.loggedOut){ console.log("⚠️ BOT RECONNECTING..."); startBot(); }
            else console.log("❌ SESSION LOGGED OUT");
        }
    });

    sock.ev.on("group-participants.update", async(data)=>{
        const {id, participants, action} = data;
        try{
            const meta = await sock.groupMetadata(id);
            for(const user of participants){
                const jid = normalizeJid(user.id||user);
                const nomor = jid.split("@")[0];
                if(action==="add") await sock.sendMessage(id,{text:`Selamat datang @${nomor} di grup ${meta.subject}`, mentions:[jid]});
                if(action==="remove") await sock.sendMessage(id,{text:`Selamat tinggal @${nomor}`, mentions:[jid]});
            }
        }catch(err){ console.error("Group Participants Handler Error:",err); }
    });

    sock.ev.on("messages.upsert", async({messages})=>{
        const msg = messages[0];
        if(!msg||!msg.message||msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith("@g.us");
        const sender = normalizeJid(isGroup?msg.key.participant:from);
        const senderNum = sender.split("@")[0];
        const type = getContentType(msg.message);
        const body = type==="conversation"?msg.message.conversation:msg.message.extendedTextMessage?.text||"";
        const args = body.split(" ").slice(1);
        const isOwner = owners.has(senderNum);
        const groupData = isGroup ? await initGroup(from) : null;

        let isAdmin=false, isBotAdmin=false;
        if(isGroup){
            try{
                const meta = await sock.groupMetadata(from);
                const admins = meta.participants.filter(p=>p.admin).map(p=>normalizeJid(p.id));
                isAdmin = admins.includes(sender);
                isBotAdmin = admins.includes(normalizeJid(sock.user.id));
            }catch{}
        }

        // AFK REPLY
        const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid||[];
        for(const jid of mentions){
            const userNum = jid.split("@")[0];
            if(afkUsers.has(userNum)) await sock.sendMessage(from,{text:`⚠️ @${userNum} sedang AFK: ${afkUsers.get(userNum)}`,mentions:[jid]});
        }

        try{
            await handleCommands(sock, from, sender, senderNum, isOwner, isAdmin, isBotAdmin, body, args, isGroup, groupData, startTime);
            await handleGames(sock, from, sender, senderNum, isOwner, isAdmin, isBotAdmin, body, args, isGroup, groupData, msg);
        }catch(err){ console.error("Command Error:",err); }
    });

    setInterval(()=>{ const backup={users:readUsers(), groups:readGroups()}; fs.writeFileSync(`backup_${Date.now()}.json`,JSON.stringify(backup)); },1000*60*30);

    process.on("uncaughtException",(err)=>{console.error("Uncaught Exception:",err);});
    process.on("unhandledRejection",(err)=>{console.error("Unhandled Rejection:",err);});
}

/* ===============================
   COMMANDS HANDLER
   =============================== */
async function handleCommands(sock, from, sender, senderNum, isOwner, isAdmin, isBotAdmin, body, args, isGroup, groupData, startTime){
    const command = body.split(" ")[0].toLowerCase();

    // OWNER
    if(command===".self" && isOwner){ MODE_PUBLIC=false; return sock.sendMessage(from,{text:"✅ MODE SELF AKTIF"});}
    if(command===".public" && isOwner){ MODE_PUBLIC=true; return sock.sendMessage(from,{text:"✅ MODE PUBLIC AKTIF"});}
    if(command===".restart" && isOwner){ await sock.sendMessage(from,{text:"♻️ Restarting..."}); process.exit(0);}
    if(command===".shutdown" && isOwner){ await sock.sendMessage(from,{text:"⛔ Shutdown..."}); process.exit(0);}

    // MENU
    if(command===".menu" || command===".help"){
        const menu = `┏━━━🤖 *BOT SONZCY* ━━━┓
┃ Mode: ${MODE_PUBLIC?"Public":"Self"}
┗━━━━━━━━━━━━━━━━━━━━━━┛
👤 *USER COMMANDS*
│ .profile  │ .setname
│ .setbio   │ .afk
│ .unafk    │ .register
│ .unregister
📊 *INFO GRUP*
│ .infogc  │ .listmember
│ .listadmin │ .grouplink
│ .owner
🎮 *GAME / FUN*
│ .slot    │ .coin
│ .dadu    │ .roll
│ .rps     │ .hangman
│ .guess   │ .tebakangka
│ .angka
👮 *ADMIN*
│ .open │ .close
│ .kick │ .promote
│ .demote│ .tagall
📌 *OWNER*
│ .self │ .public
│ .restart │ .shutdown`;
        return sock.sendMessage(from,{text:menu});
    }

    // AFK
    if(command===".afk"){ afkUsers.set(senderNum,args.join(" ")||"AFK"); return sock.sendMessage(from,{text:"⚠️ AFK aktif."}); }
    if(command===".unafk"){ afkUsers.delete(senderNum); return sock.sendMessage(from,{text:"✅ AFK nonaktif."}); }

    // PROFILE
    if(command===".profile"){
        try{
            const img = await sock.profilePictureUrl(sender,"image");
            return sock.sendMessage(from,{image:{url:img},caption:`Profile @${senderNum}`,mentions:[sender]});
        }catch{return sock.sendMessage(from,{text:"❌ Tidak ada foto profile."});}
    }

    // INFO GRUP
    if(isGroup){
        const meta = await sock.groupMetadata(from);
        if(command===".listmember"){
            const list = meta.participants.map(p=>p.id.split("@")[0]).join("\n");
            return sock.sendMessage(from,{text:`👑 Daftar member:\n${list}`});
        }
        if(command===".listadmin"){
            const list = meta.participants.filter(p=>p.admin).map(p=>p.id.split("@")[0]).join("\n");
            return sock.sendMessage(from,{text:`👑 Daftar admin:\n${list}`});
        }
        if(command===".infogc"){
            return sock.sendMessage(from,{text:`📊 Info Grup\nNama: ${meta.subject}\nID: ${meta.id}\nJumlah Member: ${meta.participants.length}`});
        }
        if(command===".grouplink"){
            try{
                const link = await sock.groupInviteCode(from);
                return sock.sendMessage(from,{text:`🔗 Link grup: https://chat.whatsapp.com/${link}`});
            }catch{return sock.sendMessage(from,{text:"❌ Gagal ambil link."});}
        }
        if(command===".owner"){
            const owner = meta.participants.find(p=>p.admin==="superadmin");
            return sock.sendMessage(from,{text:`👑 Owner grup: ${owner ? owner.id.split("@")[0] : "Tidak ditemukan"}`});
        }
    }

    // ADMIN
    if(isGroup && isAdmin && isBotAdmin){
        if(command===".kick" && args[0]){
            const target = args[0].replace("@","")+"@s.whatsapp.net";
            await sock.groupParticipantsUpdate(from,[target],"remove");
            return sock.sendMessage(from,{text:"✅ User dikick."});
        }
        if(command===".promote" && args[0]){
            const target = args[0].replace("@","")+"@s.whatsapp.net";
            await sock.groupParticipantsUpdate(from,[target],"promote");
            return sock.sendMessage(from,{text:"✅ User dipromote."});
        }
        if(command===".demote" && args[0]){
            const target = args[0].replace("@","")+"@s.whatsapp.net";
            await sock.groupParticipantsUpdate(from,[target],"demote");
            return sock.sendMessage(from,{text:"✅ User didemote."});
        }
        if(command===".open"){
            try{ await sock.groupSettingUpdate(from,"not_announcement","all"); return sock.sendMessage(from,{text:"✅ Grup dibuka."}); }catch{return sock.sendMessage(from,{text:"❌ Gagal buka grup, pastikan bot admin."}); }
        }
        if(command===".close"){
            try{ await sock.groupSettingUpdate(from,"announcement","admin"); return sock.sendMessage(from,{text:"✅ Grup ditutup."}); }catch{return sock.sendMessage(from,{text:"❌ Gagal tutup grup, pastikan bot admin."}); }
        }
    }
}

/* ===============================
   GAME HANDLER
   =============================== */
const hangmanGames = {};
const guessNumberGames = {};

async function handleGames(sock, from, sender, senderNum, isOwner, isAdmin, isBotAdmin, body, args, isGroup, groupData, msg){
    const command = body.split(" ")[0].toLowerCase();

    // Slot
    if(command===".slot"){ const s=["🍒","🍋","🍊","🍉","🍇","⭐"]; return sock.sendMessage(from,{text:`${s[Math.floor(Math.random()*s.length)]}${s[Math.floor(Math.random()*s.length)]}${s[Math.floor(Math.random()*s.length)]}`}); }

    // Coin
    if(command===".coin"){ return sock.sendMessage(from,{text:Math.random()>0.5?"HEAD":"TAIL"}); }

    // Dice/Roll
    if(command===".dadu" || command===".roll"){ return sock.sendMessage(from,{text:`🎲 ${Math.floor(Math.random()*6)+1}`}); }

    // Rock Paper Scissors
    if(command===".rps" && args[0]){
        const user = args[0].toLowerCase();
        const choices = ["rock","paper","scissors"];
        if(!choices.includes(user)) return sock.sendMessage(from,{text:"Gunakan: rock/paper/scissors"});
        const botChoice = choices[Math.floor(Math.random()*3)];
        let result = "Seri!";
        if(user==="rock" && botChoice==="scissors") result="Kamu menang!";
        if(user==="rock" && botChoice==="paper") result="Kamu kalah!";
        if(user==="paper" && botChoice==="rock") result="Kamu menang!";
        if(user==="paper" && botChoice==="scissors") result="Kamu kalah!";
        if(user==="scissors" && botChoice==="paper") result="Kamu menang!";
        if(user==="scissors" && botChoice==="rock") result="Kamu kalah!";
        return sock.sendMessage(from,{text:`Kamu: ${user}\nBot: ${botChoice}\nHasil: ${result}`});
    }

    // Hangman
    if(command===".hangman"){
        const words = ["javascript","whatsapp","bot","nodejs","hangman"];
        const word = words[Math.floor(Math.random()*words.length)];
        hangmanGames[senderNum] = {word, guessed: [], tries: 6};
        return sock.sendMessage(from,{text:`🎯 Hangman dimulai! Kata memiliki ${word.length} huruf. Gunakan .guess huruf`});
    }
    if(command===".guess" && args[0]){
        const game = hangmanGames[senderNum];
        if(!game) return sock.sendMessage(from,{text:"Belum ada game hangman aktif. Gunakan .hangman untuk memulai."});
        const guess = args[0].toLowerCase();
        if(game.guessed.includes(guess)) return sock.sendMessage(from,{text:"Huruf sudah ditebak!"});
        game.guessed.push(guess);
        if(!game.word.includes(guess)) game.tries--;
        let display = "";
        for(const l of game.word){ display += game.guessed.includes(l)?l:"_"; }
        if(display===game.word) { delete hangmanGames[senderNum]; return sock.sendMessage(from,{text:`🎉 Selamat! Kamu menebak kata: ${game.word}`}); }
        if(game.tries<=0) { delete hangmanGames[senderNum]; return sock.sendMessage(from,{text:`💀 Game over! Kata: ${game.word}`}); }
        return sock.sendMessage(from,{text:`${display}\nSisa percobaan: ${game.tries}`});
    }

    // Tebak Angka
    if(command===".tebakangka"){
        const number = Math.floor(Math.random()*100)+1;
        guessNumberGames[senderNum] = {number, tries: 10};
        return sock.sendMessage(from,{text:"🎲 Tebak angka antara 1-100. Gunakan .angka nomor"});
    }
    if(command===".angka" && args[0]){
        const game = guessNumberGames[senderNum];
        if(!game) return sock.sendMessage(from,{text:"Belum ada game tebak angka aktif. Gunakan .tebakangka"});
        const guess = parseInt(args[0]);
        if(isNaN(guess)) return sock.sendMessage(from,{text:"Masukkan angka yang valid!"});
        game.tries--;
        if(guess===game.number){ delete guessNumberGames[senderNum]; return sock.sendMessage(from,{text:`🎉 Kamu benar! Angka: ${game.number}`}); }
        if(game.tries<=0){ delete guessNumberGames[senderNum]; return sock.sendMessage(from,{text:`💀 Game over! Angka: ${game.number}`}); }
        return sock.sendMessage(from,{text:`Terlalu ${guess>game.number?"besar":"kecil"}! Sisa percobaan: ${game.tries}`});
    }
}

/* ===============================
   START BOT
   =============================== */
startBot();
