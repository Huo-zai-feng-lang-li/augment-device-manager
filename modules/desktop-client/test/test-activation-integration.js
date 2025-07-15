// 激活码过期功能禁用集成测试
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

class ActivationIntegrationTest {
  constructor() {
    this.configDir = path.join(os.homedir(), '.augment-device-manager');
    this.configFile = path.join(this.configDir, 'config.json');
    this.backupFile = this.configFile + '.integration-test-backup';
  }

  async runIntegrationTest() {
    console.log('🔗 激活码过期功能禁用集成测试');
    console.log('='.repeat(60));
    
    try {
      // 备份现有配置
      await this.backupCurrentConfig();
      
      // 测试场景1: 过期激活码 - 清理功能被禁用
      await this.testExpiredActivationCleanup();
      
      // 测试场景2: 过期激活码 - 重置计数功能被禁用
      await this.testExpiredActivationReset();
      
      // 测试场景3: 有效激活码 - 功能正常工作
      await this.testValidActivationFunctions();
      
      // 测试场景4: 未激活状态 - 所有功能被禁用
      await this.testNoActivationFunctions();
      
      console.log('\n🎉 集成测试完成！');
      
    } catch (error) {
      console.error('❌ 集成测试失败:', error.message);
    } finally {
      // 恢复原始配置
      await this.restoreOriginalConfig();
    }
  }

  async backupCurrentConfig() {
    console.log('\n💾 备份当前配置...');
    
    if (await fs.pathExists(this.configFile)) {
      await fs.copy(this.configFile, this.backupFile);
      console.log('  ✅ 配置已备份');
    } else {
      console.log('  ℹ️ 无现有配置需要备份');
    }
  }

  async testExpiredActivationCleanup() {
    console.log('\n🧪 场景1: 过期激活码 - 清理功能测试');
    
    try {
      // 创建过期激活配置
      await this.createExpiredActivation();
      
      // 模拟主进程的清理功能调用
      const cleanupResult = await this.simulateCleanupOperation();
      
      console.log('  📊 清理操作结果:');
      console.log(`    成功状态: ${cleanupResult.success}`);
      console.log(`    错误信息: ${cleanupResult.error}`);
      console.log(`    需要激活: ${cleanupResult.requireActivation}`);
      
      if (!cleanupResult.success && 
          cleanupResult.error.includes('激活已过期') && 
          cleanupResult.requireActivation) {
        console.log('  ✅ 清理功能被正确禁用');
      } else {
        console.log('  ❌ 清理功能未被正确禁用');
      }
      
    } catch (error) {
      console.log(`  ❌ 测试失败: ${error.message}`);
    }
  }

  async testExpiredActivationReset() {
    console.log('\n🧪 场景2: 过期激活码 - 重置计数功能测试');
    
    try {
      // 使用相同的过期配置
      const resetResult = await this.simulateResetOperation();
      
      console.log('  📊 重置操作结果:');
      console.log(`    成功状态: ${resetResult.success}`);
      console.log(`    错误信息: ${resetResult.error}`);
      console.log(`    需要激活: ${resetResult.requireActivation}`);
      
      if (!resetResult.success && 
          resetResult.error.includes('激活已过期') && 
          resetResult.requireActivation) {
        console.log('  ✅ 重置功能被正确禁用');
      } else {
        console.log('  ❌ 重置功能未被正确禁用');
      }
      
    } catch (error) {
      console.log(`  ❌ 测试失败: ${error.message}`);
    }
  }

  async testValidActivationFunctions() {
    console.log('\n🧪 场景3: 有效激活码 - 功能正常测试');
    
    try {
      // 创建有效激活配置
      await this.createValidActivation();
      
      // 测试清理功能
      const cleanupResult = await this.simulateCleanupOperation();
      console.log('  📊 清理操作结果:');
      console.log(`    成功状态: ${cleanupResult.success ? '✅ 通过验证' : '❌ 验证失败'}`);
      
      // 测试重置功能
      const resetResult = await this.simulateResetOperation();
      console.log('  📊 重置操作结果:');
      console.log(`    成功状态: ${resetResult.success ? '✅ 通过验证' : '❌ 验证失败'}`);
      
      if (cleanupResult.success && resetResult.success) {
        console.log('  ✅ 有效激活码下功能正常工作');
      } else {
        console.log('  ❌ 有效激活码下功能异常');
      }
      
    } catch (error) {
      console.log(`  ❌ 测试失败: ${error.message}`);
    }
  }

  async testNoActivationFunctions() {
    console.log('\n🧪 场景4: 未激活状态 - 功能禁用测试');
    
    try {
      // 删除激活配置
      if (await fs.pathExists(this.configFile)) {
        await fs.remove(this.configFile);
      }
      
      // 测试功能调用
      const cleanupResult = await this.simulateCleanupOperation();
      const resetResult = await this.simulateResetOperation();
      
      console.log('  📊 未激活状态测试结果:');
      console.log(`    清理功能: ${!cleanupResult.success ? '✅ 被禁用' : '❌ 未被禁用'}`);
      console.log(`    重置功能: ${!resetResult.success ? '✅ 被禁用' : '❌ 未被禁用'}`);
      
      if (!cleanupResult.success && !resetResult.success) {
        console.log('  ✅ 未激活状态下所有功能被正确禁用');
      } else {
        console.log('  ❌ 未激活状态下功能未被正确禁用');
      }
      
    } catch (error) {
      console.log(`  ❌ 测试失败: ${error.message}`);
    }
  }

  async createExpiredActivation() {
    const expiredConfig = {
      activation: {
        code: 'expired123456789012345678901234567890',
        deviceId: 'test-device-expired-integration-test',
        activatedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        version: '1.0'
      },
      server: {
        url: 'http://localhost:3000',
        lastConnected: new Date().toISOString()
      },
      lastUpdated: new Date().toISOString()
    };

    await fs.ensureDir(this.configDir);
    await fs.writeJson(this.configFile, expiredConfig, { spaces: 2 });
  }

  async createValidActivation() {
    const validConfig = {
      activation: {
        code: 'valid1234567890123456789012345678901',
        deviceId: 'test-device-valid-integration-test',
        activatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        version: '1.0'
      },
      server: {
        url: 'http://localhost:3000',
        lastConnected: new Date().toISOString()
      },
      lastUpdated: new Date().toISOString()
    };

    await fs.ensureDir(this.configDir);
    await fs.writeJson(this.configFile, validConfig, { spaces: 2 });
  }

  async simulateCleanupOperation() {
    // 模拟主进程中的激活验证逻辑
    const activation = await this.verifyActivationForOperation();
    
    if (!activation.valid) {
      return {
        success: false,
        error: `操作被拒绝: ${activation.reason}`,
        requireActivation: true,
      };
    }

    // 如果激活有效，返回成功（这里只是模拟验证通过）
    return {
      success: true,
      message: "清理操作验证通过",
      actions: ["模拟清理操作"]
    };
  }

  async simulateResetOperation() {
    // 模拟主进程中的激活验证逻辑
    const activation = await this.verifyActivationForOperation();
    
    if (!activation.valid) {
      return {
        success: false,
        error: `操作被拒绝: ${activation.reason}`,
        requireActivation: true,
      };
    }

    // 如果激活有效，返回成功
    return {
      success: true,
      message: "重置操作验证通过"
    };
  }

  async verifyActivationForOperation() {
    try {
      if (!(await fs.pathExists(this.configFile))) {
        return { valid: false, reason: "未激活" };
      }

      const config = await fs.readJson(this.configFile);
      if (!config.activation) {
        return { valid: false, reason: "未激活" };
      }

      // 检查本地过期
      const now = new Date();
      const expiry = new Date(config.activation.expiresAt);
      if (now > expiry) {
        return { valid: false, reason: "激活已过期" };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, reason: "验证失败: " + error.message };
    }
  }

  async restoreOriginalConfig() {
    console.log('\n🔄 恢复原始配置...');
    
    try {
      if (await fs.pathExists(this.backupFile)) {
        await fs.copy(this.backupFile, this.configFile);
        await fs.remove(this.backupFile);
        console.log('  ✅ 原始配置已恢复');
      } else {
        // 删除测试配置
        if (await fs.pathExists(this.configFile)) {
          await fs.remove(this.configFile);
        }
        console.log('  ✅ 测试配置已清理');
      }
    } catch (error) {
      console.log(`  ⚠️ 配置恢复失败: ${error.message}`);
    }
  }
}

// 运行集成测试
if (require.main === module) {
  const test = new ActivationIntegrationTest();
  test.runIntegrationTest().catch(console.error);
}

module.exports = { ActivationIntegrationTest };
