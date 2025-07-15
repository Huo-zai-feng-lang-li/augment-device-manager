/**
 * 生成1分钟过期的测试激活码
 */

const fetch = require("node-fetch");

async function generate1MinCode() {
  console.log("⚡ 生成1分钟激活码...\n");

  try {
    // 登录
    const loginResponse = await fetch("http://localhost:3002/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin123" }),
    });

    const loginData = await loginResponse.json();
    const token = loginData.token;

    // 生成1分钟激活码
    const expiryDays = 60 / (24 * 60 * 60); // 60秒转换为天数
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
          expiryDays: expiryDays,
          notes: "1分钟测试激活码",
        }),
      }
    );

    const createData = await createResponse.json();
    const code = createData.data.code;
    const expiresAt = createData.data.expiresAt;

    console.log("🎯 1分钟激活码已生成:");
    console.log("");
    console.log("   📝 激活码:", code);
    console.log("   ⏰ 过期时间:", new Date(expiresAt).toLocaleString("zh-CN"));
    console.log("   ⚡ 有效期: 1分钟");
    console.log("");

    // 验证激活码状态
    const verifyResponse = await fetch(
      "http://localhost:3002/api/verify-activation",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code, deviceId: "test-device" }),
      }
    );

    const verifyData = await verifyResponse.json();
    console.log("📊 当前状态:", verifyData.valid ? "✅ 有效" : "❌ 无效");

    if (verifyData.valid) {
      console.log("📋 使用说明:");
      console.log("1. 立即复制上面的激活码");
      console.log("2. 在客户端中使用此激活码激活");
      console.log("3. 激活后有1分钟时间测试清理功能");
      console.log('4. 1分钟后测试，应该会提示"激活码已过期"');
      console.log("");
      console.log("🛡️ 这个激活码使用在线时间验证，无法通过修改本地时间绕过！");

      // 🚨 安全修复：移除本地时间倒计时，改为简单的1分钟倒计时
      console.log("\n⏰ 1分钟倒计时开始...");
      console.log("💡 注意：实际过期验证基于服务端在线时间，此倒计时仅供参考");

      let remaining = 60; // 60秒倒计时
      const timer = setInterval(async () => {
        if (remaining > 0) {
          const minutes = Math.floor(remaining / 60);
          const seconds = remaining % 60;
          console.log(
            `   ⏳ 倒计时: ${minutes}分${seconds}秒 (服务端将基于在线时间验证)`
          );
          remaining--;
        } else {
          clearInterval(timer);
          console.log("\n🚨 1分钟倒计时结束！请通过服务端API验证激活码状态");

          // 验证过期状态
          try {
            const expiredVerifyResponse = await fetch(
              "http://localhost:3002/api/verify-activation",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: code, deviceId: "test-device" }),
              }
            );

            const expiredVerifyData = await expiredVerifyResponse.json();
            console.log(
              "📊 过期验证结果:",
              expiredVerifyData.valid ? "仍然有效" : "✅ 已正确过期"
            );
            console.log(
              "   原因:",
              expiredVerifyData.reason || expiredVerifyData.error || "未知"
            );

            if (!expiredVerifyData.valid) {
              console.log("\n✅ 1分钟过期验证成功！");
              console.log("🛡️ 在线时间验证机制工作正常");
            }
          } catch (error) {
            console.error("验证过期状态失败:", error.message);
          }
        }
      }, 5000); // 每5秒更新一次
    }
  } catch (error) {
    console.error("❌ 生成失败:", error.message);
  }
}

// 运行
generate1MinCode().catch(console.error);
