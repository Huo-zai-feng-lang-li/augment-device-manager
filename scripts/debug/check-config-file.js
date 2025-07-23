/**
 * 检查配置文件内容
 */

const path = require('path');
const fs = require('fs-extra');
const os = require('os');

async function checkConfigFile() {
  console.log('🔍 检查配置文件内容');
  console.log('=' .repeat(40));
  
  const configPath = path.join(os.tmpdir(), 'augment-guardian-config.json');
  
  try {
    console.log(`配置文件路径: ${configPath}`);
    
    const exists = await fs.pathExists(configPath);
    console.log(`文件存在: ${exists ? '✅ 是' : '❌ 否'}`);
    
    if (exists) {
      const stats = await fs.stat(configPath);
      console.log(`文件大小: ${stats.size} 字节`);
      console.log(`修改时间: ${stats.mtime}`);
      
      const content = await fs.readFile(configPath, 'utf8');
      console.log('\n📄 文件内容:');
      console.log(content);
      
      try {
        const config = JSON.parse(content);
        console.log('\n📊 解析后的配置:');
        console.log(JSON.stringify(config, null, 2));
        
        console.log('\n🔍 配置字段检查:');
        console.log(`targetDeviceId: ${config.targetDeviceId || '❌ 未设置'}`);
        console.log(`selectedIDE: ${config.selectedIDE || '❌ 未设置'}`);
        console.log(`locked: ${config.locked || '❌ 未设置'}`);
        console.log(`timestamp: ${config.timestamp || '❌ 未设置'}`);
        
      } catch (parseError) {
        console.log(`❌ JSON解析失败: ${parseError.message}`);
      }
    }
    
  } catch (error) {
    console.error(`❌ 检查失败: ${error.message}`);
  }
}

checkConfigFile();
