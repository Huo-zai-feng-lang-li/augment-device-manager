const { SmartDeviceReset } = require('./smart-device-reset');

/**
 * 设备ID重置 - 用户界面组件
 * 集成到客户端的一键重置功能
 */

class DeviceResetUI {
  constructor() {
    this.resetManager = new SmartDeviceReset();
    this.isResetting = false;
  }

  /**
   * 渲染重置按钮和状态
   */
  renderResetSection() {
    return `
      <div class="device-reset-section">
        <h3>🆔 设备ID管理</h3>
        
        <div class="reset-options">
          <button 
            id="smart-reset-btn" 
            class="btn-primary"
            ${this.isResetting ? 'disabled' : ''}
          >
            ${this.isResetting ? '🔄 重置中...' : '🚀 一键重置设备ID'}
          </button>
          
          <div class="reset-info">
            <p>💡 智能重置会自动选择最佳清理策略</p>
            <p>⏱️ 通常只需要30秒，无需重装Cursor</p>
          </div>
        </div>

        <div id="reset-progress" class="progress-section" style="display: none;">
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
          <div class="progress-text">正在检测最佳重置方案...</div>
        </div>

        <div id="reset-results" class="results-section" style="display: none;">
          <!-- 结果会动态插入这里 -->
        </div>
      </div>
    `;
  }

  /**
   * 绑定事件处理器
   */
  bindEvents() {
    document.getElementById('smart-reset-btn').addEventListener('click', () => {
      this.startSmartReset();
    });
  }

  /**
   * 开始智能重置
   */
  async startSmartReset() {
    if (this.isResetting) return;

    this.isResetting = true;
    this.showProgress();
    
    try {
      const results = await this.resetManager.resetDeviceId();
      this.showResults(results);
    } catch (error) {
      this.showError(error);
    } finally {
      this.isResetting = false;
      this.hideProgress();
    }
  }

  /**
   * 显示进度
   */
  showProgress() {
    document.getElementById('reset-progress').style.display = 'block';
    document.getElementById('reset-results').style.display = 'none';
    
    // 模拟进度更新
    this.updateProgress('🔍 检测Cursor状态...', 20);
    
    setTimeout(() => {
      this.updateProgress('🧹 清理配置文件...', 50);
    }, 2000);
    
    setTimeout(() => {
      this.updateProgress('🆔 生成新设备ID...', 80);
    }, 4000);
  }

  /**
   * 更新进度
   */
  updateProgress(text, percent) {
    const progressFill = document.querySelector('.progress-fill');
    const progressText = document.querySelector('.progress-text');
    
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressText) progressText.textContent = text;
  }

  /**
   * 隐藏进度
   */
  hideProgress() {
    document.getElementById('reset-progress').style.display = 'none';
    document.getElementById('smart-reset-btn').disabled = false;
    document.getElementById('smart-reset-btn').textContent = '🚀 一键重置设备ID';
  }

  /**
   * 显示结果
   */
  showResults(results) {
    const resultsDiv = document.getElementById('reset-results');
    resultsDiv.style.display = 'block';
    
    let html = '';
    
    if (results.success) {
      html = `
        <div class="success-result">
          <h4>✅ 重置成功！</h4>
          <p><strong>使用方案：</strong>第${results.level}级${this.getLevelName(results.level)}</p>
          ${results.newDeviceId ? `<p><strong>新设备ID：</strong><code>${results.newDeviceId}</code></p>` : ''}
          
          <div class="actions-list">
            <h5>📋 执行的操作：</h5>
            <ul>
              ${results.actions.map(action => `<li>${action}</li>`).join('')}
            </ul>
          </div>
          
          <div class="next-steps">
            <h5>🎯 下一步：</h5>
            <ol>
              <li>重启Cursor IDE</li>
              <li>检查Augment扩展是否识别为新用户</li>
              <li>如果仍有问题，请联系技术支持</li>
            </ol>
          </div>
        </div>
      `;
    } else if (results.level === 3) {
      html = `
        <div class="warning-result">
          <h4>⚠️ 需要重装Cursor</h4>
          <p>前两级清理未能完全解决问题，建议重装以确保100%成功</p>
          
          <div class="reinstall-options">
            <button class="btn-warning" onclick="this.openReinstallGuide()">
              📖 查看重装指南
            </button>
            <button class="btn-secondary" onclick="this.downloadReinstallScript()">
              📜 下载自动重装脚本
            </button>
          </div>
        </div>
      `;
    } else {
      html = `
        <div class="error-result">
          <h4>❌ 重置失败</h4>
          <p>遇到了一些问题，请查看错误信息：</p>
          
          <div class="error-list">
            <ul>
              ${results.errors.map(error => `<li>${error}</li>`).join('')}
            </ul>
          </div>
          
          <button class="btn-secondary" onclick="this.contactSupport()">
            📞 联系技术支持
          </button>
        </div>
      `;
    }
    
    resultsDiv.innerHTML = html;
  }

  /**
   * 显示错误
   */
  showError(error) {
    const resultsDiv = document.getElementById('reset-results');
    resultsDiv.style.display = 'block';
    resultsDiv.innerHTML = `
      <div class="error-result">
        <h4>❌ 重置过程出错</h4>
        <p>${error.message}</p>
        <button class="btn-secondary" onclick="this.contactSupport()">
          📞 联系技术支持
        </button>
      </div>
    `;
  }

  /**
   * 获取级别名称
   */
  getLevelName(level) {
    const names = {
      1: '温和清理',
      2: '深度清理',
      3: '重装建议'
    };
    return names[level] || '未知';
  }

  /**
   * 打开重装指南
   */
  openReinstallGuide() {
    // 打开重装指南页面
    window.open('https://docs.cursor.com/reinstall-guide', '_blank');
  }

  /**
   * 下载重装脚本
   */
  downloadReinstallScript() {
    // 触发下载重装脚本
    const link = document.createElement('a');
    link.href = './cursor-reinstall.bat';
    link.download = 'cursor-reinstall.bat';
    link.click();
  }

  /**
   * 联系技术支持
   */
  contactSupport() {
    // 打开技术支持页面
    window.open('mailto:support@example.com?subject=设备ID重置问题', '_blank');
  }
}

// CSS样式
const resetStyles = `
<style>
.device-reset-section {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
}

.reset-options {
  margin: 15px 0;
}

.btn-primary {
  background: #007bff;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  transition: background 0.3s;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-primary:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.reset-info {
  margin-top: 10px;
  font-size: 14px;
  color: #6c757d;
}

.progress-section {
  margin: 20px 0;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #007bff;
  transition: width 0.3s ease;
}

.progress-text {
  margin-top: 8px;
  font-size: 14px;
  color: #495057;
}

.success-result {
  background: #d4edda;
  border: 1px solid #c3e6cb;
  border-radius: 6px;
  padding: 15px;
}

.warning-result {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 6px;
  padding: 15px;
}

.error-result {
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 6px;
  padding: 15px;
}

.actions-list, .next-steps {
  margin-top: 15px;
}

.actions-list ul, .next-steps ol {
  margin: 8px 0;
  padding-left: 20px;
}

.reinstall-options {
  margin-top: 15px;
}

.btn-warning {
  background: #ffc107;
  color: #212529;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 10px;
}

.btn-secondary {
  background: #6c757d;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}
</style>
`;

module.exports = { DeviceResetUI, resetStyles };
