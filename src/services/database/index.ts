import * as SQLite from 'expo-sqlite';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

const MIGRATIONS = [
  `
  CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    timezone TEXT NOT NULL,
    repeat_type TEXT NOT NULL,
    repeat_days TEXT NOT NULL DEFAULT '[]',
    priority TEXT NOT NULL,
    voice_id TEXT,
    voice_name TEXT,
    speech_rate REAL NOT NULL DEFAULT 1,
    speech_pitch REAL NOT NULL DEFAULT 1,
    snooze_minutes INTEGER NOT NULL DEFAULT 10,
    ringtone TEXT NOT NULL DEFAULT 'default',
    notification_id TEXT,
    notification_ids TEXT NOT NULL DEFAULT '[]',
    snooze_notification_id TEXT,
    alarm_id TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled',
    snoozed_until TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reminder_events (
    id TEXT PRIMARY KEY NOT NULL,
    reminder_id TEXT NOT NULL,
    occurrence_at TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (reminder_id) REFERENCES reminders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_reminders_scheduled_at ON reminders(scheduled_at);
  CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
  CREATE INDEX IF NOT EXISTS idx_events_occurrence ON reminder_events(occurrence_at);
  CREATE INDEX IF NOT EXISTS idx_events_reminder ON reminder_events(reminder_id);
  `,
];

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openAndMigrate();
  }
  return databasePromise;
}

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('ringo.db');
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version < MIGRATIONS.length) {
    for (let i = version; i < MIGRATIONS.length; i += 1) {
      await db.execAsync(MIGRATIONS[i]);
    }
    await db.execAsync(`PRAGMA user_version = ${MIGRATIONS.length}`);
  }
  return db;
}

export async function resetDatabaseForTests(): Promise<void> {
  if (databasePromise) {
    const db = await databasePromise;
    await db.closeAsync();
    databasePromise = null;
  }
}
