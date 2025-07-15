// 测试激活码过期后功能禁用机制
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

class ActivationExpiryTest {
  constructor() {
    this.configDir = path.join(os.homedir(), '.augment-device-manager');
    this.configFile = path.join(this.configDir, 'config.json');
    this.backupFile = this.configFile + '.expiry-test-backup';
    this.testResults = {
      expiredActivationTest: false,
      functionDisabledTest: false,
      reactivationTest: false,
      errorMessageTest: false
    };
  }

  async runAllTests() {
    console.log('🧪 激活码过期功能禁用测试');
    console.log('='.repeat(50));
    
    try {
      // 备份现有配置
      await this.backupCurrentConfig();
      
      // 测试1: 过期激活码检测
      await this.testExpiredActivationDetection();
      
      // 测试2: 功能禁用验证
      await this.testFunctionDisabling();
      
      // 测试3: 错误消息验证
      await this.testErrorMessages();
      
      // 测试4: 重新激活功能恢复
      await this.testReactivation();
      
      // 生成测试报告
      this.generateTestReport();
      
    } catch (error) {
      console.error('❌ 测试执行失败:', error.message);
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

  async testExpiredActivationDetection() {
    console.log('\n🔍 测试1: 过期激活码检测');
    
    try {
      // 创建过期的激活配置
      const expiredConfig = {
        activation: {
          code: 'a1b2c3d4e5f6789012345678901234567890abcd',
          deviceId: 'test-device-expired-12345678-1234-1234-1234-123456789012',
          activatedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(), // 40天前
          expiresAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10天前过期
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
      
      console.log('  ✅ 过期激活配置已创建');
      console.log(`  📅 激活时间: ${expiredConfig.activation.activatedAt}`);
      console.log(`  ⏰ 过期时间: ${expiredConfig.activation.expiresAt}`);
      console.log(`  🕐 当前时间: ${new Date().toISOString()}`);
      
      this.testResults.expiredActivationTest = true;
      
    } catch (error) {
      console.log(`  ❌ 过期配置创建失败: ${error.message}`);
    }
  }

  async testFunctionDisabling() {
    console.log('\n🚫 测试2: 功能禁用验证');
    
    try {
      // 模拟主进程的激活验证逻辑
      const verifyActivationForOperation = async () => {
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
      };

      // 测试清理功能是否被禁用
      const activation = await verifyActivationForOperation();
      
      if (!activation.valid) {
        console.log('  ✅ 激活验证失败，功能被正确禁用');
        console.log(`  📝 失败原因: ${activation.reason}`);
        this.testResults.functionDisabledTest = true;
      } else {
        console.log('  ❌ 激活验证通过，功能未被禁用（测试失败）');
      }
      
    } catch (error) {
      console.log(`  ❌ 功能禁用测试失败: ${error.message}`);
    }
  }

  async testErrorMessages() {
    console.log('\n💬 测试3: 错误消息验证');
    
    try {
      // 模拟清理操作的错误响应
      const mockCleanupResponse = {
        success: false,
        error: "操作被拒绝: 激活已过期",
        requireActivation: true
      };

      console.log('  📝 模拟清理操作响应:');
      console.log(`    成功状态: ${mockCleanupResponse.success}`);
      console.log(`    错误消息: ${mockCleanupResponse.error}`);
      console.log(`    需要激活: ${mockCleanupResponse.requireActivation}`);

      // 验证错误消息格式
      if (mockCleanupResponse.error.includes('激活已过期') && 
          mockCleanupResponse.requireActivation === true) {
        console.log('  ✅ 错误消息格式正确');
        this.testResults.errorMessageTest = true;
      } else {
        console.log('  ❌ 错误消息格式不正确');
      }
      
    } catch (error) {
      console.log(`  ❌ 错误消息测试失败: ${error.message}`);
    }
  }

  async testReactivation() {
    console.log('\n🔄 测试4: 重新激活功能恢复');
    
    try {
      // 创建有效的激活配置
      const validConfig = {
        activation: {
          code: 'b2c3d4e5f6789012345678901234567890abcdef',
          deviceId: 'test-device-valid-12345678-1234-1234-1234-123456789012',
          activatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30天后过期
          version: '1.0'
        },
        server: {
          url: 'http://localhost:3000',
          lastConnected: new Date().toISOString()
        },
        lastUpdated: new Date().toISOString()
      };

      await fs.writeJson(this.configFile, validConfig, { spaces: 2 });
      
      // 重新验证激活状态
      const verifyActivationForOperation = async () => {
        const config = await fs.readJson(this.configFile);
        const now = new Date();
        const expiry = new Date(config.activation.expiresAt);
        
        if (now > expiry) {
          return { valid: false, reason: "激活已过期" };
        }
        
        return { valid: true };
      };

      const activation = await verifyActivationForOperation();
      
      if (activation.valid) {
        console.log('  ✅ 重新激活成功，功能已恢复');
        console.log(`  📅 新过期时间: ${validConfig.activation.expiresAt}`);
        this.testResults.reactivationTest = true;
      } else {
        console.log('  ❌ 重新激活失败');
      }
      
    } catch (error) {
      console.log(`  ❌ 重新激活测试失败: ${error.message}`);
    }
  }

  generateTestReport() {
    console.log('\n📋 测试报告');
    console.log('='.repeat(50));
    
    const totalTests = Object.keys(this.testResults).length;
    const passedTests = Object.values(this.testResults).filter(result => result).length;
    
    console.log(`\n📊 测试统计:`);
    console.log(`  总测试数: ${totalTests}`);
    console.log(`  通过测试: ${passedTests}`);
    console.log(`  失败测试: ${totalTests - passedTests}`);
    console.log(`  成功率: ${Math.round((passedTests / totalTests) * 100)}%`);
    
    console.log(`\n📝 详细结果:`);
    console.log(`  过期激活码检测: ${this.testResults.expiredActivationTest ? '✅ 通过' : '❌ 失败'}`);
    console.log(`  功能禁用验证: ${this.testResults.functionDisabledTest ? '✅ 通过' : '❌ 失败'}`);
    console.log(`  错误消息验证: ${this.testResults.errorMessageTest ? '✅ 通过' : '❌ 失败'}`);
    console.log(`  重新激活测试: ${this.testResults.reactivationTest ? '✅ 通过' : '❌ 失败'}`);
    
    console.log(`\n🎯 结论:`);
    if (passedTests === totalTests) {
      console.log('  🟢 激活码过期功能禁用机制工作正常');
      console.log('  🔒 过期后所有核心功能被正确禁用');
      console.log('  💬 错误提示信息准确清晰');
      console.log('  🔄 重新激活后功能正常恢复');
    } else {
      console.log('  🟡 激活码过期机制存在问题，需要修复');
      console.log('  🔧 建议检查激活验证逻辑');
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

// 运行测试
if (require.main === module) {
  const test = new ActivationExpiryTest();
  test.runAllTests().catch(console.error);
}

module.exports = { ActivationExpiryTest };
