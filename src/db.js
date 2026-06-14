const Database = require("better-sqlite3");

const db = new Database("managers.db");

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS managers (
    userID INTEGER PRIMARY KEY,
    role TEXT CHECK(role IN ('worker', 'boss')) NOT NULL
  )
`,
).run();
setManagerRole(520249397, "worker");

function setManagerRole(userID, role) {
  const stmt = db.prepare(
    "INSERT OR REPLACE INTO managers (userID, role) VALUES (?, ?)",
  );
  stmt.run(userID, role);
}

function getManagerRole(userID) {
  return db.prepare("SELECT role FROM managers WHERE userID = ?").get(userID);
}

module.exports = { setManagerRole, getManagerRole };
