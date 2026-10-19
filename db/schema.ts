import { pgTable, text, jsonb, primaryKey } from 'drizzle-orm/pg-core';

// One row per application entity preserves the existing controller data contract.
export const records = pgTable('testcraft_records', {
  collection: text('collection').notNull(),
  id: text('id').notNull(),
  data: jsonb('data').$type<Record<string, any>>().notNull(),
}, (table) => [primaryKey({ columns: [table.collection, table.id] })]);
