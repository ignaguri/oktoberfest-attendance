# Offline Database Architecture

How the mobile app's offline-first SQLite layer works, and how to make schema changes.

## Overview

The mobile app uses an offline-first architecture where all data is stored locally in SQLite and synced with the Supabase backend. The key components:

| Component | File(s) | Purpose |
|-----------|---------|---------|
| **Drizzle Schema** | `lib/database/schema/*.ts` | Table definitions (source of truth) |
| **Drizzle Migrations** | `drizzle/*.sql` | Generated DDL for creating/altering tables |
| **Migration Runner** | `lib/database/migrations.ts` | Applies pending migrations on app startup |
| **Query Helpers** | `lib/database/queries.ts` | Type-safe Drizzle query builders |
| **Query Keys** | `lib/database/query-keys.ts` | Centralized TanStack Query cache keys |
| **Hooks** | `lib/database/hooks.ts` | React hooks for reading/writing local data |
| **Adapted Hooks** | `lib/database/adapted-hooks.ts` | Adapter layer matching shared API hook types |
| **Sync Manager** | `lib/database/sync-manager.ts` | Pull from Supabase, push dirty records |
| **Sync Queue** | `lib/database/sync-queue.ts` | Queue for pending write operations |
| **Queue Processor** | `lib/database/queue-processor.ts` | Processes queued operations with retries |
| **Offline Provider** | `lib/database/offline-provider.tsx` | React context providing DB + sync state |
| **DB Init** | `lib/database/init.ts` | Opens SQLite, runs migrations, integrity checks |

## How It Works

### Startup Flow

```
App Launch
  → openDatabase() (init.ts)
  → checkDatabaseIntegrity()
  → runMigrations() (migrations.ts)
      → Reads PRAGMA user_version
      → Applies pending Drizzle SQL migrations
      → Updates PRAGMA user_version
  → OfflineDataProvider renders
      → Creates SyncManager
      → Triggers initial pull sync
```

### Read Flow

```
Screen Component
  → useLocalAttendances(festivalId)     [hooks.ts]
      → useQuery with localKeys.attendances.all(festivalId)
      → queryAttendancesByFestival(drizzleDb, festivalId)  [queries.ts]
          → Drizzle: db.select().from(attendances).where(...)
      → Returns typed data to component
```

### Write Flow (Optimistic)

```
User taps "Save"
  → useLocalSaveAttendance mutation      [hooks.ts]
      → Write to SQLite immediately (INSERT/UPDATE)
      → Mark record as _dirty = 1
      → enqueueOperation() to sync queue  [sync-queue.ts]
      → Invalidate relevant query keys
      → UI updates instantly (optimistic)

Later, when online:
  → SyncManager.pushDirtyRecords()       [sync-manager.ts]
      → QueueProcessor processes pending operations
      → Calls Hono API for each operation
      → On success: mark record _dirty = 0, _synced_at = now
      → On failure: increment retry_count, schedule retry
```

### Sync Flow

```
Pull (Server → Local):
  → SyncManager.pullTable("attendances")
      → Fetch from Supabase with last_pull_cursor
      → Upsert rows into SQLite
      → Update _sync_metadata.last_pull_cursor

Push (Local → Server):
  → QueueProcessor.processQueue()
      → Get pending operations from _sync_queue
      → For each operation:
          → Check dependencies (depends_on)
          → Call appropriate API endpoint
          → Mark completed or schedule retry
```

## Directory Structure

```
lib/database/
├── schema/                     # Drizzle schema definitions (source of truth)
│   ├── common.ts               # Shared offline columns (_synced_at, _deleted, _dirty)
│   ├── enums.ts                # All enum types and const arrays
│   ├── festivals.ts            # festivals table
│   ├── profiles.ts             # profiles table
│   ├── attendances.ts          # attendances table (with FK to festivals)
│   ├── consumptions.ts         # consumptions table (with FK to attendances, tents)
│   ├── beer-pictures.ts        # beer_pictures table (with photo columns)
│   ├── achievements.ts         # achievements + user_achievements tables
│   ├── groups.ts               # groups + group_members tables
│   ├── tents.ts                # tents + festival_tents + drink_type_prices + tent_visits
│   ├── winning-criteria.ts     # winning_criteria table
│   └── sync-tables.ts          # _sync_metadata + _sync_queue tables
├── db.ts                       # Drizzle wrapper (createDrizzleDb)
├── queries.ts                  # Type-safe Drizzle query helpers
├── query-keys.ts               # Centralized TanStack Query keys
├── hooks.ts                    # React hooks (read + mutation)
├── adapted-hooks.ts            # Adapter layer for shared hook types
├── schema.ts                   # Compatibility layer (type aliases, constants)
├── init.ts                     # Database open/close/reset
├── migrations.ts               # Migration runner
├── sync-manager.ts             # Pull/push sync logic
├── sync-queue.ts               # Sync queue CRUD operations
├── queue-processor.ts          # Queue processing with retries
├── offline-provider.tsx        # React context provider
├── provider.tsx                # Higher-level provider with status tracking
├── background-sync.ts          # Background sync scheduling
├── photo-queue.ts              # Photo upload queue
├── debug.ts                    # Debug utilities
├── types.ts                    # Utility types and helper functions
└── index.ts                    # Public API re-exports
```

## How to Make Schema Changes

### Step 1: Modify the Drizzle Schema

Edit the appropriate file in `lib/database/schema/`. For example, to add a `notes` column to attendances:

```typescript
// lib/database/schema/attendances.ts
export const attendances = sqliteTable("attendances", {
  id: text().primaryKey(),
  user_id: text().notNull(),
  festival_id: text().notNull().references(() => festivals.id),
  date: text().notNull(),
  beer_count: integer().notNull().default(0),
  notes: text(),  // ← NEW COLUMN
  created_at: text(),
  updated_at: text(),
  ...offlineColumns,
}, (t) => [
  // ... indexes
]);
```

**Important conventions:**
- Always use **snake_case** for column names (matches existing consumers)
- Use `.notNull()` for columns that should never be null
- Use `.default(value)` for columns with defaults
- Add `.references(() => otherTable.column)` for foreign keys

### Step 2: Generate the Migration

```bash
cd apps/mobile
npx drizzle-kit generate
```

This creates a new SQL file in `drizzle/` (e.g., `drizzle/0001_some_name.sql`).

### Step 3: Register the Migration

Add the new migration to `drizzle/migrations.js`:

```javascript
const migration0000 = fs.readFileSync(
  path.join(__dirname, "0000_busy_menace.sql"), "utf8"
);
const migration0001 = fs.readFileSync(
  path.join(__dirname, "0001_some_name.sql"), "utf8"  // ← ADD
);

module.exports = {
  migrations: [
    { name: "0000_busy_menace", sql: migration0000 },
    { name: "0001_some_name", sql: migration0001 },  // ← ADD
  ],
};
```

Then add the migration function in `lib/database/migrations.ts`:

```typescript
const MIGRATIONS: MigrationFn[] = [
  // v0 -> v1: Initial schema from Drizzle
  async (db) => { /* existing */ },

  // v1 -> v2: Add notes column to attendances  ← ADD
  async (db) => {
    const migration = drizzleMigrations.migrations[1];
    const statements = migration.sql
      .split("--> statement-breakpoint")
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
    for (const statement of statements) {
      await db.execAsync(statement);
    }
  },
];
```

### Step 4: Increment Schema Version

In `lib/database/schema.ts`:

```typescript
export const SCHEMA_VERSION = 2;  // was 1
```

### Step 5: Update Queries (if needed)

If you added a new column, you may need to:

1. **Update query helpers** in `queries.ts` if the column appears in SELECT lists
2. **Update hooks** in `hooks.ts` if the column is used in mutations
3. **Update adapted hooks** in `adapted-hooks.ts` if the column needs to be mapped

For simple `SELECT *` queries (most of them), the new column is automatically included since Drizzle's `.select()` returns all columns.

### Step 6: Update Sync (if needed)

If the new column is synced from/to the server:

1. **Pull**: Update the relevant `pullTable*` method in `sync-manager.ts` to handle the new field
2. **Push**: Update the payload format in the mutation hook and the push handler in `sync-manager.ts`

### Step 7: Test

```bash
# Type check
pnpm type-check --filter=@prostcounter/mobile

# Lint
pnpm lint --filter=@prostcounter/mobile

# Run tests
pnpm test --filter=@prostcounter/mobile

# Test migration chain from scratch (fresh database)
# Delete the app and reinstall, or use resetDatabase()
```

## Adding a New Table

### Step 1: Create the Schema File

Create a new file in `lib/database/schema/`:

```typescript
// lib/database/schema/my-table.ts
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { offlineColumns } from "./common";

export const myTable = sqliteTable("my_table", {
  id: text().primaryKey(),
  name: text().notNull(),
  // ... your columns
  ...offlineColumns,  // Include for synced tables
});

export type MyTableRow = typeof myTable.$inferSelect;
export type NewMyTableRow = typeof myTable.$inferInsert;
```

### Step 2: Register in db.ts

```typescript
// lib/database/db.ts
import { myTable } from "./schema/my-table";

export const schema = {
  // ... existing tables
  myTable,
};
```

### Step 3: Add Type Alias (if needed)

```typescript
// lib/database/schema.ts
import type { MyTableRow } from "./schema/my-table";
export type LocalMyTable = MyTableRow;
```

### Step 4: Add to Table Lists

In `lib/database/schema.ts`, add the table name to:
- `SyncableTable` union type (if synced)
- `MutableTable` union type (if user-editable)
- `SYNCABLE_TABLES` array (if synced)
- `MUTABLE_TABLES` array (if user-editable)
- `REFERENCE_TABLES` array (if reference/read-only)

### Step 5: Generate Migration

Follow steps 2-4 from "How to Make Schema Changes" above.

### Step 6: Add Query Helpers + Hooks

Add query functions to `queries.ts` and hooks to `hooks.ts`.

## Key Conventions

### Column Naming
- Always **snake_case** for Drizzle property names (e.g., `festival_id`, not `festivalId`)
- This matches the SQLite column names and avoids type mismatches with consumers

### Offline Columns
Every synced table must include `...offlineColumns` from `./common.ts`:
- `_synced_at` — timestamp of last successful sync
- `_deleted` — soft delete flag (0 or 1)
- `_dirty` — needs sync flag (0 or 1)

### Photo Tables
Tables with file uploads also include `...photoColumns`:
- `_pending_upload` — has a pending file upload (0 or 1)
- `_local_uri` — local file path before upload completes

### Query Keys
All query keys are defined in `query-keys.ts`. Never use hardcoded strings:

```typescript
// Good
queryKey: localKeys.attendances.all(festivalId)

// Bad
queryKey: ["local-attendances", festivalId]
```

### Table Name Safety
Use `SyncableTable` and `MutableTable` types instead of `string` for table names:

```typescript
// Good
function myFunction(tableName: SyncableTable) { ... }

// Bad
function myFunction(tableName: string) { ... }
```

## Drizzle ORM Quick Reference

### Select All
```typescript
const rows = await db.select().from(festivals).where(eq(festivals._deleted, 0));
```

### Select Specific Columns
```typescript
const rows = await db
  .select({ id: festivals.id, name: festivals.name })
  .from(festivals);
```

### JOIN with Aggregation
```typescript
const rows = await db
  .select({
    ...getTableColumns(attendances),
    drinkCount: sql<number>`COALESCE(COUNT(${consumptions.id}), 0)`,
  })
  .from(attendances)
  .leftJoin(consumptions, eq(consumptions.attendance_id, attendances.id))
  .groupBy(attendances.id);
```

### Insert
```typescript
await db.insert(attendances).values({
  id: generateUUID(),
  user_id: userId,
  festival_id: festivalId,
  date: date,
});
```

### Update
```typescript
await db.update(attendances)
  .set({ beer_count: 5, _dirty: 1 })
  .where(eq(attendances.id, attendanceId));
```

### Delete (soft)
```typescript
await db.update(attendances)
  .set({ _deleted: 1, _dirty: 1 })
  .where(eq(attendances.id, attendanceId));
```

## Troubleshooting

### "Migration failed"
- Check that `SCHEMA_VERSION` matches the number of migrations in the `MIGRATIONS` array
- Ensure the migration SQL is valid (test it manually in a SQLite client)
- Check `drizzle/migrations.js` has the correct file paths

### Type mismatches after schema change
- Run `npx tsc --noEmit` to see all type errors
- Check that you used snake_case in the Drizzle schema
- Ensure `.notNull()` is used where consumers expect non-null values

### Query returns wrong shape
- Drizzle's `.select()` without arguments returns all columns
- For JOINs, use explicit `.select({ ... })` to control the shape
- Check that the query function in `queries.ts` includes all needed columns
