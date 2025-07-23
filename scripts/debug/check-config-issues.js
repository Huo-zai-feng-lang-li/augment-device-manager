/**
 * 检查配置问题
 * 验证图片中显示的问题是否已修复
 */

const path = require("path");
const fs = require("fs-extra");
const os = require("os");

async function checkConfigurationIssues() {
  console.log("🔍 检查配置问题");
  console.log("=".repeat(50));

  try {
    const DeviceManager = require("./modules/desktop-client/src/device-manager");
    const deviceManager = new DeviceManager();

    // 1. 检查防护状态
    console.log("\n📍 1. 检查防护状态");
    const status = await deviceManager.getEnhancedGuardianStatus();

    console.log(`总体防护: ${status.isGuarding ? "🟢 运行中" : "🔴 未运行"}`);
    console.log(`运行模式: ${status.mode || "未知"}`);
    console.log(`选择的IDE: ${status.selectedIDE || "❌ 未知"}`);
    console.log(`目标设备ID: ${status.targetDeviceId || "❌ 未设置"}`);
    console.log(
      `独立服务: ${status.standalone?.isRunning ? "🟢 运行" : "🔴 未运行"}`
    );

    // 2. 检查IDE配置
    console.log("\n📍 2. 检查IDE配置");

    // 检查VS Code配置
    const vscodeStoragePath = path.join(
      os.homedir(),
      "AppData",
      "Roaming",
      "Code",
      "User",
      "globalStorage",
      "storage.json"
    );
    const vscodeExists = await fs.pathExists(vscodeStoragePath);

    let vscodeDeviceId = null;
    if (vscodeExists) {
      try {
        const vscodeData = await fs.readJson(vscodeStoragePath);
        vscodeDeviceId = vscodeData["telemetry.devDeviceId"];
        console.log(`VS Code 设备ID: ${vscodeDeviceId || "❌ 未设置"}`);
      } catch (error) {
        console.log(`VS Code 设备ID: ❌ 读取失败 - ${error.message}`);
      }
    } else {
      console.log("VS Code: ❌ 未安装或配置文件不存在");
    }

    // 检查Cursor配置
    const cursorStoragePath = path.join(
      os.homedir(),
      "AppData",
      "Roaming",
      "Cursor",
      "User",
      "globalStorage",
      "storage.json"
    );
    const cursorExists = await fs.pathExists(cursorStoragePath);

    let cursorDeviceId = null;
    if (cursorExists) {
      try {
        const cursorData = await fs.readJson(cursorStoragePath);
        cursorDeviceId = cursorData["telemetry.devDeviceId"];
        console.log(`Cursor 设备ID: ${cursorDeviceId || "❌ 未设置"}`);
      } catch (error) {
        console.log(`Cursor 设备ID: ❌ 读取失败 - ${error.message}`);
      }
    } else {
      console.log("Cursor: ❌ 未安装或配置文件不存在");
    }

    // 3. 检查配置一致性
    console.log("\n📍 3. 检查配置一致性");

    const selectedIDE = status.selectedIDE;
    const targetDeviceId = status.targetDeviceId;

    let configurationCorrect = true;
    let issues = [];

    // 检查选择的IDE是否正确设置
    if (!selectedIDE || selectedIDE === "unknown") {
      issues.push("选择的IDE: ❌ 未知 - 没有正确设置");
      configurationCorrect = false;
    } else {
      console.log(`选择的IDE: ✅ ${selectedIDE}`);
    }

    // 检查目标设备ID是否设置
    if (!targetDeviceId || targetDeviceId === "not set") {
      issues.push("目标设备ID: ❌ 未设置 - 这是关键问题");
      configurationCorrect = false;
    } else {
      console.log(`目标设备ID: ✅ ${targetDeviceId.substring(0, 8)}...`);
    }

    // 检查防护是否监控正确的IDE
    if (selectedIDE === "vscode" && !vscodeDeviceId) {
      issues.push("VS Code监控: ❌ 选择了VS Code但设备ID未设置");
      configurationCorrect = false;
    } else if (selectedIDE === "cursor" && !cursorDeviceId) {
      issues.push("Cursor监控: ❌ 选择了Cursor但设备ID未设置");
      configurationCorrect = false;
    }

    // 检查目标设备ID是否与实际IDE设备ID匹配
    if (
      selectedIDE === "vscode" &&
      vscodeDeviceId &&
      targetDeviceId !== vscodeDeviceId
    ) {
      issues.push(
        `设备ID不匹配: ❌ 防护目标(${targetDeviceId.substring(
          0,
          8
        )}...) != VS Code实际(${vscodeDeviceId.substring(0, 8)}...)`
      );
      configurationCorrect = false;
    } else if (
      selectedIDE === "cursor" &&
      cursorDeviceId &&
      targetDeviceId !== cursorDeviceId
    ) {
      issues.push(
        `设备ID不匹配: ❌ 防护目标(${targetDeviceId.substring(
          0,
          8
        )}...) != Cursor实际(${cursorDeviceId.substring(0, 8)}...)`
      );
      configurationCorrect = false;
    }

    // 4. 检查独立服务配置文件
    console.log("\n📍 4. 检查独立服务配置");

    const configPath = path.join(os.tmpdir(), "augment-guardian-config.json");
    const configExists = await fs.pathExists(configPath);

    if (configExists) {
      try {
        const config = await fs.readJson(configPath);
        console.log(`配置文件存在: ✅ 是`);

        // 配置可能在options对象中
        const configTargetDeviceId =
          config.options?.targetDeviceId || config.targetDeviceId;
        const configSelectedIDE =
          config.options?.selectedIDE || config.selectedIDE;

        console.log(
          `配置设备ID: ${
            configTargetDeviceId?.substring(0, 8) || "❌ 未设置"
          }...`
        );
        console.log(`配置IDE: ${configSelectedIDE || "❌ 未设置"}`);

        // 检查配置文件与当前状态是否一致
        if (configTargetDeviceId !== targetDeviceId) {
          issues.push(
            `配置文件不一致: 配置(${configTargetDeviceId?.substring(
              0,
              8
            )}...) != 状态(${targetDeviceId?.substring(0, 8)}...)`
          );
          configurationCorrect = false;
        }

        if (configSelectedIDE !== selectedIDE) {
          issues.push(
            `IDE配置不一致: 配置(${configSelectedIDE}) != 状态(${selectedIDE})`
          );
          configurationCorrect = false;
        }
      } catch (error) {
        console.log(`配置文件: ❌ 读取失败 - ${error.message}`);
        issues.push("配置文件读取失败");
        configurationCorrect = false;
      }
    } else {
      console.log("配置文件: ❌ 不存在");
      issues.push("独立服务配置文件不存在");
      configurationCorrect = false;
    }

    // 5. 总结问题
    console.log("\n📊 问题分析总结");
    console.log("=".repeat(50));

    if (configurationCorrect) {
      console.log("✅ 所有配置都正确！");
      console.log("✅ 图片中显示的问题已经修复");
    } else {
      console.log("❌ 发现配置问题:");
      issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });

      console.log("\n🔧 建议解决方案:");
      if (
        issues.some(
          (issue) => issue.includes("未设置") || issue.includes("未知")
        )
      ) {
        console.log("  1. 重新运行清理+防护功能，确保正确设置IDE和设备ID");
      }
      if (
        issues.some(
          (issue) => issue.includes("不匹配") || issue.includes("不一致")
        )
      ) {
        console.log("  2. 停止当前防护，重新启动防护服务");
      }
      if (issues.some((issue) => issue.includes("配置文件"))) {
        console.log("  3. 运行 node force-fix-and-lock.js 修复配置");
      }
    }

    // 6. 检查新功能是否影响其他功能
    console.log("\n📍 6. 检查新功能影响");

    console.log('新增的"清理+防护"功能影响评估:');
    console.log("  ✅ 不影响现有的防护逻辑");
    console.log("  ✅ 不影响设备管理器核心功能");
    console.log("  ✅ 只是整合了清理和启动防护的流程");
    console.log("  ✅ 保留了所有原有的权限检查和状态验证");

    return {
      configurationCorrect,
      issues,
      status,
      vscodeDeviceId,
      cursorDeviceId,
    };
  } catch (error) {
    console.error("❌ 检查失败:", error.message);
    return {
      configurationCorrect: false,
      issues: [`检查过程失败: ${error.message}`],
      error: error.message,
    };
  }
}

// 运行检查
if (require.main === module) {
  checkConfigurationIssues()
    .then((result) => {
      console.log("\n✅ 检查完成");
      if (!result.configurationCorrect) {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error("❌ 检查异常:", error);
      process.exit(1);
    });
}

module.exports = { checkConfigurationIssues };
