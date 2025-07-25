/**
 * 统一的ID生成工具类
 * 确保所有设备ID格式符合VS Code/Cursor标准
 */

const crypto = require("crypto");

class IDGenerator {
  /**
   * 生成设备ID (devDeviceId)
   * 格式: 标准UUID v4格式 (36字符)
   * 示例: cc176289-a9be-4a7b-9cae-186cda23c17d
   */
  static generateDeviceId() {
    return crypto.randomUUID();
  }

  /**
   * 生成机器ID (machineId)
   * 格式: 64位十六进制字符串 (64字符)
   * 示例: da509e8655c167eaea7f593f490fe5d888ef9ac425435f1d8ebb48c98069b832
   */
  static generateMachineId() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * 生成MAC机器ID (macMachineId)
   * 格式: 64位十六进制字符串 (64字符)
   * 示例: 0b2f3dcaf4efc7bbb71410f48a5e5397dbfa4b6e1afc5fda35606c9936a530ae
   */
  static generateMacMachineId() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * 生成会话ID (sessionId)
   * 格式: 标准UUID v4格式 (36字符)
   * 示例: f47ac10b-58cc-4372-a567-0e02b2c3d479
   */
  static generateSessionId() {
    return crypto.randomUUID();
  }

  /**
   * 生成软件质量指标ID (sqmId)
   * 格式: 大括号包围的大写UUID (38字符)
   * 示例: {12345678-1234-5678-9012-123456789012}
   */
  static generateSqmId() {
    return `{${crypto.randomUUID().toUpperCase()}}`;
  }

  /**
   * 生成服务机器ID (serviceMachineId)
   * 格式: 64位十六进制字符串 (64字符)
   */
  static generateServiceMachineId() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * 生成完整的设备身份数据集
   * @param {string} ideType - IDE类型 ('cursor' 或 'vscode')
   * @returns {Object} 完整的设备身份数据
   */
  static generateCompleteDeviceIdentity(ideType = 'cursor') {
    const identity = {
      'telemetry.devDeviceId': this.generateDeviceId(),
      'telemetry.machineId': this.generateMachineId(),
      'telemetry.macMachineId': this.generateMacMachineId(),
      'telemetry.sessionId': this.generateSessionId(),
      'storage.serviceMachineId': this.generateServiceMachineId()
    };

    // 只有Cursor需要sqmId
    if (ideType === 'cursor') {
      identity['telemetry.sqmId'] = this.generateSqmId();
    }

    return identity;
  }

  /**
   * 验证设备ID格式
   * @param {string} deviceId - 要验证的设备ID
   * @returns {Object} 验证结果
   */
  static validateDeviceId(deviceId) {
    if (!deviceId || typeof deviceId !== 'string') {
      return { valid: false, error: 'ID为空或非字符串' };
    }
    if (deviceId.length !== 36) {
      return { valid: false, error: `长度错误：${deviceId.length}，应为36` };
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(deviceId)) {
      return { valid: false, error: '格式错误：应为标准UUID v4格式' };
    }
    return { valid: true };
  }

  /**
   * 验证机器ID格式 (machineId/macMachineId)
   * @param {string} machineId - 要验证的机器ID
   * @returns {Object} 验证结果
   */
  static validateMachineId(machineId) {
    if (!machineId || typeof machineId !== 'string') {
      return { valid: false, error: 'ID为空或非字符串' };
    }
    if (machineId.length !== 64) {
      return { valid: false, error: `长度错误：${machineId.length}，应为64` };
    }
    if (!/^[0-9a-f]{64}$/.test(machineId)) {
      return { valid: false, error: '格式错误：应为64位十六进制字符串' };
    }
    return { valid: true };
  }

  /**
   * 验证sqmId格式
   * @param {string} sqmId - 要验证的sqmId
   * @returns {Object} 验证结果
   */
  static validateSqmId(sqmId) {
    if (!sqmId || typeof sqmId !== 'string') {
      return { valid: false, error: 'ID为空或非字符串' };
    }
    if (sqmId.length !== 38) {
      return { valid: false, error: `长度错误：${sqmId.length}，应为38` };
    }
    if (!/^\{[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\}$/.test(sqmId)) {
      return { valid: false, error: '格式错误：应为大括号包围的大写UUID' };
    }
    return { valid: true };
  }

  /**
   * 验证完整的设备身份数据
   * @param {Object} identity - 设备身份数据
   * @param {string} ideType - IDE类型
   * @returns {Object} 验证结果
   */
  static validateCompleteIdentity(identity, ideType = 'cursor') {
    const results = {
      valid: true,
      errors: []
    };

    // 验证devDeviceId
    if (identity['telemetry.devDeviceId']) {
      const deviceIdResult = this.validateDeviceId(identity['telemetry.devDeviceId']);
      if (!deviceIdResult.valid) {
        results.valid = false;
        results.errors.push(`devDeviceId: ${deviceIdResult.error}`);
      }
    }

    // 验证machineId
    if (identity['telemetry.machineId']) {
      const machineIdResult = this.validateMachineId(identity['telemetry.machineId']);
      if (!machineIdResult.valid) {
        results.valid = false;
        results.errors.push(`machineId: ${machineIdResult.error}`);
      }
    }

    // 验证macMachineId
    if (identity['telemetry.macMachineId']) {
      const macMachineIdResult = this.validateMachineId(identity['telemetry.macMachineId']);
      if (!macMachineIdResult.valid) {
        results.valid = false;
        results.errors.push(`macMachineId: ${macMachineIdResult.error}`);
      }
    }

    // 验证sessionId
    if (identity['telemetry.sessionId']) {
      const sessionIdResult = this.validateDeviceId(identity['telemetry.sessionId']);
      if (!sessionIdResult.valid) {
        results.valid = false;
        results.errors.push(`sessionId: ${sessionIdResult.error}`);
      }
    }

    // 验证sqmId (仅Cursor)
    if (ideType === 'cursor' && identity['telemetry.sqmId']) {
      const sqmIdResult = this.validateSqmId(identity['telemetry.sqmId']);
      if (!sqmIdResult.valid) {
        results.valid = false;
        results.errors.push(`sqmId: ${sqmIdResult.error}`);
      }
    }

    return results;
  }

  /**
   * 打印ID格式说明
   */
  static printFormatGuide() {
    console.log('📋 ID格式标准：');
    console.log('  devDeviceId: 标准UUID v4格式 (36字符)');
    console.log('  machineId: 64位十六进制字符串 (64字符)');
    console.log('  macMachineId: 64位十六进制字符串 (64字符)');
    console.log('  sessionId: 标准UUID v4格式 (36字符)');
    console.log('  sqmId: 大括号包围的大写UUID (38字符)');
    console.log('  serviceMachineId: 64位十六进制字符串 (64字符)');
  }
}

module.exports = IDGenerator;
