const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");
const { promisify } = require("util");

/**
 * SQLite数据库分析器
 * 分析Cursor IDE的SQLite数据库，检查设备ID和用户身份信息
 */

class SQLiteAnalyzer {
  constructor() {
    this.execAsync = promisify(exec);
    this.paths = this.initializePaths();
  }

  /**
   * 初始化路径配置
   */
  initializePaths() {
    const userHome = os.homedir();
    return {
      // 主要数据库文件
      stateVscdb: path.join(userHome, "AppData", "Roaming", "Cursor", "User", "globalStorage", "state.vscdb"),
      
      // 工作区数据库文件
      workspaceStorageDir: path.join(userHome, "AppData", "Roaming", "Cursor", "User", "workspaceStorage"),
      
      // 其他可能的数据库位置
      localStateVscdb: path.join(userHome, "AppData", "Local", "Cursor", "User", "globalStorage", "state.vscdb"),
    };
  }

  /**
   * 分析所有SQLite数据库
   */
  async analyzeAllDatabases() {
    const results = {
      success: true,
      databases: [],
      deviceIdFound: false,
      userDataFound: false,
      actions: [],
      errors: []
    };

    try {
      // 分析主数据库
      if (await fs.pathExists(this.paths.stateVscdb)) {
        const mainDbResult = await this.analyzeDatabase(this.paths.stateVscdb, "主数据库");
        results.databases.push(mainDbResult);
        
        if (mainDbResult.deviceIdFound) results.deviceIdFound = true;
        if (mainDbResult.userDataFound) results.userDataFound = true;
      }

      // 分析工作区数据库
      if (await fs.pathExists(this.paths.workspaceStorageDir)) {
        const workspaceResults = await this.analyzeWorkspaceDatabases();
        results.databases.push(...workspaceResults);
        
        workspaceResults.forEach(result => {
          if (result.deviceIdFound) results.deviceIdFound = true;
          if (result.userDataFound) results.userDataFound = true;
        });
      }

      // 分析本地数据库
      if (await fs.pathExists(this.paths.localStateVscdb)) {
        const localDbResult = await this.analyzeDatabase(this.paths.localStateVscdb, "本地数据库");
        results.databases.push(localDbResult);
        
        if (localDbResult.deviceIdFound) results.deviceIdFound = true;
        if (localDbResult.userDataFound) results.userDataFound = true;
      }

      // 生成分析报告
      this.generateAnalysisReport(results);

    } catch (error) {
      results.success = false;
      results.errors.push(`数据库分析失败: ${error.message}`);
    }

    return results;
  }

  /**
   * 分析单个数据库
   */
  async analyzeDatabase(dbPath, dbName) {
    const result = {
      name: dbName,
      path: dbPath,
      exists: false,
      size: 0,
      tables: [],
      deviceIdFound: false,
      userDataFound: false,
      suspiciousData: [],
      errors: []
    };

    try {
      if (!(await fs.pathExists(dbPath))) {
        return result;
      }

      result.exists = true;
      const stats = await fs.stat(dbPath);
      result.size = stats.size;

      // 检查是否可以使用sqlite3命令
      try {
        await this.execAsync('sqlite3 --version');
      } catch (error) {
        result.errors.push("sqlite3命令不可用，使用文本分析");
        return await this.analyzeWithTextSearch(dbPath, result);
      }

      // 使用sqlite3分析数据库结构
      try {
        const tablesResult = await this.execAsync(`sqlite3 "${dbPath}" ".tables"`);
        result.tables = tablesResult.stdout.trim().split(/\s+/).filter(table => table);

        // 分析每个表
        for (const table of result.tables) {
          await this.analyzeTable(dbPath, table, result);
        }

      } catch (error) {
        result.errors.push(`SQLite分析失败: ${error.message}`);
        // 降级到文本分析
        return await this.analyzeWithTextSearch(dbPath, result);
      }

    } catch (error) {
      result.errors.push(`数据库分析失败: ${error.message}`);
    }

    return result;
  }

  /**
   * 分析数据库表
   */
  async analyzeTable(dbPath, tableName, result) {
    try {
      // 获取表结构
      const schemaResult = await this.execAsync(`sqlite3 "${dbPath}" ".schema ${tableName}"`);
      
      // 检查是否包含可疑字段
      const schema = schemaResult.stdout.toLowerCase();
      const suspiciousFields = ['deviceid', 'machineid', 'userid', 'sessionid', 'telemetry'];
      
      const foundFields = suspiciousFields.filter(field => schema.includes(field));
      
      if (foundFields.length > 0) {
        result.suspiciousData.push({
          table: tableName,
          type: 'schema',
          fields: foundFields,
          description: `表结构包含可疑字段: ${foundFields.join(', ')}`
        });
      }

      // 检查表数据（限制查询数量避免性能问题）
      try {
        const dataResult = await this.execAsync(`sqlite3 "${dbPath}" "SELECT * FROM ${tableName} LIMIT 5"`);
        const data = dataResult.stdout.toLowerCase();
        
        // 检查数据中是否包含设备ID模式
        const deviceIdPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
        const deviceIds = data.match(deviceIdPattern);
        
        if (deviceIds && deviceIds.length > 0) {
          result.deviceIdFound = true;
          result.suspiciousData.push({
            table: tableName,
            type: 'data',
            deviceIds: [...new Set(deviceIds)], // 去重
            description: `表数据包含设备ID: ${deviceIds.length} 个`
          });
        }

        // 检查用户相关数据
        const userPatterns = ['user', 'account', 'login', 'auth', 'session'];
        const foundUserData = userPatterns.filter(pattern => data.includes(pattern));
        
        if (foundUserData.length > 0) {
          result.userDataFound = true;
          result.suspiciousData.push({
            table: tableName,
            type: 'user_data',
            patterns: foundUserData,
            description: `表数据包含用户信息: ${foundUserData.join(', ')}`
          });
        }

      } catch (dataError) {
        // 数据查询失败不影响整体分析
      }

    } catch (error) {
      result.errors.push(`分析表 ${tableName} 失败: ${error.message}`);
    }
  }

  /**
   * 使用文本搜索分析数据库（降级方案）
   */
  async analyzeWithTextSearch(dbPath, result) {
    try {
      // 读取文件的前1MB进行文本分析
      const buffer = Buffer.alloc(1024 * 1024);
      const fd = await fs.open(dbPath, 'r');
      const { bytesRead } = await fs.read(fd, buffer, 0, buffer.length, 0);
      await fs.close(fd);

      const content = buffer.slice(0, bytesRead).toString('utf8', 0, bytesRead);
      
      // 搜索设备ID模式
      const deviceIdPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
      const deviceIds = content.match(deviceIdPattern);
      
      if (deviceIds && deviceIds.length > 0) {
        result.deviceIdFound = true;
        result.suspiciousData.push({
          type: 'text_search',
          deviceIds: [...new Set(deviceIds.map(id => id.toLowerCase()))],
          description: `文本搜索发现设备ID: ${deviceIds.length} 个`
        });
      }

      // 搜索关键词
      const keywords = ['telemetry', 'deviceid', 'machineid', 'userid', 'sessionid', 'augment'];
      const foundKeywords = keywords.filter(keyword => 
        content.toLowerCase().includes(keyword)
      );
      
      if (foundKeywords.length > 0) {
        result.userDataFound = true;
        result.suspiciousData.push({
          type: 'text_search',
          keywords: foundKeywords,
          description: `文本搜索发现关键词: ${foundKeywords.join(', ')}`
        });
      }

    } catch (error) {
      result.errors.push(`文本分析失败: ${error.message}`);
    }

    return result;
  }

  /**
   * 分析工作区数据库
   */
  async analyzeWorkspaceDatabases() {
    const results = [];

    try {
      const workspaces = await fs.readdir(this.paths.workspaceStorageDir);
      
      for (const workspace of workspaces) {
        const workspacePath = path.join(this.paths.workspaceStorageDir, workspace);
        const stateDbPath = path.join(workspacePath, 'state.vscdb');
        
        if (await fs.pathExists(stateDbPath)) {
          const result = await this.analyzeDatabase(stateDbPath, `工作区数据库 (${workspace.substring(0, 16)}...)`);
          results.push(result);
        }
      }

    } catch (error) {
      console.error(`分析工作区数据库失败: ${error.message}`);
    }

    return results;
  }

  /**
   * 生成分析报告
   */
  generateAnalysisReport(results) {
    results.actions.push("📊 SQLite数据库分析报告");
    results.actions.push("==================================================");
    
    results.actions.push(`🗄️ 分析数据库数量: ${results.databases.length}`);
    
    const existingDbs = results.databases.filter(db => db.exists);
    results.actions.push(`📁 存在的数据库: ${existingDbs.length}`);
    
    if (results.deviceIdFound) {
      results.actions.push("🚨 发现设备ID信息");
    } else {
      results.actions.push("✅ 未发现设备ID信息");
    }
    
    if (results.userDataFound) {
      results.actions.push("🚨 发现用户身份信息");
    } else {
      results.actions.push("✅ 未发现用户身份信息");
    }

    // 详细报告
    existingDbs.forEach(db => {
      results.actions.push(`\n📋 ${db.name}:`);
      results.actions.push(`  路径: ${db.path}`);
      results.actions.push(`  大小: ${(db.size / 1024).toFixed(2)} KB`);
      results.actions.push(`  表数量: ${db.tables.length}`);
      
      if (db.suspiciousData.length > 0) {
        results.actions.push(`  ⚠️ 可疑数据: ${db.suspiciousData.length} 项`);
        db.suspiciousData.forEach(item => {
          results.actions.push(`    • ${item.description}`);
        });
      } else {
        results.actions.push(`  ✅ 无可疑数据`);
      }
      
      if (db.errors.length > 0) {
        results.actions.push(`  ❌ 错误: ${db.errors.length} 项`);
      }
    });

    // 建议
    results.actions.push("\n💡 建议:");
    if (results.deviceIdFound || results.userDataFound) {
      results.actions.push("  • 建议在清理后监控这些数据库文件");
      results.actions.push("  • 考虑在守护进程中添加数据库内容验证");
      results.actions.push("  • 清理时应该删除或重置相关数据库");
    } else {
      results.actions.push("  • 数据库中未发现明显的设备身份信息");
      results.actions.push("  • 当前的清理策略应该足够");
    }
  }

  /**
   * 清理数据库中的设备ID信息
   */
  async cleanDatabaseDeviceIds(targetDeviceId) {
    const results = {
      success: true,
      actions: [],
      errors: []
    };

    try {
      // 这里可以添加具体的数据库清理逻辑
      // 由于SQLite操作的复杂性，暂时只记录需要清理的数据库
      
      const analysisResult = await this.analyzeAllDatabases();
      
      const dbsWithDeviceId = analysisResult.databases.filter(db => db.deviceIdFound);
      
      if (dbsWithDeviceId.length > 0) {
        results.actions.push(`🗄️ 发现 ${dbsWithDeviceId.length} 个数据库包含设备ID`);
        results.actions.push("⚠️ 建议手动检查和清理这些数据库");
        
        dbsWithDeviceId.forEach(db => {
          results.actions.push(`  • ${db.name}: ${db.path}`);
        });
      } else {
        results.actions.push("✅ 未发现包含设备ID的数据库");
      }

    } catch (error) {
      results.success = false;
      results.errors.push(`数据库清理失败: ${error.message}`);
    }

    return results;
  }
}

module.exports = { SQLiteAnalyzer };
