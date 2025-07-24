console.log("开始测试...");

const https = require("https");

function simpleGet(url) {
  return new Promise((resolve, reject) => {
    console.log(`请求: ${url}`);
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`响应状态: ${res.statusCode}`);
        resolve({ status: res.statusCode, data });
      });
    }).on('error', (err) => {
      console.log(`请求错误: ${err.message}`);
      reject(err);
    });
  });
}

async function test() {
  try {
    console.log("测试 GitHub 配置获取...");
    const result = await simpleGet("https://raw.githubusercontent.com/Huo-zai-feng-lang-li/augment-device-manager/main/server-config.json");
    
    if (result.status === 200) {
      const config = JSON.parse(result.data);
      console.log(`✅ GitHub 配置获取成功: ${config.server.host}`);
      
      console.log("测试服务健康检查...");
      const healthResult = await simpleGet(`https://${config.server.host}/api/health`);
      
      if (healthResult.status === 200) {
        console.log("✅ 服务健康检查通过");
        console.log("🎉 所有测试通过!");
      } else {
        console.log(`❌ 服务健康检查失败: ${healthResult.status}`);
      }
    } else {
      console.log(`❌ GitHub 配置获取失败: ${result.status}`);
    }
  } catch (error) {
    console.log(`❌ 测试失败: ${error.message}`);
  }
}

test();
