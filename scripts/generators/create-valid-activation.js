/**
 * 生成有效的激活码并更新客户端配置
 */

const fetch = require('node-fetch');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

async function createValidActivation() {
  console.log('🔑 生成有效激活码并更新配置...\n');
  
  try {
    // 1. 获取管理员token
    console.log('1️⃣ 获取管理员token...');
    const loginResponse = await fetch('http://localhost:3002/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });
    
    const loginData = await loginResponse.json();
    if (!loginData.success) {
      throw new Error('管理员登录失败: ' + loginData.error);
    }
    
    console.log('✅ 管理员登录成功');
    const token = loginData.token;
    
    // 2. 生成新的激活码（30天有效期，确保足够长）
    console.log('\n2️⃣ 生成新激活码（30天有效期）...');
    const createResponse = await fetch('http://localhost:3002/api/activation-codes', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        deviceId: 'c85f8e929c3c14ab',
        expiryDays: 30,
        notes: '修复测试用激活码 - 30天有效期'
      })
    });
    
    const createData = await createResponse.json();
    if (!createData.success) {
      throw new Error('生成激活码失败: ' + createData.error);
    }
    
    console.log('✅ 新激活码生成成功:');
    console.log('   激活码:', createData.data.code);
    console.log('   过期时间:', new Date(createData.data.expiresAt).toLocaleString('zh-CN'));
    
    // 3. 激活新激活码
    console.log('\n3️⃣ 激活新激活码...');
    const activateResponse = await fetch('http://localhost:3002/api/validate-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: createData.data.code,
        deviceId: 'c85f8e929c3c14ab'
      })
    });
    
    const activateData = await activateResponse.json();
    if (!activateData.success) {
      throw new Error('激活失败: ' + activateData.error);
    }
    
    console.log('✅ 激活成功');
    
    // 4. 验证权限
    console.log('\n4️⃣ 验证权限...');
    const verifyResponse = await fetch('http://localhost:3002/api/verify-activation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: createData.data.code,
        deviceId: 'c85f8e929c3c14ab'
      })
    });
    
    const verifyData = await verifyResponse.json();
    console.log('权限验证结果:');
    console.log('   激活码有效:', verifyData.valid ? '是' : '否');
    console.log('   清理权限:', verifyData.permissions?.canCleanup ? '有' : '无');
    console.log('   更新权限:', verifyData.permissions?.canUpdate ? '有' : '无');
    console.log('   导出权限:', verifyData.permissions?.canExport ? '有' : '无');
    
    if (!verifyData.valid || !verifyData.permissions?.canCleanup) {
      throw new Error('激活码权限验证失败');
    }
    
    // 5. 更新客户端配置文件
    console.log('\n5️⃣ 更新客户端配置文件...');
    const configPath = path.join(os.homedir(), '.augment-device-manager');
    const configFile = path.join(configPath, 'config.json');
    
    // 创建新的激活配置
    const newActivation = {
      code: createData.data.code,
      deviceId: 'c85f8e929c3c14ab',
      activatedAt: activateData.expiresAt, // 使用服务端返回的时间
      expiresAt: activateData.expiresAt,   // 使用服务端返回的过期时间
      version: '1.0.0'
    };
    
    const config = {
      activation: newActivation,
      lastUpdated: activateData.expiresAt // 使用服务端时间
    };
    
    // 确保目录存在
    await fs.ensureDir(configPath);
    
    // 备份现有配置
    if (await fs.pathExists(configFile)) {
      const backupFile = configFile + '.fix-backup.' + Date.now();
      await fs.copy(configFile, backupFile);
      console.log('📁 已备份现有配置:', path.basename(backupFile));
    }
    
    // 写入新配置
    await fs.writeJson(configFile, config, { spaces: 2 });
    
    console.log('✅ 客户端配置已更新');
    console.log('   配置文件:', configFile);
    console.log('   激活码:', newActivation.code);
    console.log('   过期时间:', new Date(newActivation.expiresAt).toLocaleString('zh-CN'));
    
    // 6. 最终验证
    console.log('\n6️⃣ 最终验证...');
    const savedConfig = await fs.readJson(configFile);
    if (savedConfig.activation && savedConfig.activation.code === newActivation.code) {
      console.log('✅ 配置文件验证通过');
      
      console.log('\n🎉 修复完成！');
      console.log('💡 现在可以重启客户端，应该能正常显示激活状态了');
      console.log('🔧 关键修复：');
      console.log('   - 移除了客户端的本地时间过期检查');
      console.log('   - 使用服务端在线时间进行统一验证');
      console.log('   - 生成了30天有效期的新激活码');
    } else {
      console.log('❌ 配置文件验证失败');
    }
    
  } catch (error) {
    console.error('❌ 操作失败:', error.message);
  }
}

// 运行创建
createValidActivation().catch(console.error);
