/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import mysql from 'mysql2/promise';

/**
 * Optional Hostinger MySQL / MariaDB persistence adapter.
 * Uses prefixed `wg_*` tables so Wildgrove Sanctuary can safely share
 * an existing Hostinger database (e.g. with missingpiecepuzzles.fun)
 * without colliding with any other application's tables.
 */
export class MysqlSanctuaryStore {
  constructor(pool) {
    this.pool = pool;
  }

  static hasConfig() {
    const uri = (process.env.MYSQL_URL || process.env.DATABASE_URL || '').trim();
    if (uri && /^mysql2?:\/\//i.test(uri)) {
      return true;
    }
    const host = (process.env.MYSQL_HOST || process.env.DB_HOST || '').trim();
    const user = (process.env.MYSQL_USER || process.env.DB_USER || '').trim();
    const database = (
      process.env.MYSQL_NAME ||
      process.env.MYSQL_DATABASE ||
      process.env.DB_NAME ||
      ''
    ).trim();
    return Boolean(host && user && database);
  }

  static async create() {
    if (!MysqlSanctuaryStore.hasConfig()) {
      return null;
    }

    const basePoolOptions = {
      waitForConnections: true,
      connectionLimit: 4,
      maxIdle: 2,
      idleTimeout: 30000,
      queueLimit: 20,
      connectTimeout: 4000,
      enableKeepAlive: true,
      charset: 'utf8mb4',
    };

    let pool;
    const uri = (process.env.MYSQL_URL || process.env.DATABASE_URL || '').trim();
    if (uri && /^mysql2?:\/\//i.test(uri)) {
      pool = mysql.createPool({
        uri,
        ...basePoolOptions,
      });
    } else {
      const host = (process.env.MYSQL_HOST || process.env.DB_HOST || '127.0.0.1').trim();
      const port = Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306);
      const user = (process.env.MYSQL_USER || process.env.DB_USER || '').trim();
      const password = process.env.MYSQL_PASSWORD ?? process.env.DB_PASSWORD ?? '';
      const database = (
        process.env.MYSQL_NAME ||
        process.env.MYSQL_DATABASE ||
        process.env.DB_NAME ||
        ''
      ).trim();
      const sslRaw = (process.env.MYSQL_SSL || process.env.DB_SSL || '').trim().toLowerCase();
      const ssl = sslRaw === 'true' || sslRaw === '1' ? { rejectUnauthorized: true } : undefined;

      pool = mysql.createPool({
        host,
        port,
        user,
        password,
        database,
        ssl,
        ...basePoolOptions,
      });
    }

    const store = new MysqlSanctuaryStore(pool);
    try {
      await store.ensureSchema();
      return store;
    } catch (err) {
      await pool.end().catch(() => {});
      throw err;
    }
  }

  async ensureSchema() {
    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS wg_sanctuaries (
        sync_code VARCHAR(32) NOT NULL PRIMARY KEY,
        keeper_name VARCHAR(64) NOT NULL,
        sanctuary_name VARCHAR(96) NOT NULL,
        prestige INT NOT NULL DEFAULT 0,
        payload LONGTEXT NOT NULL,
        updated_at BIGINT NOT NULL,
        INDEX idx_wg_sanctuaries_prestige (prestige)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS wg_marketplace (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        seller_code VARCHAR(32) NOT NULL,
        payload TEXT NOT NULL,
        created_at BIGINT NOT NULL,
        INDEX idx_wg_marketplace_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS wg_chat (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        sender_code VARCHAR(32) NOT NULL,
        payload TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        INDEX idx_wg_chat_timestamp (timestamp)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS wg_admin_config (
        config_key VARCHAR(64) NOT NULL PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at BIGINT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async loadAll(seedSanctuaries, seedMarketplace, seedChat) {
    const [sanctuaryRows] = await this.pool.execute('SELECT sync_code, payload FROM wg_sanctuaries');
    const sanctuaries = {};
    for (const row of sanctuaryRows) {
      try {
        const parsed = JSON.parse(row.payload);
        if (parsed && parsed.syncCode) {
          sanctuaries[row.sync_code] = parsed;
        }
      } catch {
        // Ignore malformed row
      }
    }

    if (Object.keys(sanctuaries).length === 0) {
      for (const s of Object.values(seedSanctuaries)) {
        sanctuaries[s.syncCode] = s;
        await this.upsertSanctuary(s);
      }
    }

    const [marketRows] = await this.pool.execute(
      'SELECT payload FROM wg_marketplace ORDER BY created_at DESC LIMIT 40',
    );
    let marketplace = [];
    for (const row of marketRows) {
      try {
        const parsed = JSON.parse(row.payload);
        if (parsed && parsed.id) marketplace.push(parsed);
      } catch {
        // Ignore
      }
    }
    if (marketplace.length === 0) {
      marketplace = [...seedMarketplace];
      for (const item of marketplace) {
        await this.upsertListing(item);
      }
    }

    const [chatRows] = await this.pool.execute(
      'SELECT payload FROM wg_chat ORDER BY timestamp DESC LIMIT 80',
    );
    let chat = [];
    for (const row of chatRows) {
      try {
        const parsed = JSON.parse(row.payload);
        if (parsed && parsed.id) chat.push(parsed);
      } catch {
        // Ignore
      }
    }
    chat.reverse();
    if (chat.length === 0) {
      chat = [...seedChat];
      for (const msg of chat) {
        await this.insertChat(msg);
      }
    }

    return { sanctuaries, marketplace, chat };
  }

  async getSanctuary(syncCode) {
    const [rows] = await this.pool.execute(
      'SELECT payload FROM wg_sanctuaries WHERE sync_code = ? LIMIT 1',
      [syncCode],
    );
    if (!rows.length) return null;
    try {
      return JSON.parse(rows[0].payload);
    } catch {
      return null;
    }
  }

  async upsertSanctuary(sanctuary) {
    await this.pool.execute(
      `INSERT INTO wg_sanctuaries (sync_code, keeper_name, sanctuary_name, prestige, payload, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         keeper_name = VALUES(keeper_name),
         sanctuary_name = VALUES(sanctuary_name),
         prestige = VALUES(prestige),
         payload = VALUES(payload),
         updated_at = VALUES(updated_at)`,
      [
        sanctuary.syncCode,
        sanctuary.keeperName,
        sanctuary.sanctuaryName,
        sanctuary.prestige || 0,
        JSON.stringify(sanctuary),
        sanctuary.updatedAt || Date.now(),
      ],
    );
  }

  async upsertListing(listing) {
    await this.pool.execute(
      `INSERT INTO wg_marketplace (id, seller_code, payload, created_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE payload = VALUES(payload), created_at = VALUES(created_at)`,
      [listing.id, listing.sellerCode, JSON.stringify(listing), listing.createdAt || Date.now()],
    );
  }

  async deleteListing(listingId) {
    await this.pool.execute('DELETE FROM wg_marketplace WHERE id = ?', [listingId]);
  }

  async insertChat(message) {
    await this.pool.execute(
      `INSERT IGNORE INTO wg_chat (id, sender_code, payload, timestamp)
       VALUES (?, ?, ?, ?)`,
      [message.id, message.senderCode, JSON.stringify(message), message.timestamp || Date.now()],
    );
  }

  async deleteSanctuary(syncCode) {
    await this.pool.execute('DELETE FROM wg_sanctuaries WHERE sync_code = ?', [syncCode]);
  }

  async deleteListingsBySeller(sellerCode) {
    await this.pool.execute('DELETE FROM wg_marketplace WHERE seller_code = ?', [sellerCode]);
  }

  async deleteChat(chatId) {
    await this.pool.execute('DELETE FROM wg_chat WHERE id = ?', [chatId]);
  }

  async clearSanctuaries() {
    await this.pool.execute('DELETE FROM wg_sanctuaries');
  }

  async clearMarketplace() {
    await this.pool.execute('DELETE FROM wg_marketplace');
  }

  async clearChat() {
    await this.pool.execute('DELETE FROM wg_chat');
  }

  async getAdminConfig(configKey = 'auth') {
    const [rows] = await this.pool.execute(
      'SELECT payload FROM wg_admin_config WHERE config_key = ? LIMIT 1',
      [configKey],
    );
    if (!rows.length) return null;
    try {
      return JSON.parse(rows[0].payload);
    } catch {
      return null;
    }
  }

  async saveAdminConfig(configKey, value) {
    await this.pool.execute(
      `INSERT INTO wg_admin_config (config_key, payload, updated_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = VALUES(updated_at)`,
      [configKey, JSON.stringify(value), Date.now()],
    );
  }

  async close() {
    await this.pool.end();
  }
}
