/**
 * 在现有DeviceManager中实现统一清理逻辑的示例
 */

class DeviceManager {
  constructor() {
    // 现有构造函数代码...

    // 新增：IDE配置映射
    this.ideConfigs = {
      cursor: {
        name: "Cursor",
        configPath: "Cursor",
        augmentExtensionId: "augment.vscode-augment",
        processNames: ["Cursor.exe", "cursor.exe"],
      },
      vscode: {
        name: "VS Code",
        configPath: "Code",
        augmentExtensionId: "augment.vscode-augment",
        processNames: ["Code.exe", "code.exe"],
      },
    };
  }

  /**
   * 统一的清理入口 - 替换现有的performCursorCleanup和performVSCodeCleanup
   */
  async performIDECleanup(ideType, results, options = {}) {
    const ideConfig = this.ideConfigs[ideType];
    if (!ideConfig) {
      results.errors.push(`不支持的IDE类型: ${ideType}`);
      return;
    }

    try {
      results.actions.push(`🔧 开始${ideConfig.name}清理流程...`);

      // 1. 检测已安装的IDE变体
      const installedVariants = await this.detectInstalledIDEVariants(ideType);

      if (installedVariants.length === 0) {
        results.actions.push(`ℹ️ 未检测到已安装的${ideConfig.name}，跳过清理`);
        return;
      }

      results.actions.push(
        `🔍 检测到 ${installedVariants.length} 个${ideConfig.name}变体`
      );

      // 2. 对每个变体执行清理
      for (const variant of installedVariants) {
        await this.cleanIDEVariant(ideType, variant, options, results);
      }

      results.actions.push(`✅ ${ideConfig.name}清理流程完成`);
    } catch (error) {
      results.errors.push(`${ideConfig.name}清理失败: ${error.message}`);
    }
  }

  /**
   * 清理单个IDE变体 - 统一的清理逻辑
   */
  async cleanIDEVariant(ideType, variant, options, results) {
    const ideConfig = this.ideConfigs[ideType];

    results.actions.push(`🔧 处理${ideConfig.name} ${variant.name}...`);

    // 1. 保护MCP配置（通用方法）
    const mcpConfigs = await this.protectMCPConfigUniversal(results);

    // 2. 根据清理模式执行不同策略
    if (options.completeReset) {
      await this.performCompleteIDEReset(ideType, variant, options, results);
    } else if (options.intelligentMode) {
      await this.performIntelligentIDECleanup(
        ideType,
        variant,
        options,
        results
      );
    } else {
      await this.performSelectiveIDECleanup(ideType, variant, options, results);
    }

    // 3. 恢复MCP配置（通用方法）
    await this.restoreMCPConfigUniversal(results, mcpConfigs);

    results.actions.push(`✅ ${ideConfig.name} ${variant.name} 清理完成`);
  }

  /**
   * 智能清理模式 - 通用实现
   */
  async performIntelligentIDECleanup(ideType, variant, options, results) {
    const ideConfig = this.ideConfigs[ideType];
    results.actions.push(`🧠 ${variant.name} - 智能清理设备身份`);

    // 1. 更新设备ID（通用方法）
    await this.updateIDEDeviceIdentity(ideType, variant, results);

    // 2. 清理Augment扩展身份数据（通用方法）
    await this.cleanAugmentIdentityFiles(
      results,
      variant.augmentStorage,
      variant.name
    );

    // 3. 清理数据库中的Augment会话数据（通用方法，已支持不同数据库路径）
    if (await fs.pathExists(variant.stateDb)) {
      await this.cleanAugmentSessionsFromDatabase(results, {
        dbPath: variant.stateDb,
        ideName: variant.name,
        skipCursorLogin: true, // 保留登录状态
        intelligentMode: true,
      });
    }

    results.actions.push(`✅ ${variant.name} - 智能清理完成，所有配置已保护`);
  }

  /**
   * 选择性清理模式 - 通用实现
   */
  async performSelectiveIDECleanup(ideType, variant, options, results) {
    const ideConfig = this.ideConfigs[ideType];
    results.actions.push(`🔧 ${variant.name} - 选择性清理`);

    // 1. 清理Augment扩展存储
    if (await fs.pathExists(variant.augmentStorage)) {
      await fs.remove(variant.augmentStorage);
      results.actions.push(`🗑️ 已清理${variant.name} Augment扩展存储`);
    }

    // 2. 清理数据库中的Augment数据（通用方法）
    if (await fs.pathExists(variant.stateDb)) {
      await this.cleanAugmentSessionsFromDatabase(results, {
        dbPath: variant.stateDb,
        ideName: variant.name,
        skipCursorLogin: options.preserveLogin || false,
      });
    }

    // 3. 更新设备ID（通用方法）
    await this.updateIDEDeviceIdentity(ideType, variant, results);

    results.actions.push(`✅ ${variant.name} - 选择性清理完成`);
  }

  /**
   * 完全重置模式 - 通用实现
   */
  async performCompleteIDEReset(ideType, variant, options, results) {
    const ideConfig = this.ideConfigs[ideType];
    results.actions.push(`💥 ${variant.name} - 完全重置`);

    // 1. 清理所有IDE数据
    const pathsToClean = [
      variant.globalStorage,
      variant.workspaceStorage,
      variant.extensions,
    ];

    for (const pathToClean of pathsToClean) {
      if (await fs.pathExists(pathToClean)) {
        await fs.remove(pathToClean);
        results.actions.push(
          `🗑️ 已清理${variant.name} ${path.basename(pathToClean)}`
        );
      }
    }

    // 2. 生成全新身份（通用方法）
    await this.generateFreshIDEIdentity(ideType, variant, results);

    results.actions.push(`🔄 ${variant.name} - 完全重置完成`);
  }

  /**
   * 通用的设备ID更新方法
   */
  async updateIDEDeviceIdentity(ideType, variant, results) {
    const storageJsonPath = variant.storageJson;

    if (await fs.pathExists(storageJsonPath)) {
      try {
        const storageData = await fs.readJson(storageJsonPath);

        // 直接生成新的随机UUID作为设备ID，避免稳定设备ID系统的缓存问题
        const crypto = require("crypto");
        const newDeviceId = crypto.randomUUID();
        const newMachineId = this.generateDeviceFingerprint();
        const newSessionId = this.generateUUID();

        // 更新设备标识
        storageData["telemetry.devDeviceId"] = newDeviceId;
        storageData["telemetry.machineId"] = newMachineId;
        storageData["telemetry.sessionId"] = newSessionId;
        storageData["telemetry.macMachineId"] = newMachineId;

        if (ideType === "cursor") {
          storageData["telemetry.sqmId"] = `{${newDeviceId.toUpperCase()}}`;
        }

        await fs.writeJson(storageJsonPath, storageData, { spaces: 2 });
        results.actions.push(
          `🔄 ${variant.name} - 设备ID已更新为稳定ID: ${newDeviceId.substring(
            0,
            16
          )}...`
        );

        console.log(`✅ ${variant.name} 新设备ID: ${newDeviceId}`);
      } catch (error) {
        results.errors.push(`${variant.name} 设备ID更新失败: ${error.message}`);
        console.error(`❌ ${variant.name} 设备ID更新失败:`, error);
      }
    }
  }

  /**
   * 检测已安装的IDE变体 - 通用方法
   */
  async detectInstalledIDEVariants(ideType) {
    const ideConfig = this.ideConfigs[ideType];
    const variants = [];

    // 根据IDE类型确定要检测的变体
    const variantNames =
      ideType === "cursor"
        ? ["Cursor"]
        : ["Code", "Code - Insiders", "VSCodium"];

    for (const variantName of variantNames) {
      const variantPath = this.getIDEVariantPath(ideType, variantName);
      if (await fs.pathExists(variantPath.globalStorage)) {
        variants.push({
          name: variantName,
          ...variantPath,
        });
      }
    }

    return variants;
  }

  /**
   * 获取IDE变体路径配置 - 通用方法
   */
  getIDEVariantPath(ideType, variantName) {
    const ideConfig = this.ideConfigs[ideType];
    const basePath = path.join(
      os.homedir(),
      "AppData",
      "Roaming",
      variantName,
      "User"
    );

    return {
      globalStorage: path.join(basePath, "globalStorage"),
      workspaceStorage: path.join(basePath, "workspaceStorage"),
      extensions: path.join(basePath, "extensions"),
      stateDb: path.join(basePath, "globalStorage", "state.vscdb"),
      storageJson: path.join(basePath, "globalStorage", "storage.json"),
      augmentStorage: path.join(
        basePath,
        "globalStorage",
        ideConfig.augmentExtensionId
      ),
    };
  }

  /**
   * 修改现有的performCleanup方法，使用统一的清理逻辑
   */
  async performCleanup(options = {}) {
    const results = { success: true, actions: [], errors: [] };

    try {
      // ... 现有的通用清理逻辑 ...

      // 使用统一的IDE清理逻辑替换原来的分别调用
      if (options.cleanCursor) {
        await this.performIDECleanup("cursor", results, {
          ...options,
          completeReset: options.resetCursorCompletely,
          intelligentMode: options.intelligentMode,
          preserveLogin: options.skipCursorLogin,
        });
      }

      if (options.cleanVSCode) {
        await this.performIDECleanup("vscode", results, {
          ...options,
          completeReset: options.resetVSCodeCompletely,
          intelligentMode: options.intelligentMode,
          preserveLogin: !options.resetVSCodeCompletely,
        });
      }

      // ... 其他清理逻辑 ...
    } catch (error) {
      results.success = false;
      results.errors.push(`清理失败: ${error.message}`);
    }

    return results;
  }
}

module.exports = DeviceManager;
