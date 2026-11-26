import { Data, Effect, Exit } from "effect"
import type { DatabaseSync } from "node:sqlite"

export interface Migration {
  readonly version: number
  readonly sql: string
}

export class DatabaseSchemaTooNew extends Data.TaggedError("DatabaseSchemaTooNew")<{
  readonly databaseVersion: number
  readonly knownVersion: number
}> {
  override get message() {
    return `The database is at schema version ${this.databaseVersion}, but this build of ivin only knows up to version ${this.knownVersion}. It was written by a newer version of ivin: update ivin to open it.`
  }
}

export const migrations: readonly Migration[] = [
  {
    version: 1,
    sql: `CREATE TABLE projects (
      path TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      last_opened_at INTEGER NOT NULL
    )`,
  },
  {
    version: 2,
    sql: `CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      project_path TEXT NOT NULL,
      title TEXT NOT NULL,
      title_locked INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      last_activity_at INTEGER NOT NULL
    );
    CREATE INDEX sessions_by_project ON sessions (project_path, last_activity_at DESC);
    CREATE TABLE transcript_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions (id),
      sequence INTEGER NOT NULL,
      type TEXT NOT NULL,
      at INTEGER NOT NULL,
      payload TEXT NOT NULL,
      UNIQUE (session_id, sequence)
    )`,
  },
  {
    version: 3,
    sql: "ALTER TABLE sessions ADD COLUMN model TEXT NOT NULL DEFAULT 'sonnet'",
  },
  {
    version: 4,
    sql: "ALTER TABLE sessions ADD COLUMN provider_session_id TEXT",
  },
  {
    version: 5,
    sql: "ALTER TABLE sessions ADD COLUMN status TEXT NOT NULL DEFAULT 'idle'",
  },
  {
    version: 6,
    sql: `CREATE TABLE open_projects (
      path TEXT PRIMARY KEY,
      position INTEGER NOT NULL,
      selected_session_id TEXT
    );
    CREATE TABLE workspace (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      selected_project_path TEXT
    );
    CREATE TABLE tabs (
      session_id TEXT PRIMARY KEY,
      project_path TEXT NOT NULL,
      position INTEGER NOT NULL
    );
    CREATE INDEX tabs_by_project ON tabs (project_path, position);
    INSERT INTO open_projects (path, position, selected_session_id)
      SELECT p.path, 0, (
        SELECT s.id FROM sessions s WHERE s.project_path = p.path
        ORDER BY s.last_activity_at DESC, s.created_at DESC LIMIT 1
      )
      FROM projects p ORDER BY p.last_opened_at DESC LIMIT 1;
    INSERT INTO workspace (id, selected_project_path) SELECT 1, path FROM open_projects;
    INSERT INTO tabs (session_id, project_path, position)
      SELECT id, project_path, ROW_NUMBER() OVER (ORDER BY last_activity_at DESC, created_at DESC) - 1
      FROM sessions WHERE project_path IN (SELECT path FROM open_projects)`,
  },
  {
    version: 7,
    sql: `ALTER TABLE sessions ADD COLUMN working_folder TEXT NOT NULL DEFAULT '';
    ALTER TABLE sessions ADD COLUMN branch TEXT;
    UPDATE sessions SET working_folder = project_path`,
  },
  {
    version: 8,
    sql: `ALTER TABLE sessions ADD COLUMN status_changed_at INTEGER NOT NULL DEFAULT 0;
    UPDATE sessions SET status_changed_at = last_activity_at`,
  },
  {
    version: 9,
    sql: `ALTER TABLE sessions ADD COLUMN working_folder_deleted INTEGER NOT NULL DEFAULT 0`,
  },
  {
    version: 10,
    sql: `ALTER TABLE sessions ADD COLUMN harness TEXT NOT NULL DEFAULT 'claude'`,
  },
  {
    version: 11,
    sql: `ALTER TABLE sessions ADD COLUMN archived_at INTEGER`,
  },
  {
    version: 12,
    sql: `CREATE TABLE images (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions (id),
      number INTEGER NOT NULL,
      media_type TEXT NOT NULL,
      UNIQUE (session_id, number)
    )`,
  },
  {
    version: 13,
    sql: `ALTER TABLE sessions ADD COLUMN effort TEXT NOT NULL DEFAULT 'high';
    ALTER TABLE sessions ADD COLUMN permission_mode TEXT NOT NULL DEFAULT 'manual';
    ALTER TABLE sessions ADD COLUMN run_options_at INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE sessions ADD COLUMN confirmed_run_options TEXT;
    ALTER TABLE sessions ADD COLUMN relaunch_failure TEXT;
    UPDATE sessions SET run_options_at = created_at;
    UPDATE sessions
      SET confirmed_run_options = json_object('model', model, 'effort', effort, 'permissionMode', permission_mode)
      WHERE EXISTS (
        SELECT 1 FROM transcript_events e WHERE e.session_id = sessions.id AND e.type = 'user_message'
      )`,
  },
  {
    version: 14,
    sql: `ALTER TABLE images ADD COLUMN compressed_media_type TEXT`,
  },
  {
    version: 15,
    sql: `CREATE TABLE annotations (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      ns TEXT NOT NULL,
      kind TEXT NOT NULL,
      key TEXT,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX annotations_by_target ON annotations (target_type, target_id, kind);
    CREATE UNIQUE INDEX annotations_by_key ON annotations (target_type, target_id, ns, kind, key)
      WHERE key IS NOT NULL`,
  },
  {
    version: 16,
    sql: `CREATE TABLE sub_views (
      session_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      kind TEXT NOT NULL,
      path TEXT NOT NULL,
      working_folder TEXT NOT NULL,
      selected INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (session_id, kind, path)
    );
    CREATE INDEX sub_views_by_session ON sub_views (session_id, position)`,
  },
  {
    version: 17,
    sql: `
    ALTER TABLE tabs ADD COLUMN full_width INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE tabs ADD COLUMN session_tab_selected INTEGER NOT NULL DEFAULT 0`,
  },
  {
    version: 18,
    sql: `ALTER TABLE sessions ADD COLUMN title_source TEXT;
    UPDATE sessions SET title_source = CASE
      WHEN instr(
        (SELECT json_extract(e.payload, '$.text') FROM transcript_events e
         WHERE e.session_id = sessions.id AND e.type = 'user_message' ORDER BY e.sequence LIMIT 1),
        rtrim(title, '…')
      ) > 0 THEN 'message'
      ELSE 'user'
    END
    WHERE title_locked = 1;
    ALTER TABLE sessions DROP COLUMN title_locked`,
  },
  {
    version: 19,
    sql: `
    ALTER TABLE sessions ADD COLUMN pending_messages TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE sessions ADD COLUMN unread_messages TEXT NOT NULL DEFAULT '[]'`,
  },
  {
    version: 20,
    sql: "ALTER TABLE sessions ADD COLUMN waiting_for TEXT",
  },
  {
    version: 21,
    sql: `CREATE TABLE trusted_projects (path TEXT PRIMARY KEY);
    INSERT INTO trusted_projects (path) SELECT path FROM projects`,
  },
  {
    version: 22,
    sql: `
    CREATE TABLE transcript_items (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX transcript_items_by_position ON transcript_items (session_id, position);
    CREATE TABLE transcript_item_states (
      session_id TEXT PRIMARY KEY,
      version INTEGER NOT NULL,
      open_message_id TEXT
    );
    UPDATE transcript_events SET payload = json_remove(payload, '$.raw')`,
  },
  {
    version: 23,
    sql: "ALTER TABLE sessions ADD COLUMN background_tasks TEXT NOT NULL DEFAULT '[]'",
  },
  {
    version: 24,
    sql: `UPDATE sessions SET background_tasks = (
      SELECT json_group_array(json_object(
        'taskId', json_extract(i.payload, '$.taskId'),
        'kind', json_extract(i.payload, '$.kind'),
        'description', json_extract(i.payload, '$.description'),
        'itemId', i.id,
        'toolCallId', json_extract(i.payload, '$.toolCallId'),
        'at', json_extract(i.payload, '$.at')
      ))
      FROM (
        SELECT i.id, i.payload FROM json_each(sessions.background_tasks) t
        JOIN transcript_items i ON i.session_id = sessions.id AND i.type = 'task'
          AND json_extract(i.payload, '$.taskId') = json_extract(t.value, '$.taskId')
        ORDER BY t.key
      ) i
    )`,
  },
  {
    version: 25,
    sql: `
    CREATE TABLE sub_views_next (
      session_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      view TEXT NOT NULL,
      params TEXT NOT NULL,
      working_folder TEXT NOT NULL,
      selected INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (session_id, view, params)
    );
    INSERT INTO sub_views_next (session_id, position, view, params, working_folder, selected)
      SELECT session_id, position,
        CASE kind WHEN 'file' THEN 'files/file' ELSE 'changes/diff' END,
        CASE kind
          WHEN 'file' THEN json_object('path', path)
          WHEN 'diff' THEN json_object('kind', 'working', 'path', path)
          ELSE json_object('kind', 'committed', 'path', path)
        END,
        working_folder, selected
      FROM sub_views;
    DROP TABLE sub_views;
    ALTER TABLE sub_views_next RENAME TO sub_views;
    CREATE INDEX sub_views_by_session ON sub_views (session_id, position)`,
  },
  {
    version: 26,
    sql: `ALTER TABLE images ADD COLUMN sent_at INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE images ADD COLUMN deleted_at INTEGER;
    UPDATE images SET sent_at = COALESCE(
      (SELECT MIN(e.at) FROM transcript_events e, json_each(e.payload, '$.images') j
       WHERE e.session_id = images.session_id AND e.type = 'user_message'
         AND json_extract(j.value, '$.id') = images.id),
      (SELECT created_at FROM sessions WHERE id = images.session_id),
      0
    )`,
  },
  {
    version: 27,
    // Null: the folder differs from the project's, as for every session before workspaces.
    sql: "ALTER TABLE sessions ADD COLUMN in_worktree INTEGER",
  },
  {
    version: 28,
    sql: `CREATE TABLE plugin_storage (
      plugin TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (plugin, key)
    )`,
  },
  {
    version: 29,
    sql: `CREATE TABLE project_plugin_trust (
      project TEXT NOT NULL,
      plugin TEXT NOT NULL,
      hash TEXT NOT NULL,
      permissions TEXT NOT NULL,
      PRIMARY KEY (project, plugin)
    );
    CREATE TABLE project_plugin_full_trust (project TEXT PRIMARY KEY);
    CREATE TABLE project_plugin_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project TEXT NOT NULL,
      plugin TEXT NOT NULL,
      name TEXT NOT NULL,
      hash TEXT NOT NULL,
      at INTEGER NOT NULL,
      is_new INTEGER NOT NULL,
      files TEXT NOT NULL,
      diff TEXT NOT NULL,
      seen INTEGER NOT NULL DEFAULT 0
    )`,
  },
]

const inTransaction = <A, E>(db: DatabaseSync, body: Effect.Effect<A, E>) =>
  Effect.sync(() => db.exec("BEGIN IMMEDIATE")).pipe(
    Effect.andThen(
      body.pipe(
        Effect.onExit((exit) =>
          Effect.sync(() => db.exec(Exit.isSuccess(exit) ? "COMMIT" : "ROLLBACK")),
        ),
      ),
    ),
  )

export const runMigrations = (db: DatabaseSync, known: readonly Migration[] = migrations) =>
  inTransaction(
    db,
    Effect.gen(function* () {
      db.exec("CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY)")
      const row = db.prepare("SELECT MAX(version) AS version FROM migrations").get() as {
        version: number | null
      }
      const databaseVersion = row.version ?? 0
      const knownVersion = Math.max(0, ...known.map((migration) => migration.version))
      if (databaseVersion > knownVersion) {
        return yield* new DatabaseSchemaTooNew({ databaseVersion, knownVersion })
      }
      const pending = known
        .filter((migration) => migration.version > databaseVersion)
        .toSorted((a, b) => a.version - b.version)
      for (const migration of pending) {
        db.exec(migration.sql)
        db.prepare("INSERT INTO migrations (version) VALUES (?)").run(migration.version)
      }
    }),
  )
