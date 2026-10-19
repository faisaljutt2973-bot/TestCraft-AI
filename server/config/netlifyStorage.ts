import { and, eq, or, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../../db/index.js';
import { records } from '../../db/schema.js';

type Document = Record<string, any>;

function matches(item: Document, filter: Document) {
  return Object.entries(filter).every(([key, value]) => {
    if (value === undefined) return true;
    if (value && typeof value === 'object' && value.$in) return value.$in.includes(item[key]);
    if (value && typeof value === 'object' && value.$regex) {
      return new RegExp(value.$regex, value.$options || 'i').test(item[key] || '');
    }
    return item[key] === value;
  });
}

function byId(collection: string, id: string) {
  return and(eq(records.collection, collection), or(eq(records.id, id), sql`${records.data}->>'_id' = ${id}`));
}

export const databaseStorage = {
  async find(collection: string, filter: Document = {}) {
    const rows = await getDb().select().from(records).where(eq(records.collection, collection));
    return rows.map(row => row.data).filter(item => matches(item, filter));
  },
  async findOne(collection: string, filter: Document = {}) {
    return (await this.find(collection, filter))[0] || null;
  },
  async findById(collection: string, id: string) {
    if (id == null) return null;
    const [row] = await getDb().select().from(records).where(byId(collection, id)).limit(1);
    return row?.data || null;
  },
  async create(collection: string, data: Document) {
    const id = String(data.id || data._id || randomUUID());
    const now = new Date().toISOString();
    const item = { createdAt: now, updatedAt: now, ...data, id, _id: id };
    await getDb().insert(records).values({ collection, id, data: item });
    return item;
  },
  async update(collection: string, id: string, updates: Document) {
    const { id: ignoredId, _id, createdAt, ...patch } = updates;
    patch.updatedAt = new Date().toISOString();
    const [row] = await getDb().update(records)
      .set({ data: sql`${records.data} || ${JSON.stringify(patch)}::jsonb` })
      .where(byId(collection, id)).returning();
    return row?.data || null;
  },
  async delete(collection: string, id: string) {
    const rows = await getDb().delete(records).where(byId(collection, id)).returning({ id: records.id });
    return rows.length > 0;
  },
  async count(collection: string, filter: Document = {}) {
    return (await this.find(collection, filter)).length;
  },
  async getSettings() {
    const { default: storage } = await import('./storage.js');
    const defaultSettings = storage.defaultSettings;
    const row = await this.findById('settings', 'global');
    const { id, _id, ...settings } = row || {};
    return { ...defaultSettings, ...settings };
  },
  async updateSettings(updates: Document) {
    const [row] = await getDb().insert(records)
      .values({ collection: 'settings', id: 'global', data: updates })
      .onConflictDoUpdate({
        target: [records.collection, records.id],
        set: { data: sql`${records.data} || ${JSON.stringify(updates)}::jsonb` },
      }).returning();
    const { default: storage } = await import('./storage.js');
    const defaultSettings = storage.defaultSettings;
    return { ...defaultSettings, ...row.data };
  },
};
