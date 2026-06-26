import Database from "better-sqlite3";
import { getDatabasePath } from "./database_path.js";

const db = new Database(getDatabasePath("managers.db"));

const createAdminsTable = `
  CREATE TABLE IF NOT EXISTS admins (
    userID INTEGER PRIMARY KEY,
    role TEXT CHECK(role IN ('admin')) NOT NULL
  )
`;

const adminsTable = db
  .prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'admins'",
  )
  .get();

const legacyAccessTable = db
  .prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'managers'",
  )
  .get();

if (!adminsTable) {
  db.prepare(createAdminsTable).run();
}

if (legacyAccessTable) {
  db.transaction(() => {
    db.prepare(
      "INSERT OR IGNORE INTO admins (userID, role) SELECT userID, 'admin' FROM managers",
    ).run();
    db.prepare("DROP TABLE managers").run();
  })();
}

setAdminRole(520249397);

export function setAdminRole(userID) {
  const stmt = db.prepare(
    "INSERT OR REPLACE INTO admins (userID, role) VALUES (?, ?)",
  );
  stmt.run(userID, "admin");
}

export function getAdminRole(userID) {
  const admin = db
    .prepare("SELECT role FROM admins WHERE userID = ?")
    .get(userID);

  return admin ? admin.role : null;
}

export function deleteAdmin(userID) {
  const stmt = db.prepare("DELETE FROM admins WHERE userID = ?");
  const result = stmt.run(userID);

  return result.changes > 0;
}

export function getAllAdmins() {
  return db.prepare("SELECT userID, role FROM admins").all();
}
