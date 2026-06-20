import Database from "better-sqlite3";
import { getDatabasePath } from "./database_path.js";

const db = new Database(getDatabasePath("cards.db"));

db.prepare(
  `
  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    shortDescription TEXT NOT NULL,
    fullDescription TEXT NOT NULL
  )
`,
).run();

export function addCard(title, shortDescription, fullDescription) {
  const stmt = db.prepare(
    "INSERT INTO cards (title, shortDescription, fullDescription) VALUES (?, ?, ?)",
  );
  const result = stmt.run(title, shortDescription, fullDescription);
  return result.lastInsertRowid;
}

export function getAllCards() {
  return db.prepare("SELECT * FROM cards").all();
}

export function deleteCard(cardId) {
  const stmt = db.prepare("DELETE FROM cards WHERE id = ?");
  const result = stmt.run(cardId);
  return result.changes > 0;
}
