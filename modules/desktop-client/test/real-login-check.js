#!/usr/bin/env node

/**
 * 真实登录状态检查
 * 检查Cursor IDE的实际登录状态
 */

const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

async function checkRealLoginStatus() {
  console.log("🔍 检查Cursor IDE真实登录状态");
  console.log("=".repeat(50));

  try {
    // 1. 检查storage.json
    console.log("\n📁 第1步：检查storage.json...");
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
      const storageData = await fs.readJson(storageJsonPath);
      console.log("  storage.json存在");

      // 检查关键认证字段
      const authFields = [
        "cursorAuth/accessToken",
        "cursorAuth/refreshToken",
        "cursorAuth/cachedEmail",
        "cursorAuth/cachedSignUpType",
      ];

      let hasAuthData = false;
      authFields.forEach((field) => {
        if (storageData[field]) {
          console.log(`  ✅ 找到认证数据: ${field}`);
          hasAuthData = true;
        }
      });

      if (!hasAuthData) {
        console.log("  ❌ storage.json中无认证数据");
      }
    } else {
      console.log("  ❌ storage.json不存在");
    }

    // 2. 检查state.vscdb数据库
    console.log("\n🗄️ 第2步：检查state.vscdb数据库...");
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
      console.log("  state.vscdb存在");

      try {
        const db = Database(stateDbPath, { readonly: true });

        // 查询所有认证相关的记录
        const authQuery = `
          SELECT key, value 
          FROM ItemTable 
          WHERE key LIKE '%cursorAuth%' 
             OR key LIKE '%auth%'
             OR key LIKE '%token%'
             OR key LIKE '%user%'
             OR key LIKE '%email%'
        `;

        const authRecords = db.prepare(authQuery).all();
        console.log(`  找到 ${authRecords.length} 条认证相关记录:`);

        let hasValidAuth = false;
        authRecords.forEach((record) => {
          console.log(`    • ${record.key}`);

          // 检查是否包含有效的认证信息
          if (
            record.key.includes("accessToken") ||
            record.key.includes("refreshToken") ||
            record.key.includes("cachedEmail")
          ) {
            try {
              const value = JSON.parse(record.value);
              if (value && typeof value === "string" && value.length > 10) {
                hasValidAuth = true;
                console.log(`      ✅ 包含有效认证数据`);
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        });

        if (!hasValidAuth) {
          console.log("  ❌ 数据库中无有效认证数据");
        }

        db.close();
      } catch (error) {
        console.log(`  ❌ 数据库读取失败: ${error.message}`);
      }
    } else {
      console.log("  ❌ state.vscdb不存在");
    }

    // 3. 检查用户配置文件
    console.log("\n⚙️ 第3步：检查用户配置...");
    const userConfigPath = path.join(
      os.homedir(),
      "AppData",
      "Roaming",
      "Cursor",
      "User",
      "settings.json"
    );

    if (await fs.pathExists(userConfigPath)) {
      const userConfig = await fs.readJson(userConfigPath);
      console.log("  用户配置存在");

      // 检查可能的用户标识
      const userFields = ["user.email", "user.name", "cursor.user"];
      let hasUserInfo = false;

      userFields.forEach((field) => {
        if (userConfig[field]) {
          console.log(`  ✅ 找到用户信息: ${field} = ${userConfig[field]}`);
          hasUserInfo = true;
        }
      });

      if (!hasUserInfo) {
        console.log("  ❌ 配置中无用户信息");
      }
    } else {
      console.log("  ❌ 用户配置不存在");
    }

    // 4. 总结
    console.log("\n📊 登录状态总结:");
    console.log("  基于以上检查，如果Cursor IDE显示已退出登录，");
    console.log("  说明清理操作确实清除了关键的认证数据。");
    console.log("  测试脚本可能存在检测逻辑错误。");
  } catch (error) {
    console.error("❌ 检查过程出错:", error.message);
  }
}

// 运行检查
checkRealLoginStatus().catch(console.error);
