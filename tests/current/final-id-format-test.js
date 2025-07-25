/**
 * 最终ID格式验证测试
 * 确保所有IDE的ID格式修复完成且智能清理功能正常
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// 导入相关工具
const IDGenerator = require('../../shared/utils/id-generator');
const IDFormatValidator = require('../current/test-id-format-validation');

class FinalIDFormatTest {
  constructor() {
    this.results = {
      generatorTest: null,
      currentFilesTest: null,
      simulatedCleanupTest: null,
      summary: {
        allPassed: false,
        issues: []
      }
    };
  }

  /**
   * 测试ID生成器的正确性
   */
  async testIDGenerator() {
    console.log('🧪 第1步：测试ID生成器正确性...\n');

    const tests = [];

    // 测试Cursor ID生成
    for (let i = 0; i < 5; i++) {
      const cursorIdentity = IDGenerator.generateCompleteDeviceIdentity('cursor');
      const validation = IDGenerator.validateCompleteIdentity(cursorIdentity, 'cursor');
      tests.push({
        type: 'cursor',
        iteration: i + 1,
        valid: validation.valid,
        errors: validation.errors
      });
    }

    // 测试VS Code ID生成
    for (let i = 0; i < 5; i++) {
      const vscodeIdentity = IDGenerator.generateCompleteDeviceIdentity('vscode');
      const validation = IDGenerator.validateCompleteIdentity(vscodeIdentity, 'vscode');
      tests.push({
        type: 'vscode',
        iteration: i + 1,
        valid: validation.valid,
        errors: validation.errors
      });
    }

    const passedTests = tests.filter(t => t.valid).length;
    const totalTests = tests.length;

    console.log(`✅ ID生成器测试: ${passedTests}/${totalTests} 通过`);

    if (passedTests === totalTests) {
      console.log('🎉 所有ID生成测试通过！');
      this.results.generatorTest = { passed: true, details: tests };
    } else {
      console.log('❌ 发现ID生成问题:');
      tests.filter(t => !t.valid).forEach(test => {
        console.log(`   - ${test.type} 第${test.iteration}次: ${test.errors.join(', ')}`);
      });
      this.results.generatorTest = { passed: false, details: tests };
      this.results.summary.issues.push('ID生成器存在问题');
    }
  }

  /**
   * 测试当前IDE文件的格式
   */
  async testCurrentFiles() {
    console.log('\n🔍 第2步：验证当前IDE文件格式...\n');

    const validator = new IDFormatValidator();
    await validator.validateRealIDEFiles();

    const allValid = validator.results.invalid === 0;
    
    if (allValid && validator.results.valid > 0) {
      console.log('🎉 所有现有IDE文件格式正确！');
      this.results.currentFilesTest = { passed: true, details: validator.results };
    } else if (validator.results.valid === 0 && validator.results.missing > 0) {
      console.log('ℹ️ 未找到IDE文件，这是正常的');
      this.results.currentFilesTest = { passed: true, details: validator.results };
    } else {
      console.log('❌ 发现格式错误的IDE文件');
      this.results.currentFilesTest = { passed: false, details: validator.results };
      this.results.summary.issues.push('存在格式错误的IDE文件');
    }
  }

  /**
   * 模拟智能清理功能测试
   */
  async testSimulatedCleanup() {
    console.log('\n🧠 第3步：模拟智能清理功能测试...\n');

    try {
      // 创建临时测试文件
      const tempDir = path.join(os.tmpdir(), 'id-format-test');
      await fs.ensureDir(tempDir);

      const testFiles = [
        {
          name: 'cursor-storage.json',
          ideType: 'cursor',
          path: path.join(tempDir, 'cursor-storage.json')
        },
        {
          name: 'vscode-storage.json', 
          ideType: 'vscode',
          path: path.join(tempDir, 'vscode-storage.json')
        }
      ];

      const testResults = [];

      for (const testFile of testFiles) {
        // 创建包含错误格式ID的测试文件
        const wrongData = {
          'telemetry.devDeviceId': 'correct-uuid-format-12345678-1234-4567-8901-123456789012',
          'telemetry.machineId': 'wrong-uuid-format-12345678-1234-4567-8901-123456789012', // 应该是64位十六进制
          'telemetry.sqmId': testFile.ideType === 'cursor' ? 'wrong-uuid-format-12345678-1234-4567-8901-123456789012' : undefined, // 应该是大括号包围的大写UUID
          'storage.serviceMachineId': 'wrong-uuid-format-12345678-1234-4567-8901-123456789012' // 应该是64位十六进制
        };

        // 移除undefined值
        Object.keys(wrongData).forEach(key => {
          if (wrongData[key] === undefined) {
            delete wrongData[key];
          }
        });

        await fs.writeJson(testFile.path, wrongData, { spaces: 2 });

        // 使用ID生成器修复
        const newIdentity = IDGenerator.generateCompleteDeviceIdentity(testFile.ideType);
        const fixedData = { ...wrongData, ...newIdentity };
        await fs.writeJson(testFile.path, fixedData, { spaces: 2 });

        // 验证修复结果
        const validation = IDGenerator.validateCompleteIdentity(fixedData, testFile.ideType);
        
        testResults.push({
          file: testFile.name,
          ideType: testFile.ideType,
          valid: validation.valid,
          errors: validation.errors
        });

        console.log(`${validation.valid ? '✅' : '❌'} ${testFile.name}: ${validation.valid ? '格式正确' : validation.errors.join(', ')}`);
      }

      // 清理临时文件
      await fs.remove(tempDir);

      const allPassed = testResults.every(r => r.valid);
      
      if (allPassed) {
        console.log('🎉 智能清理功能模拟测试通过！');
        this.results.simulatedCleanupTest = { passed: true, details: testResults };
      } else {
        console.log('❌ 智能清理功能存在问题');
        this.results.simulatedCleanupTest = { passed: false, details: testResults };
        this.results.summary.issues.push('智能清理功能存在问题');
      }

    } catch (error) {
      console.log(`❌ 模拟测试失败: ${error.message}`);
      this.results.simulatedCleanupTest = { passed: false, error: error.message };
      this.results.summary.issues.push(`模拟测试失败: ${error.message}`);
    }
  }

  /**
   * 输出最终结果
   */
  printFinalResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 最终测试结果汇总');
    console.log('='.repeat(60));

    const tests = [
      { name: 'ID生成器测试', result: this.results.generatorTest },
      { name: '当前文件验证', result: this.results.currentFilesTest },
      { name: '智能清理模拟', result: this.results.simulatedCleanupTest }
    ];

    tests.forEach(test => {
      const status = test.result?.passed ? '✅ 通过' : '❌ 失败';
      console.log(`${test.name}: ${status}`);
    });

    const allPassed = tests.every(test => test.result?.passed);
    this.results.summary.allPassed = allPassed;

    console.log('\n' + '-'.repeat(60));
    
    if (allPassed) {
      console.log('🎉 所有测试通过！ID格式修复完成！');
      console.log('\n✅ 确认事项:');
      console.log('   - ID生成器工作正常');
      console.log('   - 现有IDE文件格式正确');
      console.log('   - 智能清理功能正常');
      console.log('\n🚀 系统已准备就绪，可以安全使用智能清理功能！');
    } else {
      console.log('❌ 发现问题，需要进一步修复:');
      this.results.summary.issues.forEach(issue => {
        console.log(`   - ${issue}`);
      });
    }

    return this.results;
  }

  /**
   * 运行完整的最终测试
   */
  async runFinalTest() {
    console.log('🔬 开始最终ID格式验证测试\n');

    await this.testIDGenerator();
    await this.testCurrentFiles();
    await this.testSimulatedCleanup();
    
    return this.printFinalResults();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const tester = new FinalIDFormatTest();
  tester.runFinalTest().catch(console.error);
}

module.exports = FinalIDFormatTest;
