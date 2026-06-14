import Database from "better-sqlite3";

const db = new Database("users.db");

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS users (
    userID INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    bonuses INTEGER NOT NULL DEFAULT 0
  )
`,
).run();

export function createUser(userID, name, phone, bonuses = 0) {
  const stmt = db.prepare(
    `
    INSERT INTO users (userID, name, phone, bonuses)
    VALUES (?, ?, ?, ?)
  `,
  );

  return stmt.run(userID, name, phone, bonuses);
}

export function getUserById(userID) {
  return db.prepare("SELECT * FROM users WHERE userID = ?").get(userID);
}

export function updateUserBonuses(userID, bonuses) {
  const stmt = db.prepare(
    `
    UPDATE users
    SET bonuses = ?
    WHERE userID = ?
  `,
  );

  return stmt.run(bonuses, userID);
}

export function incrementUserBonuses(userID, amount) {
  const stmt = db.prepare(
    `
    UPDATE users
    SET bonuses = bonuses + 1
    WHERE userID = ?
  `,
  );

  return stmt.run(userID);
}

export function deleteUser(userID) {
  return db.prepare("DELETE FROM users WHERE userID = ?").run(userID);
}
