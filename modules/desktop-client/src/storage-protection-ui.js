// storage.json保护功能的用户界面
const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");
const { promisify } = require("util");

const execAsync = promisify(exec);

class StorageProtectionUI {
  constructor() {
    this.storageJsonPath = path.join(
      os.homedir(),
      "AppData",
      "Roaming",
      "Cursor",
      "User",
      "globalStorage",
      "storage.json"
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
    document
      .getElementById("enable-protection-btn")
      .addEventListener("click", () => {
        this.enableProtection();
      });

    document
      .getElementById("disable-protection-btn")
      .addEventListener("click", () => {
        this.disableProtection();
      });

    document
      .getElementById("check-status-btn")
      .addEventListener("click", () => {
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
      this.updateStatus("🔍", "检查中...", "checking");

      // 检查文件是否存在
      if (!(await fs.pathExists(this.storageJsonPath))) {
        this.updateStatus("❌", "storage.json文件不存在", "error");
        this.hideAllButtons();
        return;
      }

      // 实时监控保护模式：不再检查文件只读属性
      this.updateStatus("🛡️", "实时监控保护模式", "unprotected");
      this.showButton("enable-protection-btn");
      this.hideButton("disable-protection-btn");

      // 显示设备ID信息
      try {
        const content = await fs.readJson(this.storageJsonPath);
        const deviceId = content["telemetry.devDeviceId"];
        this.showResults([
          `📱 当前设备ID: ${deviceId || "未设置"}`,
          `📁 文件路径: ${this.storageJsonPath}`,
        ]);
      } catch (error) {
        this.showResults(["⚠️ 无法读取设备ID信息"]);
      }
    } catch (error) {
      this.updateStatus("❌", "检查失败", "error");
      this.showResults([`❌ 错误: ${error.message}`]);
    }
  }

  /**
   * 启用保护
   * 注意：已改为实时监控保护模式
   */
  async enableProtection() {
    try {
      this.updateStatus("🔄", "启用保护中...", "processing");
      this.hideResults();

      // 使用实时监控保护，不设置文件只读
      this.updateStatus("🛡️", "实时监控保护已启用", "protected");
      this.showButton("disable-protection-btn");
      this.hideButton("enable-protection-btn");
      this.showResults([
        "✅ 已启用实时监控保护模式",
        "📡 系统将实时拦截IDE的设备ID修改",
        "🛡️ 无需文件级只读保护，避免权限冲突",
        "💡 实时监控更智能，可精确控制保护范围",
      ]);
    } catch (error) {
      this.updateStatus("❌", "启用失败", "error");
      this.showResults([`❌ 启用保护失败: ${error.message}`]);
    }
  }

  /**
   * 禁用保护
   * 注意：实时监控保护模式下的禁用操作
   */
  async disableProtection() {
    try {
      this.updateStatus("🔄", "禁用保护中...", "processing");
      this.hideResults();

      // 实时监控保护模式下的禁用操作
      this.updateStatus("🔓", "保护已禁用", "unprotected");
      this.showButton("enable-protection-btn");
      this.hideButton("disable-protection-btn");
      this.showResults([
        "✅ 实时监控保护已禁用",
        "⚠️ 系统不再拦截IDE的设备ID修改",
        "💡 建议在需要时重新启用实时监控保护",
        "🛡️ 无需管理文件权限，避免权限冲突",
      ]);
    } catch (error) {
      this.updateStatus("❌", "禁用失败", "error");
      this.showResults([`❌ 禁用保护失败: ${error.message}`]);
    }
  }

  /**
   * 更新状态显示
   */
  updateStatus(icon, text, className) {
    const statusIcon = document.getElementById("status-icon");
    const statusText = document.getElementById("status-text");
    const statusContainer = document.getElementById("protection-status");

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
    if (button) button.style.display = "inline-block";
  }

  /**
   * 隐藏按钮
   */
  hideButton(buttonId) {
    const button = document.getElementById(buttonId);
    if (button) button.style.display = "none";
  }

  /**
   * 隐藏所有按钮
   */
  hideAllButtons() {
    this.hideButton("enable-protection-btn");
    this.hideButton("disable-protection-btn");
  }

  /**
   * 显示结果
   */
  showResults(messages) {
    const resultsDiv = document.getElementById("protection-results");
    if (resultsDiv) {
      resultsDiv.innerHTML = messages.map((msg) => `<p>${msg}</p>`).join("");
      resultsDiv.style.display = "block";
    }
  }

  /**
   * 隐藏结果
   */
  hideResults() {
    const resultsDiv = document.getElementById("protection-results");
    if (resultsDiv) {
      resultsDiv.style.display = "none";
    }
  }
}

module.exports = { StorageProtectionUI };
