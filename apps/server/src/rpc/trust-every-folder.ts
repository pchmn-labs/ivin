import type { DatabaseSync } from "node:sqlite"

// For tests about something else than trust: every folder is inside `/`.
export const trustEveryFolder = (db: DatabaseSync) => {
  db.prepare("INSERT INTO trusted_projects (path) VALUES ('/')").run()
}
