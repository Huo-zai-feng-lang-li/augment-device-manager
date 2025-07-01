// storage.json保护功能的用户界面
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class StorageProtectionUI {
  constructor() {
    this.storageJsonPath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'globalStorage',
      'storage.json'
    );
  }

  /**
   * 渲染保护控制界面
   */
  renderProtectionSection() {
    return `
      <div class="storage-protection-section">
        <h3>🔒 Storage.json 保护</h3>
        
        <div class="protection-status" id="protection-status">
          <div class="status-indicator">
            <span id="status-icon">🔍</span>
            <span id="status-text">检查中...</span>
          </div>
        </div>

        <div class="protection-controls">
          <button 
            id="enable-protection-btn" 
            class="btn-primary"
            style="display: none;"
          >
            🔒 启用保护
          </button>
          
          <button 
            id="disable-protection-btn" 
            class="btn-secondary"
            style="display: none;"
          >
            🔓 禁用保护
          </button>
          
          <button 
            id="check-status-btn" 
            class="btn-outline"
          >
            🔍 检查状态
          </button>
        </div>

        <div class="protection-info">
          <p>💡 启用保护后，Cursor无法自动修改设备ID</p>
          <p>⚠️ 需要更新Cursor配置时，请先禁用保护</p>
        </div>

        <div id="protection-results" class="results-section" style="display: none;">
          <!-- 操作结果会显示在这里 -->
        </div>
      </div>
    `;
  }

  /**
   * 绑定事件处理器
   */
  bindEvents() {
    document.getElementById('enable-protection-btn').addEventListener('click', () => {
      this.enableProtection();
    });

    document.getElementById('disable-protection-btn').addEventListener('click', () => {
      this.disableProtection();
    });

    document.getElementById('check-status-btn').addEventListener('click', () => {
      this.checkProtectionStatus();
    });

    // 初始检查状态
    this.checkProtectionStatus();
  }

  /**
   * 检查保护状态
   */
  async checkProtectionStatus() {
    try {
      this.updateStatus('🔍', '检查中...', 'checking');

      // 检查文件是否存在
      if (!(await fs.pathExists(this.storageJsonPath))) {
        this.updateStatus('❌', 'storage.json文件不存在', 'error');
        this.hideAllButtons();
        return;
      }

      // 检查文件属性
      const { stdout } = await execAsync(`attrib "${this.storageJsonPath}"`);
      const isReadOnly = stdout.includes('R');

      if (isReadOnly) {
        this.updateStatus('🔒', '保护已启用（只读）', 'protected');
        this.showButton('disable-protection-btn');
        this.hideButton('enable-protection-btn');
      } else {
        this.updateStatus('🔓', '保护未启用（可修改）', 'unprotected');
        this.showButton('enable-protection-btn');
        this.hideButton('disable-protection-btn');
      }

      // 显示设备ID信息
      try {
        const content = await fs.readJson(this.storageJsonPath);
        const deviceId = content['telemetry.devDeviceId'];
        this.showResults([
          `📱 当前设备ID: ${deviceId || '未设置'}`,
          `📁 文件路径: ${this.storageJsonPath}`
        ]);
      } catch (error) {
        this.showResults(['⚠️ 无法读取设备ID信息']);
      }

    } catch (error) {
      this.updateStatus('❌', '检查失败', 'error');
      this.showResults([`❌ 错误: ${error.message}`]);
    }
  }

  /**
   * 启用保护
   */
  async enableProtection() {
    try {
      this.updateStatus('🔄', '启用保护中...', 'processing');
      this.hideResults();

      await execAsync(`attrib +R "${this.storageJsonPath}"`);
      
      // 验证设置
      const { stdout } = await execAsync(`attrib "${this.storageJsonPath}"`);
      if (stdout.includes('R')) {
        this.updateStatus('🔒', '保护已启用', 'protected');
        this.showButton('disable-protection-btn');
        this.hideButton('enable-protection-btn');
        this.showResults([
          '✅ storage.json已设置为只读',
          '🛡️ Cursor无法自动修改设备ID',
          '💡 如需更新配置，请先禁用保护'
        ]);
      } else {
        throw new Error('只读属性设置失败');
      }

    } catch (error) {
      this.updateStatus('❌', '启用失败', 'error');
      this.showResults([`❌ 启用保护失败: ${error.message}`]);
    }
  }

  /**
   * 禁用保护
   */
  async disableProtection() {
    try {
      this.updateStatus('🔄', '禁用保护中...', 'processing');
      this.hideResults();

      await execAsync(`attrib -R "${this.storageJsonPath}"`);
      
      // 验证设置
      const { stdout } = await execAsync(`attrib "${this.storageJsonPath}"`);
      if (!stdout.includes('R')) {
        this.updateStatus('🔓', '保护已禁用', 'unprotected');
        this.showButton('enable-protection-btn');
        this.hideButton('disable-protection-btn');
        this.showResults([
          '✅ storage.json已恢复可修改状态',
          '⚠️ Cursor现在可以修改设备ID',
          '💡 建议在清理完成后重新启用保护'
        ]);
      } else {
        throw new Error('只读属性移除失败');
      }

    } catch (error) {
      this.updateStatus('❌', '禁用失败', 'error');
      this.showResults([`❌ 禁用保护失败: ${error.message}`]);
    }
  }

  /**
   * 更新状态显示
   */
  updateStatus(icon, text, className) {
    const statusIcon = document.getElementById('status-icon');
    const statusText = document.getElementById('status-text');
    const statusContainer = document.getElementById('protection-status');

    if (statusIcon) statusIcon.textContent = icon;
    if (statusText) statusText.textContent = text;
    if (statusContainer) {
      statusContainer.className = `protection-status ${className}`;
    }
  }

  /**
   * 显示按钮
   */
  showButton(buttonId) {
    const button = document.getElementById(buttonId);
    if (button) button.style.display = 'inline-block';
  }

  /**
   * 隐藏按钮
   */
  hideButton(buttonId) {
    const button = document.getElementById(buttonId);
    if (button) button.style.display = 'none';
  }

  /**
   * 隐藏所有按钮
   */
  hideAllButtons() {
    this.hideButton('enable-protection-btn');
    this.hideButton('disable-protection-btn');
  }

  /**
   * 显示结果
   */
  showResults(messages) {
    const resultsDiv = document.getElementById('protection-results');
    if (resultsDiv) {
      resultsDiv.innerHTML = messages.map(msg => `<p>${msg}</p>`).join('');
      resultsDiv.style.display = 'block';
    }
  }

  /**
   * 隐藏结果
   */
  hideResults() {
    const resultsDiv = document.getElementById('protection-results');
    if (resultsDiv) {
      resultsDiv.style.display = 'none';
    }
  }
}

module.exports = { StorageProtectionUI };
