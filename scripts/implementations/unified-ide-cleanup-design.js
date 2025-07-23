/**
 * 统一IDE清理逻辑设计方案
 * 
 * 目标：VSCode和Cursor共用一套清理逻辑，减少代码重复，提高维护性
 */

class UnifiedIDECleanup {
  constructor() {
    this.supportedIDEs = {
      cursor: {
        name: 'Cursor',
        configPath: 'Cursor/User/globalStorage',
        augmentExtensionId: 'augment.vscode-augment',
        stateDbName: 'state.vscdb',
        storageJsonName: 'storage.json',
        processNames: ['Cursor.exe', 'cursor.exe'],
        variants: ['Cursor']
      },
      vscode: {
        name: 'VS Code',
        configPath: 'Code/User/globalStorage', 
        augmentExtensionId: 'augment.vscode-augment',
        stateDbName: 'state.vscdb',
        storageJsonName: 'storage.json',
        processNames: ['Code.exe', 'code.exe'],
        variants: ['Code', 'Code - Insiders', 'VSCodium']
      }
    };
  }

  /**
   * 统一的IDE清理入口
   * @param {string} ideType - 'cursor' 或 'vscode'
   * @param {Object} options - 清理选项
   */
  async performIDECleanup(ideType, options = {}) {
    const ideConfig = this.supportedIDEs[ideType];
    if (!ideConfig) {
      throw new Error(`不支持的IDE类型: ${ideType}`);
    }

    const results = { actions: [], errors: [], success: true };

    try {
      results.actions.push(`🔧 开始${ideConfig.name}清理流程...`);

      // 1. 检测已安装的IDE变体
      const installedVariants = await this.detectInstalledIDEVariants(ideType);
      
      if (installedVariants.length === 0) {
        results.actions.push(`ℹ️ 未检测到已安装的${ideConfig.name}，跳过清理`);
        return results;
      }

      // 2. 对每个变体执行清理
      for (const variant of installedVariants) {
        await this.cleanIDEVariant(ideType, variant, options, results);
      }

      results.actions.push(`✅ ${ideConfig.name}清理流程完成`);
      
    } catch (error) {
      results.errors.push(`${ideConfig.name}清理失败: ${error.message}`);
      results.success = false;
    }

    return results;
  }

  /**
   * 清理单个IDE变体
   */
  async cleanIDEVariant(ideType, variant, options, results) {
    const ideConfig = this.supportedIDEs[ideType];
    
    results.actions.push(`🔧 处理${ideConfig.name} ${variant.name}...`);

    // 1. 关闭IDE进程
    await this.forceCloseIDE(ideType, results);

    // 2. 保护MCP配置
    const mcpConfigs = await this.protectMCPConfigUniversal(results);

    // 3. 根据清理模式执行不同的清理策略
    if (options.completeReset) {
      await this.performCompleteIDEReset(ideType, variant, options, results);
    } else if (options.intelligentMode) {
      await this.performIntelligentIDECleanup(ideType, variant, options, results);
    } else {
      await this.performSelectiveIDECleanup(ideType, variant, options, results);
    }

    // 4. 恢复MCP配置
    await this.restoreMCPConfigUniversal(results, mcpConfigs);

    // 5. 重启IDE（如果需要）
    if (options.autoRestart) {
      await this.startIDE(ideType, results);
    }
  }

  /**
   * 智能清理模式 - 只清理设备身份，保留所有配置
   */
  async performIntelligentIDECleanup(ideType, variant, options, results) {
    results.actions.push(`🧠 ${variant.name} - 智能清理设备身份`);

    // 1. 更新设备ID（通用方法）
    await this.updateIDEDeviceIdentity(ideType, variant, results);

    // 2. 清理Augment扩展身份数据（通用方法）
    await this.cleanAugmentIdentityData(ideType, variant, results, {
      preserveConfig: true,
      intelligentMode: true
    });

    // 3. 清理数据库中的Augment会话数据（通用方法）
    await this.cleanAugmentDatabaseData(ideType, variant, results, {
      preserveLogin: true,
      intelligentMode: true
    });

    results.actions.push(`✅ ${variant.name} - 智能清理完成，所有配置已保护`);
  }

  /**
   * 选择性清理模式 - 深度清理但保留核心配置
   */
  async performSelectiveIDECleanup(ideType, variant, options, results) {
    results.actions.push(`🔧 ${variant.name} - 选择性清理`);

    // 1. 清理Augment扩展存储
    await this.cleanAugmentExtensionStorage(ideType, variant, results);

    // 2. 清理数据库中的Augment数据
    await this.cleanAugmentDatabaseData(ideType, variant, results, {
      preserveLogin: options.preserveLogin || false
    });

    // 3. 更新设备ID
    await this.updateIDEDeviceIdentity(ideType, variant, results);

    results.actions.push(`✅ ${variant.name} - 选择性清理完成`);
  }

  /**
   * 完全重置模式 - 彻底重置IDE
   */
  async performCompleteIDEReset(ideType, variant, options, results) {
    results.actions.push(`💥 ${variant.name} - 完全重置`);

    // 1. 清理所有IDE数据
    const pathsToClean = [
      variant.globalStorage,
      variant.workspaceStorage,
      variant.extensions
    ];

    for (const pathToClean of pathsToClean) {
      if (await this.pathExists(pathToClean)) {
        await this.removePath(pathToClean);
        results.actions.push(`🗑️ 已清理${variant.name} ${path.basename(pathToClean)}`);
      }
    }

    // 2. 生成全新身份
    await this.generateFreshIDEIdentity(ideType, variant, results);

    results.actions.push(`🔄 ${variant.name} - 完全重置完成`);
  }

  /**
   * 通用的Augment身份数据清理
   */
  async cleanAugmentIdentityData(ideType, variant, results, options = {}) {
    const augmentStoragePath = variant.augmentStorage;
    
    if (await this.pathExists(augmentStoragePath)) {
      const files = await this.readdir(augmentStoragePath);
      const identityFiles = files.filter(file => 
        this.isIdentityFile(file) && !this.isConfigFile(file)
      );

      let cleanedCount = 0;
      for (const file of identityFiles) {
        const filePath = path.join(augmentStoragePath, file);
        await this.removePath(filePath);
        results.actions.push(`🗑️ ${variant.name} - 已清理身份文件: ${file}`);
        cleanedCount++;
      }

      if (cleanedCount > 0) {
        results.actions.push(`✅ ${variant.name} - Augment身份数据已清理`);
      } else {
        results.actions.push(`ℹ️ ${variant.name} - 未发现需要清理的身份文件`);
      }
    }
  }

  /**
   * 通用的数据库清理
   */
  async cleanAugmentDatabaseData(ideType, variant, results, options = {}) {
    if (!await this.pathExists(variant.stateDb)) {
      return;
    }

    // 使用统一的数据库清理逻辑
    await this.cleanAugmentSessionsFromDatabase(results, {
      dbPath: variant.stateDb,
      ideName: variant.name,
      preserveLogin: options.preserveLogin,
      intelligentMode: options.intelligentMode
    });
  }

  /**
   * 判断是否为身份文件
   */
  isIdentityFile(fileName) {
    const identityPatterns = ['user-', 'session-', 'auth-', 'device-', 'fingerprint'];
    return identityPatterns.some(pattern => fileName.includes(pattern));
  }

  /**
   * 判断是否为配置文件
   */
  isConfigFile(fileName) {
    const configPatterns = ['config', 'settings', 'mcp', 'server'];
    return configPatterns.some(pattern => fileName.includes(pattern));
  }

  /**
   * 检测已安装的IDE变体
   */
  async detectInstalledIDEVariants(ideType) {
    const ideConfig = this.supportedIDEs[ideType];
    const variants = [];

    for (const variantName of ideConfig.variants) {
      const variantPath = this.getIDEVariantPath(ideType, variantName);
      if (await this.pathExists(variantPath.globalStorage)) {
        variants.push({
          name: variantName,
          ...variantPath
        });
      }
    }

    return variants;
  }

  /**
   * 获取IDE变体路径配置
   */
  getIDEVariantPath(ideType, variantName) {
    const ideConfig = this.supportedIDEs[ideType];
    const basePath = path.join(os.homedir(), 'AppData', 'Roaming', variantName, 'User');
    
    return {
      globalStorage: path.join(basePath, 'globalStorage'),
      workspaceStorage: path.join(basePath, 'workspaceStorage'),
      extensions: path.join(basePath, 'extensions'),
      stateDb: path.join(basePath, 'globalStorage', ideConfig.stateDbName),
      storageJson: path.join(basePath, 'globalStorage', ideConfig.storageJsonName),
      augmentStorage: path.join(basePath, 'globalStorage', ideConfig.augmentExtensionId)
    };
  }
}

module.exports = UnifiedIDECleanup;
