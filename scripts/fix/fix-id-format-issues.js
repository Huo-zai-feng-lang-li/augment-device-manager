/**
 * 修复ID格式问题工具
 * 检测并修复所有IDE中格式错误的设备ID
 */

const fs = require("fs-extra");
const path = require("path");
const os = require("os");

// 导入统一的ID生成工具
const IDGenerator = require("../../shared/utils/id-generator");

class IDFormatFixer {
  constructor() {
    this.platform = os.platform();
    this.results = {
      actions: [],
      errors: [],
      fixed: 0,
      checked: 0,
    };
  }

  /**
   * 获取所有IDE的storage.json路径
   */
  getAllIDEStoragePaths() {
    const paths = [];
    const userHome = os.homedir();

    if (this.platform === "win32") {
      // Windows路径
      const appDataPath = path.join(userHome, "AppData", "Roaming");

      // Cursor变体
      paths.push({
        ide: "cursor",
        name: "Cursor",
        path: path.join(
          appDataPath,
          "Cursor",
          "User",
          "globalStorage",
          "storage.json"
        ),
      });

      // VS Code变体
      const vscodeVariants = [
        { name: "VS Code", folder: "Code" },
        { name: "VS Code Insiders", folder: "Code - Insiders" },
        { name: "VSCodium", folder: "VSCodium" },
      ];

      vscodeVariants.forEach((variant) => {
        paths.push({
          ide: "vscode",
          name: variant.name,
          path: path.join(
            appDataPath,
            variant.folder,
            "User",
            "globalStorage",
            "storage.json"
          ),
        });
      });
    } else if (this.platform === "darwin") {
      // macOS路径
      const libraryPath = path.join(userHome, "Library", "Application Support");

      // Cursor
      paths.push({
        ide: "cursor",
        name: "Cursor",
        path: path.join(
          libraryPath,
          "Cursor",
          "User",
          "globalStorage",
          "storage.json"
        ),
      });

      // VS Code变体
      const vscodeVariants = [
        { name: "VS Code", folder: "Code" },
        { name: "VS Code Insiders", folder: "Code - Insiders" },
        { name: "VSCodium", folder: "VSCodium" },
      ];

      vscodeVariants.forEach((variant) => {
        paths.push({
          ide: "vscode",
          name: variant.name,
          path: path.join(
            libraryPath,
            variant.folder,
            "User",
            "globalStorage",
            "storage.json"
          ),
        });
      });
    } else {
      // Linux路径
      const configPath = path.join(userHome, ".config");

      // Cursor
      paths.push({
        ide: "cursor",
        name: "Cursor",
        path: path.join(
          configPath,
          "Cursor",
          "User",
          "globalStorage",
          "storage.json"
        ),
      });

      // VS Code变体
      const vscodeVariants = [
        { name: "VS Code", folder: "Code" },
        { name: "VS Code Insiders", folder: "Code - Insiders" },
        { name: "VSCodium", folder: "VSCodium" },
      ];

      vscodeVariants.forEach((variant) => {
        paths.push({
          ide: "vscode",
          name: variant.name,
          path: path.join(
            configPath,
            variant.folder,
            "User",
            "globalStorage",
            "storage.json"
          ),
        });
      });
    }

    return paths;
  }

  /**
   * 检查并修复单个storage.json文件
   */
  async fixStorageFile(ideInfo) {
    this.results.checked++;

    if (!(await fs.pathExists(ideInfo.path))) {
      this.results.actions.push(`⏭️ ${ideInfo.name} - 文件不存在，跳过`);
      return;
    }

    try {
      const storageData = await fs.readJson(ideInfo.path);
      let needsFix = false;
      const fixes = [];

      // 生成正确格式的新身份
      const newIdentity = IDGenerator.generateCompleteDeviceIdentity(
        ideInfo.ide
      );

      // 检查并修复各个ID字段
      const fieldsToCheck = [
        "telemetry.devDeviceId",
        "telemetry.machineId",
        "telemetry.macMachineId",
        "telemetry.sessionId",
        "storage.serviceMachineId",
      ];

      // 如果是Cursor，还要检查sqmId
      if (ideInfo.ide === "cursor") {
        fieldsToCheck.push("telemetry.sqmId");
      }

      // 检查VSCode中是否错误地包含了sqmId（应该移除）
      if (ideInfo.ide === "vscode" && storageData["telemetry.sqmId"]) {
        needsFix = true;
        delete storageData["telemetry.sqmId"];
        fixes.push("telemetry.sqmId: 移除了不应存在的字段（VSCode专用）");
      }

      for (const field of fieldsToCheck) {
        if (storageData[field]) {
          const currentValue = storageData[field];
          let isValid = false;
          let errorMsg = "";

          // 根据字段类型验证格式
          if (
            field === "telemetry.devDeviceId" ||
            field === "telemetry.sessionId"
          ) {
            const validation = IDGenerator.validateDeviceId(currentValue);
            isValid = validation.valid;
            errorMsg = validation.error;
          } else if (
            field === "telemetry.machineId" ||
            field === "telemetry.macMachineId" ||
            field === "storage.serviceMachineId"
          ) {
            const validation = IDGenerator.validateMachineId(currentValue);
            isValid = validation.valid;
            errorMsg = validation.error;
          } else if (field === "telemetry.sqmId") {
            const validation = IDGenerator.validateSqmId(currentValue);
            isValid = validation.valid;
            errorMsg = validation.error;
          }

          if (!isValid) {
            needsFix = true;
            storageData[field] = newIdentity[field];
            fixes.push(`${field}: ${errorMsg}`);
          }
        }
      }

      if (needsFix) {
        // 备份原文件
        const backupPath = `${ideInfo.path}.backup.${Date.now()}`;
        await fs.copy(ideInfo.path, backupPath);

        // 写入修复后的数据
        await fs.writeJson(ideInfo.path, storageData, { spaces: 2 });

        this.results.fixed++;
        this.results.actions.push(
          `✅ ${ideInfo.name} - 已修复 ${fixes.length} 个ID格式错误`
        );
        fixes.forEach((fix) => {
          this.results.actions.push(`   - ${fix}`);
        });
        this.results.actions.push(`   - 备份文件: ${backupPath}`);
      } else {
        this.results.actions.push(`✅ ${ideInfo.name} - ID格式正确，无需修复`);
      }
    } catch (error) {
      this.results.errors.push(
        `❌ ${ideInfo.name} - 修复失败: ${error.message}`
      );
    }
  }

  /**
   * 执行全面的ID格式修复
   */
  async fixAllIDFormats() {
    console.log("🔧 开始检查和修复所有IDE的ID格式问题...\n");

    const allPaths = this.getAllIDEStoragePaths();

    for (const ideInfo of allPaths) {
      await this.fixStorageFile(ideInfo);
    }

    // 输出结果
    console.log("\n📊 修复结果统计:");
    console.log(`   - 检查文件数: ${this.results.checked}`);
    console.log(`   - 修复文件数: ${this.results.fixed}`);
    console.log(`   - 错误数量: ${this.results.errors.length}`);

    console.log("\n📋 详细操作记录:");
    this.results.actions.forEach((action) => console.log(action));

    if (this.results.errors.length > 0) {
      console.log("\n❌ 错误记录:");
      this.results.errors.forEach((error) => console.log(error));
    }

    console.log("\n✅ ID格式修复完成！");

    if (this.results.fixed > 0) {
      console.log("\n⚠️ 重要提示:");
      console.log("   - 已为修复的文件创建备份");
      console.log("   - 建议重启相关IDE以使更改生效");
      console.log("   - 如有问题可从备份文件恢复");
    }

    return this.results;
  }

  /**
   * 验证指定文件的ID格式
   */
  async validateStorageFile(filePath, ideType = "cursor") {
    if (!(await fs.pathExists(filePath))) {
      return { valid: false, error: "文件不存在" };
    }

    try {
      const storageData = await fs.readJson(filePath);
      const validation = IDGenerator.validateCompleteIdentity(
        storageData,
        ideType
      );
      return validation;
    } catch (error) {
      return { valid: false, error: `读取文件失败: ${error.message}` };
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const fixer = new IDFormatFixer();
  fixer.fixAllIDFormats().catch(console.error);
}

module.exports = IDFormatFixer;
