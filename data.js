const fs = require("fs")
const DB_FILE = "./database.json"

let db = {
  users: {},
  groups: {},
  settings: {}
}

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2))
  }
  db = JSON.parse(fs.readFileSync(DB_FILE))
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2))
}

loadDB()

module.exports = { db, saveDB }
