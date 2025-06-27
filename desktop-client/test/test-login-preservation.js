#!/usr/bin/env node

/**
 * 测试登录状态保留功能
 * 验证修复后的清理功能是否能保留Cursor IDE登录状态
 */

const DeviceManager = require("../src/device-manager");

async function testLoginPreservation() {
  console.log("🔐 测试登录状态保留功能");
  console.log("=".repeat(50));
  console.log("🎯 验证清理后Cursor IDE登录状态是否保留");
  console.log("");

  try {
    // 1. 检查清理前状态
    console.log("📊 第1步：检查清理前状态...");
    const beforeDeviceId = await getCurrentDeviceId();
    const beforeLoginStatus = await getCursorLoginStatus();

    console.log(`  清理前devDeviceId: ${beforeDeviceId || "未找到"}`);
    console.log(
      `  清理前登录状态: ${beforeLoginStatus.isLoggedIn ? "已登录" : "未登录"}`
    );

    if (beforeLoginStatus.isLoggedIn) {
      console.log(`  登录邮箱: ${beforeLoginStatus.email || "未知"}`);
      console.log(`  会员类型: ${beforeLoginStatus.membershipType || "未知"}`);
    }

    // 2. 执行保留登录状态的清理
    console.log("\n🔧 第2步：执行保留登录状态的清理...");
    const deviceManager = new DeviceManager();

    const cleanupResult = await deviceManager.performCleanup({
      preserveActivation: true,
      deepClean: true,
      cleanCursorExtension: true,
      autoRestartCursor: true,
      skipCursorLogin: true, // 关键：保留Cursor IDE登录
      aggressiveMode: true,
      multiRoundClean: true,
      extendedMonitoring: true,
    });

    console.log(
      `  清理执行结果: ${cleanupResult.success ? "✅ 成功" : "❌ 失败"}`
    );

    // 显示关键操作
    const loginRelatedActions = cleanupResult.actions.filter(
      (action) =>
        action.includes("登录") ||
        action.includes("保留") ||
        action.includes("Cursor")
    );

    if (loginRelatedActions.length > 0) {
      console.log("\n🔑 登录相关操作:");
      loginRelatedActions.forEach((action) => {
        console.log(`    • ${action}`);
      });
    }

    // 3. 等待清理完成
    console.log("\n⏳ 第3步：等待清理完成...");
    await sleep(5000);

    // 4. 检查清理后状态
    console.log("\n📊 第4步：检查清理后状态...");
    const afterDeviceId = await getCurrentDeviceId();
    const afterLoginStatus = await getCursorLoginStatus();

    console.log(`  清理后devDeviceId: ${afterDeviceId || "未找到"}`);
    console.log(
      `  清理后登录状态: ${afterLoginStatus.isLoggedIn ? "已登录" : "未登录"}`
    );

    if (afterLoginStatus.isLoggedIn) {
      console.log(`  登录邮箱: ${afterLoginStatus.email || "未知"}`);
      console.log(`  会员类型: ${afterLoginStatus.membershipType || "未知"}`);
    }

    // 5. 分析结果
    console.log("\n📈 第5步：分析测试结果...");

    const results = {
      deviceIdChanged: afterDeviceId !== beforeDeviceId,
      loginPreserved:
        beforeLoginStatus.isLoggedIn && afterLoginStatus.isLoggedIn,
      emailPreserved: beforeLoginStatus.email === afterLoginStatus.email,
      membershipPreserved:
        beforeLoginStatus.membershipType === afterLoginStatus.membershipType,
      overallSuccess: false,
    };

    console.log("\n🎯 测试结果分析:");
    console.log(
      `  设备ID更新: ${results.deviceIdChanged ? "✅ 成功" : "❌ 失败"}`
    );
    console.log(
      `  登录状态保留: ${results.loginPreserved ? "✅ 成功" : "❌ 失败"}`
    );
    console.log(
      `  邮箱信息保留: ${results.emailPreserved ? "✅ 成功" : "❌ 失败"}`
    );
    console.log(
      `  会员信息保留: ${results.membershipPreserved ? "✅ 成功" : "❌ 失败"}`
    );

    // 计算成功率
    let successCount = 0;
    if (results.deviceIdChanged) successCount++;
    if (results.loginPreserved) successCount++;
    if (results.emailPreserved) successCount++;
    if (results.membershipPreserved) successCount++;

    const successRate = (successCount / 4) * 100;
    results.overallSuccess = successRate >= 75;

    console.log(`\n📊 登录保留测试成功率: ${successRate.toFixed(1)}%`);

    // 6. 最终评估
    console.log("\n🏆 最终评估:");
    if (successRate >= 90) {
      console.log("  🎉 优秀！登录状态保留功能完美");
      console.log("  ✅ 用户清理后无需重新登录Cursor IDE");
    } else if (successRate >= 75) {
      console.log("  ⭐ 良好！登录状态保留功能基本正常");
      console.log("  🔧 大部分登录信息得到保留");
    } else if (successRate >= 50) {
      console.log("  ⚠️ 一般！登录状态保留功能部分有效");
      console.log("  🛠️ 需要进一步优化保留逻辑");
    } else {
      console.log("  ❌ 需要改进！登录状态保留功能效果不佳");
      console.log("  🔧 需要检查skipCursorLogin实现");
    }

    return {
      success: cleanupResult.success,
      successRate,
      results,
      beforeDeviceId,
      afterDeviceId,
      loginPreserved: results.loginPreserved,
    };
  } catch (error) {
    console.error("❌ 登录保留测试失败:", error.message);
    return {
      success: false,
      successRate: 0,
      error: error.message,
    };
  }
}

// 获取当前设备ID
async function getCurrentDeviceId() {
  try {
    const fs = require("fs-extra");
    const path = require("path");
    const os = require("os");

    const storageJsonPath = path.join(
      os.homedir(),
      "AppData",
      "Roaming",
      "Cursor",
      "User",
      "globalStorage",
      "storage.json"
    );

    if (await fs.pathExists(storageJsonPath)) {
      const data = await fs.readJson(storageJsonPath);
      return data["telemetry.devDeviceId"];
    }
    return null;
  } catch (error) {
    return null;
  }
}

// 获取Cursor登录状态
async function getCursorLoginStatus() {
  try {
    const fs = require("fs-extra");
    const path = require("path");
    const os = require("os");

    const loginStatus = {
      isLoggedIn: false,
      email: null,
      membershipType: null,
      hasAccessToken: false,
      hasRefreshToken: false,
    };

    // 首先检查storage.json
    const storageJsonPath = path.join(
      os.homedir(),
      "AppData",
      "Roaming",
      "Cursor",
      "User",
      "globalStorage",
      "storage.json"
    );

    if (await fs.pathExists(storageJsonPath)) {
      const data = await fs.readJson(storageJsonPath);

      // 检查登录相关字段
      loginStatus.hasAccessToken = !!data["cursorAuth/accessToken"];
      loginStatus.hasRefreshToken = !!data["cursorAuth/refreshToken"];
      loginStatus.email = data["cursorAuth/cachedEmail"];
      loginStatus.membershipType = data["cursorAuth/stripeMembershipType"];
    }

    // 检查数据库中的认证数据（主要来源）
    const stateDbPath = path.join(
      os.homedir(),
      "AppData",
      "Roaming",
      "Cursor",
      "User",
      "globalStorage",
      "state.vscdb"
    );

    if (await fs.pathExists(stateDbPath)) {
      try {
        const initSqlJs = require("sql.js");
        const SQL = await initSqlJs();
        const dbBuffer = await fs.readFile(stateDbPath);
        const db = new SQL.Database(dbBuffer);

        // 查询认证相关数据
        const authQuery =
          "SELECT key, value FROM ItemTable WHERE key LIKE '%cursorAuth%'";
        const result = db.exec(authQuery);

        if (result.length > 0 && result[0].values.length > 0) {
          result[0].values.forEach((row) => {
            const key = row[0];
            const value = row[1];

            if (key === "cursorAuth/accessToken" && value) {
              loginStatus.hasAccessToken = true;
            } else if (key === "cursorAuth/refreshToken" && value) {
              loginStatus.hasRefreshToken = true;
            } else if (key === "cursorAuth/cachedEmail" && value) {
              loginStatus.email = value;
            } else if (key === "cursorAuth/stripeMembershipType" && value) {
              loginStatus.membershipType = value;
            }
          });
        }

        db.close();
      } catch (error) {
        // 如果数据库读取失败，继续使用storage.json的数据
      }
    }

    // 判断是否已登录
    loginStatus.isLoggedIn =
      loginStatus.hasAccessToken ||
      loginStatus.hasRefreshToken ||
      !!loginStatus.email;

    return loginStatus;
  } catch (error) {
    return {
      isLoggedIn: false,
      email: null,
      membershipType: null,
      hasAccessToken: false,
      hasRefreshToken: false,
    };
  }
}

// 睡眠函数
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 主执行函数
if (require.main === module) {
  testLoginPreservation()
    .then((result) => {
      console.log(
        `\n📋 登录保留测试完成: ${result.success ? "✅ 成功" : "❌ 失败"}`
      );
      console.log(`🎯 成功率: ${result.successRate.toFixed(1)}%`);
      console.log(
        `🔐 登录保留: ${result.loginPreserved ? "✅ 成功" : "❌ 失败"}`
      );

      if (result.success && result.successRate >= 75) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch(console.error);
}

module.exports = { testLoginPreservation };
