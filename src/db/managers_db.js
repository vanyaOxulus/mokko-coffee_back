import Database from "better-sqlite3";
import { deleteUser } from "./user_db.js";
import { getDatabasePath } from "./database_path.js";

const db = new Database(getDatabasePath("managers.db"));

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS managers (
    userID INTEGER PRIMARY KEY,
    role TEXT CHECK(role IN ('worker', 'boss')) NOT NULL
  )
`,
).run();
setManagerRole(520249397, "boss");

export async function setManagerRole(userID, role) {
  await deleteUser(userID);
  const stmt = db.prepare(
    "INSERT OR REPLACE INTO managers (userID, role) VALUES (?, ?)",
  );
  stmt.run(userID, role);
}

export function getManagerRole(userID) {
  return db.prepare("SELECT role FROM managers WHERE userID = ?").get(userID)
    ? db.prepare("SELECT role FROM managers WHERE userID = ?").get(userID).role
    : null;
}
export function deleteManager(userID) {
  const stmt = db.prepare("DELETE FROM managers WHERE userID = ?");
  const result = stmt.run(userID);

  return result.changes > 0;
}

export function getAllManagers() {
  return db.prepare("SELECT userID, role FROM managers").all();
}
