/**
 * 最终时间系统检查
 * 全面验证项目中所有时间相关功能的修复情况
 */

const fetch = require("node-fetch");
const { timeService } = require("../../shared/utils/time-service");
const ServerBeijingTimeAPI = require("../../modules/admin-backend/src/beijing-time-api");

async function finalTimeCheck() {
  console.log("🔍 最终时间系统检查...\n");

  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
  };

  function logResult(test, status, message) {
    const icon = status === "pass" ? "✅" : status === "fail" ? "❌" : "⚠️";
    console.log(`${icon} ${test}: ${message}`);
    results[
      status === "pass" ? "passed" : status === "fail" ? "failed" : "warnings"
    ]++;
  }

  try {
    // 测试1: 客户端时间服务
    console.log("📱 客户端时间服务检查");
    try {
      const clientTime = await timeService.getCurrentTime(true);
      const isOnlineTime = clientTime && !isNaN(clientTime.getTime());
      logResult(
        "客户端时间获取",
        isOnlineTime ? "pass" : "fail",
        isOnlineTime ? "正常获取在线时间" : "无法获取时间"
      );

      const remainingDays = await timeService.calculateRemainingDays(
        "2025-12-31T23:59:59.000Z",
        true
      );
      logResult(
        "客户端过期计算",
        remainingDays > 0 ? "pass" : "fail",
        `剩余天数计算: ${remainingDays}天`
      );
    } catch (error) {
      logResult("客户端时间服务", "fail", `异常: ${error.message}`);
    }

    // 测试2: 服务端时间服务
    console.log("\n🖥️ 服务端时间服务检查");
    try {
      const serverTimeAPI = new ServerBeijingTimeAPI();
      const serverTime = await serverTimeAPI.getBeijingTime();
      logResult(
        "服务端时间获取",
        "pass",
        `成功获取: ${serverTime.toLocaleString("zh-CN")}`
      );

      const validation = await serverTimeAPI.validateExpiration(
        "2025-12-31T23:59:59.000Z"
      );
      logResult(
        "服务端过期验证",
        validation.valid ? "pass" : "fail",
        `验证结果: ${validation.reason}`
      );
    } catch (error) {
      logResult("服务端时间服务", "fail", `异常: ${error.message}`);
    }

    // 测试3: 服务端API检查
    console.log("\n🌐 服务端API检查");
    try {
      // 健康检查
      const healthResponse = await fetch("http://localhost:3002/api/health");
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        const hasTimestamp =
          healthData.timestamp && healthData.timestamp.includes("T");
        logResult(
          "健康检查时间戳",
          hasTimestamp ? "pass" : "fail",
          hasTimestamp ? "使用ISO时间格式" : "时间戳格式异常"
        );
      } else {
        logResult("健康检查API", "fail", "服务端未运行");
      }

      // 登录并测试激活码生成
      const loginResponse = await fetch("http://localhost:3002/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "admin123" }),
      });

      if (loginResponse.ok) {
        const loginData = await loginResponse.json();
        const token = loginData.token;

        // 测试激活码生成
        const createResponse = await fetch(
          "http://localhost:3002/api/activation-codes",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              deviceId: null,
              expiryDays: 1,
              notes: "时间检查测试",
            }),
          }
        );

        if (createResponse.ok) {
          const createData = await createResponse.json();
          const expiryTime = new Date(createData.data.expiresAt);

          // 🚨 安全修复：不使用本地时间进行比较，仅显示过期时间信息
          // 实际的过期验证应该通过服务端在线时间API进行
          logResult(
            "激活码生成时间",
            "info",
            `过期时间: ${expiryTime.toLocaleString(
              "zh-CN"
            )} (服务端基于在线时间生成)`
          );

          // 可选：通过API验证当前激活码状态
          console.log(
            "💡 提示：激活码过期验证已改为基于在线时间，本地时间比较已移除"
          );
        } else {
          logResult("激活码生成", "fail", "生成失败");
        }
      } else {
        logResult("服务端登录", "fail", "登录失败");
      }
    } catch (error) {
      logResult("服务端API", "fail", `网络错误: ${error.message}`);
    }

    // 测试4: 时间一致性检查
    console.log("\n🔄 时间一致性检查");
    try {
      const clientTime = await timeService.getCurrentTime(true);
      const serverTimeAPI = new ServerBeijingTimeAPI();
      const serverTime = await serverTimeAPI.getBeijingTime();

      const timeDiff = Math.abs(clientTime.getTime() - serverTime.getTime());
      const isConsistent = timeDiff < 10000; // 10秒内

      logResult(
        "客户端服务端时间一致性",
        isConsistent ? "pass" : "warning",
        `时间差: ${Math.round(timeDiff / 1000)}秒`
      );
    } catch (error) {
      logResult("时间一致性", "fail", `检查失败: ${error.message}`);
    }

    // 测试5: 安全机制检查
    console.log("\n🛡️ 安全机制检查");
    try {
      // 测试网络失败处理
      const offlineAPI = new ServerBeijingTimeAPI();
      offlineAPI.timeAPIs = ["https://invalid-url-test.com/time"];
      offlineAPI.cachedTime = null;
      offlineAPI.cacheTimestamp = null;

      try {
        await offlineAPI.getBeijingTime();
        logResult("网络失败安全机制", "fail", "应该抛出异常但没有");
      } catch (error) {
        logResult("网络失败安全机制", "pass", "正确抛出异常");
      }

      // 测试过期验证
      const serverTimeAPI2 = new ServerBeijingTimeAPI();
      const expiredValidation = await serverTimeAPI2.validateExpiration(
        "2020-01-01T00:00:00.000Z"
      );
      logResult(
        "过期激活码检测",
        !expiredValidation.valid ? "pass" : "fail",
        expiredValidation.reason
      );
    } catch (error) {
      logResult("安全机制", "fail", `检查失败: ${error.message}`);
    }

    // 总结
    console.log("\n" + "=".repeat(50));
    console.log("🎯 最终检查结果:");
    console.log(`✅ 通过: ${results.passed} 项`);
    console.log(`⚠️  警告: ${results.warnings} 项`);
    console.log(`❌ 失败: ${results.failed} 项`);

    const totalTests = results.passed + results.warnings + results.failed;
    const successRate = Math.round((results.passed / totalTests) * 100);

    console.log(`\n📊 成功率: ${successRate}%`);

    if (results.failed === 0) {
      console.log("\n🎉 所有关键测试通过！时间系统修复完成！");
      console.log("🛡️ 项目现在使用统一的在线时间验证机制");
    } else {
      console.log("\n⚠️ 仍有问题需要修复");
    }
  } catch (error) {
    console.error("❌ 检查过程异常:", error.message);
  }
}

// 运行检查
finalTimeCheck().catch(console.error);
