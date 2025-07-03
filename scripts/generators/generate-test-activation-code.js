/**
 * 生成30秒过期的测试激活码
 * 用于测试时间验证机制
 */

const fs = require("fs");
const path = require("path");
const {
  generateActivationCode,
} = require("../../shared/crypto/encryption-simple");

async function generateTestActivationCode() {
  console.log("🧪 生成30秒过期的测试激活码...\n");

  try {
    // 生成激活码（30秒过期）
    const expirySeconds = 30; // 30秒
    const expiryDays = expirySeconds / (24 * 60 * 60); // 转换为天数

    const code = generateActivationCode(null, expiryDays);

    // 🚨 安全修复：移除本地时间计算，仅显示激活码信息
    // 实际的过期时间应该由服务端基于在线时间计算
    console.log("✅ 激活码生成成功:");
    console.log("   激活码:", code);
    console.log("   有效期:", expirySeconds, "秒");
    console.log("   ⚠️  注意：实际过期时间由服务端基于在线时间计算");
    console.log("   💡 提示：请通过服务端API生成激活码以确保时间安全");

    // 读取服务端数据文件
    const dataFile = path.join(
      __dirname,
      "modules/admin-backend/data/store.json"
    );
    let memoryStore;

    try {
      if (fs.existsSync(dataFile)) {
        memoryStore = JSON.parse(fs.readFileSync(dataFile, "utf8"));
      } else {
        // 创建默认数据结构
        memoryStore = {
          activationCodes: [],
          usageLogs: [],
          admins: [],
        };
      }
    } catch (error) {
      console.log("创建新的数据存储...");
      memoryStore = {
        activationCodes: [],
        usageLogs: [],
        admins: [],
      };
    }

    // 添加激活码到数据存储
    const activationCode = {
      id: memoryStore.activationCodes.length + 1,
      code: code,
      device_id: null,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      used_at: null,
      used_by_device: null,
      status: "active",
      notes: "30秒过期测试激活码",
    };

    memoryStore.activationCodes.push(activationCode);

    // 确保数据目录存在
    const dataDir = path.dirname(dataFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // 保存到文件
    fs.writeFileSync(dataFile, JSON.stringify(memoryStore, null, 2));

    console.log("\n💾 激活码已保存到服务端数据库");
    console.log("📁 数据文件:", dataFile);

    console.log("\n🧪 测试说明:");
    console.log("1. 立即使用此激活码激活客户端");
    console.log("2. 等待30秒后测试清理或防护功能");
    console.log('3. 应该会提示"激活码已过期"');
    console.log("4. 修改本地时间无法绕过验证");

    console.log("\n⏰ 倒计时提醒:");
    let countdown = expirySeconds;
    const timer = setInterval(() => {
      console.log(`   剩余时间: ${countdown} 秒`);
      countdown--;

      if (countdown < 0) {
        clearInterval(timer);
        console.log("\n🚨 激活码已过期！现在可以测试过期验证机制");
      }
    }, 1000);
  } catch (error) {
    console.error("❌ 生成激活码失败:", error.message);
  }
}

// 运行生成器
generateTestActivationCode().catch(console.error);
