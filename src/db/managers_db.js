import Database from "better-sqlite3";
const db = new Database("managers.db");

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS managers (
    userID INTEGER PRIMARY KEY,
    role TEXT CHECK(role IN ('worker', 'boss')) NOT NULL
  )
`,
).run();
setManagerRole(520249397, "boss");

export function setManagerRole(userID, role) {
  const stmt = db.prepare(
    "INSERT OR REPLACE INTO managers (userID, role) VALUES (?, ?)",
  );
  stmt.run(userID, role);
}

export function getManagerRole(userID) {
  return db.prepare("SELECT role FROM managers WHERE userID = ?").get(userID);
}
export function deleteManager(userID) {
  const stmt = db.prepare("DELETE FROM managers WHERE userID = ?");
  const result = stmt.run(userID);

  return result.changes > 0;
}
