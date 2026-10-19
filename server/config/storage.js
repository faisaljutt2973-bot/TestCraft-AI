const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const uuidv4 = () => crypto.randomUUID();

const DATA_DIR = path.join(__dirname, '../data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const SETTINGS_ID = 'global';

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial storage structure
const defaultStore = {
  users: [],
  boards: [],
  books: [],
  syllabuses: [],
  questions: [],
  testPapers: [],
  examPlans: [],
  supportTickets: [],
  settings: {
    aiProvider: 'gemini',
    geminiApiKey: '',
    openaiApiKey: '',
    googleBooksApiKey: '',
    schoolName: 'Beacon International Academy',
    schoolLogo: '',
    examHeaderTemplate: 'MIDTERM EXAMINATION - 2026',
    maxExamDuration: 180,
    passingPercentage: 40,
    allowNegativeMarking: false,
  },
};

const readStore = () => {
  try {
    if (!fs.existsSync(STORE_PATH)) {
      fs.writeFileSync(STORE_PATH, JSON.stringify(defaultStore, null, 2), 'utf-8');
      return { ...defaultStore };
    }
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...defaultStore, ...parsed };
  } catch (err) {
    console.error('[Storage] Error reading store.json, returning defaults:', err);
    return { ...defaultStore };
  }
};

const writeStore = (data) => {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Storage] Error writing to store.json:', err);
  }
};

const matchFilter = (item, filter) => {
  if (!filter || Object.keys(filter).length === 0) return true;
  for (const key of Object.keys(filter)) {
    if (filter[key] === undefined) continue;
    if (filter[key] && typeof filter[key] === 'object' && filter[key].$in) {
      if (!filter[key].$in.includes(item[key])) return false;
    } else if (filter[key] && typeof filter[key] === 'object' && filter[key].$regex) {
      const regex = new RegExp(filter[key].$regex, filter[key].$options || 'i');
      if (!regex.test(item[key] || '')) return false;
    } else if (item[key] !== filter[key]) {
      return false;
    }
  }
  return true;
};

// ---------------------------------------------------------------------------
// Local JSON backend (fallback when MongoDB is unavailable)
// ---------------------------------------------------------------------------
const localBackend = {
  find(collection, filter = {}) {
    const store = readStore();
    const list = store[collection] || [];
    return list.filter((item) => matchFilter(item, filter));
  },

  findOne(collection, filter = {}) {
    const store = readStore();
    const list = store[collection] || [];
    return list.find((item) => matchFilter(item, filter)) || null;
  },

  findById(collection, id) {
    const store = readStore();
    const list = store[collection] || [];
    return list.find((item) => item.id === id || item._id === id) || null;
  },

  create(collection, data) {
    const store = readStore();
    if (!store[collection]) store[collection] = [];
    const item = {
      _id: uuidv4(),
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    };
    store[collection].push(item);
    writeStore(store);
    return item;
  },

  update(collection, id, updates) {
    const store = readStore();
    if (!store[collection]) return null;
    const index = store[collection].findIndex((item) => item.id === id || item._id === id);
    if (index === -1) return null;
    store[collection][index] = {
      ...store[collection][index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    writeStore(store);
    return store[collection][index];
  },

  delete(collection, id) {
    const store = readStore();
    if (!store[collection]) return false;
    const initialLen = store[collection].length;
    store[collection] = store[collection].filter((item) => item.id !== id && item._id !== id);
    const deleted = store[collection].length < initialLen;
    if (deleted) writeStore(store);
    return deleted;
  },

  count(collection, filter = {}) {
    return this.find(collection, filter).length;
  },

  getSettings() {
    const store = readStore();
    return store.settings || defaultStore.settings;
  },

  updateSettings(updates) {
    const store = readStore();
    store.settings = { ...(store.settings || defaultStore.settings), ...updates };
    writeStore(store);
    return store.settings;
  },
};

// ---------------------------------------------------------------------------
// MongoDB backend
// ---------------------------------------------------------------------------
const modelCache = {};

const isMongoReady = () => mongoose.connection && mongoose.connection.readyState === 1;

const getModel = (collection) => {
  if (modelCache[collection]) return modelCache[collection];
  const schema = new mongoose.Schema(
    { _id: { type: String } },
    { strict: false, versionKey: false, minimize: false, id: false }
  );
  const model =
    mongoose.models[collection] || mongoose.model(collection, schema, collection);
  modelCache[collection] = model;
  return model;
};

const stripUndefined = (obj) =>
  Object.fromEntries(Object.entries(obj || {}).filter(([, value]) => value !== undefined));

const toPlain = (doc) => {
  if (!doc) return doc;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  delete obj.__v;
  return obj;
};

const findByAnyId = (id) => ({
  $or: [{ id }, { _id: String(id) }],
});

const mongoBackend = {
  async find(collection, filter = {}) {
    const docs = await getModel(collection).find(stripUndefined(filter)).lean();
    return docs.map(toPlain);
  },

  async findOne(collection, filter = {}) {
    const doc = await getModel(collection).findOne(stripUndefined(filter)).lean();
    return toPlain(doc);
  },

  async findById(collection, id) {
    if (id === undefined || id === null) return null;
    const doc = await getModel(collection).findOne(findByAnyId(id)).lean();
    return toPlain(doc);
  },

  async create(collection, data) {
    const now = new Date().toISOString();
    const id = data.id || data._id || uuidv4();
    const payload = { ...data };
    delete payload._id;
    const doc = await getModel(collection).create({
      ...payload,
      _id: String(id),
      id: String(id),
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
    });
    return toPlain(doc);
  },

  async update(collection, id, updates) {
    const patch = { ...updates, updatedAt: new Date().toISOString() };
    delete patch._id;
    delete patch.id;
    delete patch.createdAt;
    const doc = await getModel(collection)
      .findOneAndUpdate(findByAnyId(id), { $set: patch }, { new: true, lean: true })
      .lean();
    return toPlain(doc);
  },

  async delete(collection, id) {
    const result = await getModel(collection).deleteOne(findByAnyId(id));
    return result.deletedCount > 0;
  },

  async count(collection, filter = {}) {
    return getModel(collection).countDocuments(stripUndefined(filter));
  },

  async getSettings() {
    const doc = await getModel('settings').findOne({ _id: SETTINGS_ID }).lean();
    if (!doc) return { ...defaultStore.settings };
    const { _id, id, createdAt, updatedAt, ...settings } = doc;
    return { ...defaultStore.settings, ...settings };
  },

  async updateSettings(updates) {
    const current = await this.getSettings();
    const merged = { ...current, ...updates };
    const now = new Date().toISOString();
    await getModel('settings').updateOne(
      { _id: SETTINGS_ID },
      {
        $set: { ...merged, id: SETTINGS_ID, updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );
    return merged;
  },
};

// ---------------------------------------------------------------------------
// Public API: MongoDB when connected, local JSON file otherwise.
// All methods are async so callers can use either backend transparently.
// ---------------------------------------------------------------------------
const Storage = {
  isMongo() {
    return isMongoReady();
  },

  async find(collection, filter = {}) {
    return isMongoReady() ? mongoBackend.find(collection, filter) : localBackend.find(collection, filter);
  },

  async findOne(collection, filter = {}) {
    return isMongoReady() ? mongoBackend.findOne(collection, filter) : localBackend.findOne(collection, filter);
  },

  async findById(collection, id) {
    return isMongoReady() ? mongoBackend.findById(collection, id) : localBackend.findById(collection, id);
  },

  async create(collection, data) {
    return isMongoReady() ? mongoBackend.create(collection, data) : localBackend.create(collection, data);
  },

  async update(collection, id, updates) {
    return isMongoReady() ? mongoBackend.update(collection, id, updates) : localBackend.update(collection, id, updates);
  },

  async delete(collection, id) {
    return isMongoReady() ? mongoBackend.delete(collection, id) : localBackend.delete(collection, id);
  },

  async count(collection, filter = {}) {
    return isMongoReady() ? mongoBackend.count(collection, filter) : localBackend.count(collection, filter);
  },

  async getSettings() {
    return isMongoReady() ? mongoBackend.getSettings() : localBackend.getSettings();
  },

  async updateSettings(updates) {
    return isMongoReady() ? mongoBackend.updateSettings(updates) : localBackend.updateSettings(updates);
  },
};

Storage.STORE_PATH = STORE_PATH;
Storage.defaultSettings = defaultStore.settings;

module.exports = Storage;
