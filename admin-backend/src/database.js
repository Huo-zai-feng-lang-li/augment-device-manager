const Database = require("better-sqlite3");
const path = require("path");

// 数据库文件路径
const DB_PATH = path.join(__dirname, "../data/admin.db");

class Database {
  constructor() {
    this.db = null;
    this.init();
  }

  init() {
    // 确保数据目录存在
    const fs = require("fs");
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error("数据库连接失败:", err);
      } else {
        console.log("数据库连接成功");
        this.createTables();
      }
    });
  }

  createTables() {
    // 激活码表
    const createActivationCodesTable = `
            CREATE TABLE IF NOT EXISTS activation_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                device_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                used_at DATETIME,
                used_by_device TEXT,
                status TEXT DEFAULT 'active',
                notes TEXT
            )
        `;

    // 使用记录表
    const createUsageLogsTable = `
            CREATE TABLE IF NOT EXISTS usage_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                activation_code TEXT NOT NULL,
                device_id TEXT NOT NULL,
                action TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                details TEXT
            )
        `;

    // 管理员表
    const createAdminsTable = `
            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME
            )
        `;

    this.db.run(createActivationCodesTable);
    this.db.run(createUsageLogsTable);
    this.db.run(createAdminsTable);

    // 创建默认管理员账户
    this.createDefaultAdmin();
  }

  createDefaultAdmin() {
    const bcrypt = require("bcryptjs");
    const defaultPassword = bcrypt.hashSync("admin123", 10);

    const insertAdmin = `
            INSERT OR IGNORE INTO admins (username, password_hash) 
            VALUES (?, ?)
        `;

    this.db.run(insertAdmin, ["admin", defaultPassword], (err) => {
      if (err) {
        console.error("创建默认管理员失败:", err);
      } else {
        console.log("默认管理员账户已创建 (用户名: admin, 密码: admin123)");
      }
    });
  }

  // 激活码相关操作
  createActivationCode(code, deviceId, expiresAt, notes = "") {
    return new Promise((resolve, reject) => {
      const sql = `
                INSERT INTO activation_codes (code, device_id, expires_at, notes)
                VALUES (?, ?, ?, ?)
            `;

      this.db.run(sql, [code, deviceId, expiresAt, notes], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, code });
        }
      });
    });
  }

  getAllActivationCodes() {
    return new Promise((resolve, reject) => {
      const sql = `
                SELECT * FROM activation_codes 
                ORDER BY created_at DESC
            `;

      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  updateActivationCodeStatus(code, status, usedByDevice = null) {
    return new Promise((resolve, reject) => {
      const sql = `
                UPDATE activation_codes 
                SET status = ?, used_at = CURRENT_TIMESTAMP, used_by_device = ?
                WHERE code = ?
            `;

      this.db.run(sql, [status, usedByDevice, code], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  // 使用记录相关操作
  logUsage(activationCode, deviceId, action, details = "") {
    return new Promise((resolve, reject) => {
      const sql = `
                INSERT INTO usage_logs (activation_code, device_id, action, details)
                VALUES (?, ?, ?, ?)
            `;

      this.db.run(
        sql,
        [activationCode, deviceId, action, details],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID });
          }
        }
      );
    });
  }

  getUsageLogs(limit = 100) {
    return new Promise((resolve, reject) => {
      const sql = `
                SELECT * FROM usage_logs 
                ORDER BY timestamp DESC 
                LIMIT ?
            `;

      this.db.all(sql, [limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // 管理员相关操作
  getAdminByUsername(username) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM admins WHERE username = ?`;

      this.db.get(sql, [username], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = Database;
