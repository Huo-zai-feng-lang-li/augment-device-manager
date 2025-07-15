const fs = require("fs-extra");
const path = require("path");
const os = require("os");

// 简单测试MCP配置保护
async function simpleMCPTest() {
  console.log("🧪 简单MCP配置保护测试");
  
  try {
    // 创建测试MCP配置
    const testMCPConfig = {
      mcpServers: {
        localtime: {
          command: "npx",
          args: ["@data_wise/localtime-mcp"]
        },
        context7: {
          command: "npx", 
          args: ["-y", "@upstash/context7-mcp@latest"]
        }
      }
    };

    const testFile = path.join(os.tmpdir(), "simple-mcp-test.json");
    
    // 1. 写入原始配置
    await fs.writeJson(testFile, testMCPConfig, { spaces: 2 });
    console.log("✅ 创建原始MCP配置");
    
    // 2. 读取并保护配置
    const originalConfig = await fs.readJson(testFile);
    const protectedMCP = originalConfig.mcpServers ? { mcpServers: originalConfig.mcpServers } : null;
    console.log("✅ 保护MCP配置:", protectedMCP ? Object.keys(protectedMCP.mcpServers).length + "个服务器" : "无");
    
    // 3. 模拟清理（覆盖文件）
    await fs.writeJson(testFile, { someOtherConfig: "test" }, { spaces: 2 });
    console.log("✅ 模拟清理操作");
    
    // 4. 恢复MCP配置
    if (protectedMCP && protectedMCP.mcpServers) {
      let currentConfig = await fs.readJson(testFile);
      if (!currentConfig.mcpServers) {
        currentConfig.mcpServers = {};
      }
      Object.assign(currentConfig.mcpServers, protectedMCP.mcpServers);
      await fs.writeJson(testFile, currentConfig, { spaces: 2 });
      console.log("✅ 恢复MCP配置");
    }
    
    // 5. 验证结果
    const finalConfig = await fs.readJson(testFile);
    console.log("📋 最终配置:", JSON.stringify(finalConfig, null, 2));
    
    if (finalConfig.mcpServers && Object.keys(finalConfig.mcpServers).length > 0) {
      console.log("🎉 MCP配置保护测试成功！");
      console.log(`📊 保留了 ${Object.keys(finalConfig.mcpServers).length} 个MCP服务器`);
    } else {
      console.log("❌ MCP配置保护测试失败");
    }
    
    // 清理测试文件
    await fs.remove(testFile);
    
  } catch (error) {
    console.error("❌ 测试失败:", error.message);
  }
}

simpleMCPTest();
