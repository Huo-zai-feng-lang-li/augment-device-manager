const os = require('os');
const crypto = require('crypto');

console.log("🔍 你的电脑设备指纹信息");
console.log("=".repeat(50));

// 显示基础系统信息
console.log("\n📱 基础系统信息:");
console.log(`   操作系统: ${os.platform()}`);
console.log(`   架构: ${os.arch()}`);
console.log(`   主机名: ${os.hostname()}`);
console.log(`   用户名: ${os.userInfo().username}`);
console.log(`   总内存: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`);

// 显示CPU信息
console.log("\n💻 CPU信息:");
const cpus = os.cpus();
console.log(`   CPU型号: ${cpus[0].model}`);
console.log(`   CPU核心数: ${cpus.length}`);

// 生成设备指纹
console.log("\n🔐 设备指纹:");
const deviceInfo = {
  platform: os.platform(),
  arch: os.arch(),
  hostname: os.hostname(),
  cpus: os.cpus().map(cpu => cpu.model).join(""),
  totalmem: os.totalmem(),
  username: os.userInfo().username,
  homedir: os.homedir(),
};

const fingerprint = crypto
  .createHash('sha256')
  .update(JSON.stringify(deviceInfo))
  .digest('hex');

console.log(`   你的设备指纹: ${fingerprint}`);
console.log(`   指纹前16位: ${fingerprint.substring(0, 16)}`);

console.log("\n🧩 指纹组成要素:");
Object.entries(deviceInfo).forEach(([key, value]) => {
  if (typeof value === 'string' && value.length > 50) {
    console.log(`   ${key}: ${value.substring(0, 50)}...`);
  } else {
    console.log(`   ${key}: ${value}`);
  }
});

console.log("\n✅ 设备指纹获取完成！");
