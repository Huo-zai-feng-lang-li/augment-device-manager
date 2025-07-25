/**
 * ID格式验证测试脚本
 * 测试所有IDE的ID格式是否正确
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// 导入ID生成和验证工具
const IDGenerator = require('../../shared/utils/id-generator');
const IDFormatFixer = require('../../scripts/fix/fix-id-format-issues');

class IDFormatValidator {
  constructor() {
    this.platform = os.platform();
    this.results = {
      total: 0,
      valid: 0,
      invalid: 0,
      missing: 0,
      details: []
    };
  }

  /**
   * 测试ID生成器本身
   */
  testIDGenerator() {
    console.log('🧪 测试ID生成器...\n');

    // 测试Cursor ID生成
    console.log('📱 测试Cursor ID生成:');
    const cursorIdentity = IDGenerator.generateCompleteDeviceIdentity('cursor');
    const cursorValidation = IDGenerator.validateCompleteIdentity(cursorIdentity, 'cursor');
    
    console.log(`   - 生成的ID数量: ${Object.keys(cursorIdentity).length}`);
    console.log(`   - 验证结果: ${cursorValidation.valid ? '✅ 通过' : '❌ 失败'}`);
    if (!cursorValidation.valid) {
      cursorValidation.errors.forEach(error => console.log(`     - ${error}`));
    }

    // 测试VS Code ID生成
    console.log('\n💻 测试VS Code ID生成:');
    const vscodeIdentity = IDGenerator.generateCompleteDeviceIdentity('vscode');
    const vscodeValidation = IDGenerator.validateCompleteIdentity(vscodeIdentity, 'vscode');
    
    console.log(`   - 生成的ID数量: ${Object.keys(vscodeIdentity).length}`);
    console.log(`   - 验证结果: ${vscodeValidation.valid ? '✅ 通过' : '❌ 失败'}`);
    if (!vscodeValidation.valid) {
      vscodeValidation.errors.forEach(error => console.log(`     - ${error}`));
    }

    // 显示生成的ID示例
    console.log('\n📋 生成的ID示例:');
    console.log('Cursor:');
    Object.entries(cursorIdentity).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
    
    console.log('\nVS Code:');
    Object.entries(vscodeIdentity).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
  }

  /**
   * 测试错误格式的ID
   */
  testInvalidFormats() {
    console.log('\n\n🚫 测试错误格式检测...\n');

    // 测试错误的machineId格式（UUID而不是64位十六进制）
    const wrongMachineId = 'cc176289-a9be-4a7b-9cae-186cda23c17d'; // 应该是64位十六进制
    const machineIdValidation = IDGenerator.validateMachineId(wrongMachineId);
    console.log(`❌ 错误的machineId格式: ${wrongMachineId}`);
    console.log(`   验证结果: ${machineIdValidation.valid ? '✅ 通过' : '❌ 失败'} - ${machineIdValidation.error || '格式正确'}`);

    // 测试错误的sqmId格式（UUID而不是大括号包围的大写UUID）
    const wrongSqmId = '3e82b6cc-98ca-43bf-a1ba-17e85b882886'; // 应该是{大写UUID}
    const sqmIdValidation = IDGenerator.validateSqmId(wrongSqmId);
    console.log(`\n❌ 错误的sqmId格式: ${wrongSqmId}`);
    console.log(`   验证结果: ${sqmIdValidation.valid ? '✅ 通过' : '❌ 失败'} - ${sqmIdValidation.error || '格式正确'}`);

    // 测试正确的格式
    console.log('\n✅ 正确格式示例:');
    const correctMachineId = IDGenerator.generateMachineId();
    const correctSqmId = IDGenerator.generateSqmId();
    console.log(`   正确的machineId: ${correctMachineId}`);
    console.log(`   正确的sqmId: ${correctSqmId}`);
  }

  /**
   * 验证实际IDE文件
   */
  async validateRealIDEFiles() {
    console.log('\n\n🔍 验证实际IDE文件...\n');

    const fixer = new IDFormatFixer();
    const allPaths = fixer.getAllIDEStoragePaths();

    for (const ideInfo of allPaths) {
      this.results.total++;
      
      if (!await fs.pathExists(ideInfo.path)) {
        this.results.missing++;
        this.results.details.push({
          ide: ideInfo.name,
          status: 'missing',
          message: '文件不存在'
        });
        console.log(`⏭️ ${ideInfo.name}: 文件不存在`);
        continue;
      }

      try {
        const storageData = await fs.readJson(ideInfo.path);
        const validation = IDGenerator.validateCompleteIdentity(storageData, ideInfo.ide);

        if (validation.valid) {
          this.results.valid++;
          this.results.details.push({
            ide: ideInfo.name,
            status: 'valid',
            message: 'ID格式正确'
          });
          console.log(`✅ ${ideInfo.name}: ID格式正确`);
        } else {
          this.results.invalid++;
          this.results.details.push({
            ide: ideInfo.name,
            status: 'invalid',
            message: validation.errors.join(', ')
          });
          console.log(`❌ ${ideInfo.name}: ID格式错误`);
          validation.errors.forEach(error => {
            console.log(`   - ${error}`);
          });
        }

      } catch (error) {
        this.results.invalid++;
        this.results.details.push({
          ide: ideInfo.name,
          status: 'error',
          message: `读取失败: ${error.message}`
        });
        console.log(`❌ ${ideInfo.name}: 读取失败 - ${error.message}`);
      }
    }
  }

  /**
   * 输出验证结果统计
   */
  printResults() {
    console.log('\n\n📊 验证结果统计:');
    console.log(`   - 总文件数: ${this.results.total}`);
    console.log(`   - 格式正确: ${this.results.valid}`);
    console.log(`   - 格式错误: ${this.results.invalid}`);
    console.log(`   - 文件缺失: ${this.results.missing}`);

    if (this.results.invalid > 0) {
      console.log('\n⚠️ 发现格式错误的文件:');
      this.results.details
        .filter(detail => detail.status === 'invalid' || detail.status === 'error')
        .forEach(detail => {
          console.log(`   - ${detail.ide}: ${detail.message}`);
        });
      
      console.log('\n💡 建议操作:');
      console.log('   运行修复脚本: node scripts/fix/fix-id-format-issues.js');
    } else if (this.results.valid > 0) {
      console.log('\n🎉 所有ID格式都正确！');
    }
  }

  /**
   * 运行完整的验证测试
   */
  async runFullValidation() {
    console.log('🔍 ID格式验证测试\n');
    console.log('=' * 50);

    // 1. 测试ID生成器
    this.testIDGenerator();

    // 2. 测试错误格式检测
    this.testInvalidFormats();

    // 3. 验证实际文件
    await this.validateRealIDEFiles();

    // 4. 输出结果
    this.printResults();

    return this.results;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const validator = new IDFormatValidator();
  validator.runFullValidation().catch(console.error);
}

module.exports = IDFormatValidator;
