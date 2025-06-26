// 渲染进程脚本 - 处理前端界面逻辑
const { ipcRenderer } = require("electron");

// 全局状态
let isActivated = false;
let deviceInfo = null;

// 页面加载完成后初始化
document.addEventListener("DOMContentLoaded", async () => {
  console.log("页面加载完成，开始初始化...");

  // 加载应用版本信息
  await loadAppVersion();

  // 检查激活状态
  await checkActivationStatus();

  // 加载所有信息板块（不管是否激活都显示）
  await loadAllInfoPanels();

  // 设置事件监听器
  setupEventListeners();

  // 初始化响应式处理
  initializeResponsive();

  // 测试函数是否可用
  console.log("validateActivation 函数是否存在:", typeof validateActivation);
  console.log(
    "window.validateActivation 是否存在:",
    typeof window.validateActivation
  );

  console.log("初始化完成");

  // 确保函数暴露到全局作用域
  window.validateActivation = validateActivation;
  window.performCleanup = performCleanup;
  window.resetUsageCount = resetUsageCount;
  window.checkForUpdates = checkForUpdates;
  window.switchTab = switchTab;
  window.getAugmentInfo = getAugmentInfo;
  window.loadDeviceInfo = loadDeviceInfo;
  window.testServerConnection = testServerConnection;
  window.loadSystemInfo = loadSystemInfo;
  window.testLoading = testLoading;

  // 添加事件监听器作为备用方案
  setTimeout(() => {
    const validateBtn = document.getElementById("validate-btn");
    if (validateBtn) {
      console.log("为激活按钮添加事件监听器");
      validateBtn.addEventListener("click", function (e) {
        e.preventDefault();
        console.log("激活按钮被点击 - 通过事件监听器");
        validateActivation();
      });
    } else {
      console.error("找不到激活按钮");
    }
  }, 1000);
});

// 加载所有信息板块
async function loadAllInfoPanels() {
  console.log("开始加载信息板块...");

  try {
    // 并行加载所有信息板块
    await Promise.allSettled([
      getAugmentInfo(),
      testServerConnection(),
      loadDeviceInfo(),
    ]);
    console.log("信息板块加载完成");
  } catch (error) {
    console.error("加载信息板块时出错:", error);
  }
}

// 设置事件监听器
function setupEventListeners() {
  // 监听服务器通知
  ipcRenderer.on("server-notification", (event, data) => {
    showAlert(`服务器通知: ${data.message}`, data.type || "info");
  });

  // 监听激活撤销
  ipcRenderer.on("activation-revoked", (event, data) => {
    showAlert(`激活已被撤销: ${data.reason}`, "error");
    isActivated = false;
    updateActivationUI();
  });

  // 监听激活删除
  ipcRenderer.on("activation-deleted", (event, data) => {
    showAlert("激活码已被删除", "error");
    isActivated = false;
    updateActivationUI();
  });

  // 监听激活失效
  ipcRenderer.on("activation-invalid", (event, data) => {
    showAlert(`激活验证失败: ${data.reason}`, "error");
    isActivated = false;
    updateActivationUI();
  });

  // 监听下载进度
  ipcRenderer.on("download-progress", (event, percent) => {
    updateDownloadProgress(percent);
  });

  // 监听显示下载进度对话框
  ipcRenderer.on("show-download-progress", () => {
    showAlert("正在下载更新，请稍候...", "info");
  });

  // 监听窗口最大化状态变化
  ipcRenderer.on("window-maximized", (event, isMaximized) => {
    document.body.classList.toggle("window-maximized", isMaximized);
  });
}

// 初始化响应式处理
function initializeResponsive() {
  // 处理窗口大小变化
  window.addEventListener("resize", handleWindowResize);

  // 初始调用一次
  handleWindowResize();

  // 处理键盘快捷键
  document.addEventListener("keydown", handleKeyboardShortcuts);
}

// 处理窗口大小变化
function handleWindowResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  // 根据窗口大小调整布局
  document.body.classList.toggle("compact-mode", width < 768);
  document.body.classList.toggle("mobile-mode", width < 480);

  // 调整网格列数
  const featureGrids = document.querySelectorAll(".feature-grid");
  featureGrids.forEach((grid) => {
    if (width < 768) {
      grid.style.gridTemplateColumns = "1fr";
    } else if (width < 1024) {
      grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(280px, 1fr))";
    } else {
      grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(300px, 1fr))";
    }
  });
}

// 处理键盘快捷键
function handleKeyboardShortcuts(event) {
  // Ctrl/Cmd + 数字键切换标签页
  if (
    (event.ctrlKey || event.metaKey) &&
    event.key >= "1" &&
    event.key <= "3"
  ) {
    event.preventDefault();
    const tabIndex = parseInt(event.key) - 1;
    const tabs = ["dashboard", "tools", "system"];
    if (tabs[tabIndex]) {
      switchTab(tabs[tabIndex]);
    }
  }

  // F11 切换全屏
  if (event.key === "F11") {
    event.preventDefault();
    // 这里可以添加全屏切换逻辑
  }
}

// 切换标签页
function switchTab(tabName) {
  console.log("切换到标签页:", tabName);

  // 移除所有标签按钮的活动状态
  document.querySelectorAll(".tab-btn").forEach((tab) => {
    tab.classList.remove(
      "bg-gradient-to-r",
      "from-indigo-600",
      "to-purple-600",
      "text-white",
      "shadow-lg"
    );
    tab.classList.add(
      "text-gray-600",
      "hover:text-indigo-600",
      "hover:bg-indigo-50"
    );
  });

  // 隐藏所有标签内容
  document
    .querySelectorAll(".tab-content")
    .forEach((content) => content.classList.remove("active"));

  // 激活当前标签按钮
  const targetTab = document.querySelector(`#tab-btn-${tabName}`);
  if (targetTab) {
    targetTab.classList.remove(
      "text-gray-600",
      "hover:text-indigo-600",
      "hover:bg-indigo-50"
    );
    targetTab.classList.add(
      "bg-gradient-to-r",
      "from-indigo-600",
      "to-purple-600",
      "text-white",
      "shadow-lg"
    );
  }

  // 显示当前标签内容
  const targetContent = document.getElementById(`${tabName}-tab`);
  if (targetContent) {
    targetContent.classList.add("active");
  }

  // 根据标签页加载对应数据
  if (tabName === "system") {
    loadSystemInfo();
  }
}

// 系统监控功能
async function loadSystemInfo() {
  try {
    const systemInfo = await ipcRenderer.invoke("get-system-info");
    updateSystemDisplay(systemInfo);
  } catch (error) {
    console.error("获取系统信息失败:", error);
  }
}

// 更新系统信息显示
function updateSystemDisplay(systemInfo) {
  if (!systemInfo) return;

  // 更新CPU使用率
  const cpuProgress = document.querySelector("#cpu-progress");
  const cpuText = document.querySelector("#cpu-text");
  if (cpuProgress && cpuText) {
    cpuProgress.style.width = `${systemInfo.cpu || 0}%`;
    cpuText.textContent = `${systemInfo.cpu || 0}%`;
  }

  // 更新内存使用率
  const memoryProgress = document.querySelector("#memory-progress");
  const memoryText = document.querySelector("#memory-text");
  if (memoryProgress && memoryText) {
    memoryProgress.style.width = `${systemInfo.memory || 0}%`;
    memoryText.textContent = `${systemInfo.memory || 0}%`;
  }

  // 更新磁盘使用率
  const diskProgress = document.querySelector("#disk-progress");
  const diskText = document.querySelector("#disk-text");
  if (diskProgress && diskText) {
    diskProgress.style.width = `${systemInfo.disk || 0}%`;
    diskText.textContent = `${systemInfo.disk || 0}%`;
  }
}

// 检查更新
async function checkForUpdates() {
  try {
    showAlert("正在检查更新...", "info");
    const result = await ipcRenderer.invoke("check-for-updates");

    if (result.hasUpdate) {
      showAlert(`发现新版本 ${result.version}，正在下载...`, "info");
    } else {
      showAlert("当前已是最新版本", "success");
    }
  } catch (error) {
    console.error("检查更新失败:", error);
    showAlert("检查更新失败: " + error.message, "error");
  }
}

// 重置使用计数
async function resetUsageCount() {
  if (!checkFeaturePermission("重置使用计数")) {
    return;
  }

  if (!confirm("确定要重置使用计数吗？此操作不可撤销。")) {
    return;
  }

  try {
    const result = await ipcRenderer.invoke("reset-usage-count");

    if (result.success) {
      showAlert("✅ 使用计数已重置", "success");
    } else {
      showAlert(`❌ 重置失败: ${result.error}`, "error");
    }
  } catch (error) {
    console.error("重置使用计数失败:", error);
    showAlert("重置失败: " + error.message, "error");
  }
}

// 显示加载状态
function showLoading(show = true) {
  const loading = document.getElementById("loading");
  if (loading) {
    if (show) {
      // 显示loading
      loading.classList.remove("hidden");
      loading.style.display = "flex";
      // 强制重绘以确保动画正常
      loading.offsetHeight;
      console.log("显示loading状态");
    } else {
      // 隐藏loading
      setTimeout(() => {
        loading.classList.add("hidden");
        loading.style.display = "none";
      }, 300); // 等待淡出动画完成
      console.log("隐藏loading状态");
    }
  } else {
    console.error("找不到loading元素");
  }
}

// 显示提示信息
function showAlert(message, type = "info") {
  // 移除现有的提示
  const existingAlerts = document.querySelectorAll(".alert-notification");
  existingAlerts.forEach((alert) => alert.remove());

  // 创建新提示
  const alert = document.createElement("div");
  alert.className = `alert-notification alert-${
    type === "error" ? "error" : type === "warning" ? "warning" : "success"
  }`;
  alert.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    max-width: 400px;
    padding: 12px 16px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    font-size: 14px;
    line-height: 1.4;
    animation: slideInRight 0.3s ease-out;
    backdrop-filter: blur(8px);
  `;

  // 设置不同类型的样式
  if (type === "error") {
    alert.style.background = "rgba(239, 68, 68, 0.95)";
    alert.style.color = "white";
    alert.style.border = "1px solid rgba(239, 68, 68, 0.3)";
  } else if (type === "warning") {
    alert.style.background = "rgba(245, 158, 11, 0.95)";
    alert.style.color = "white";
    alert.style.border = "1px solid rgba(245, 158, 11, 0.3)";
  } else {
    alert.style.background = "rgba(34, 197, 94, 0.95)";
    alert.style.color = "white";
    alert.style.border = "1px solid rgba(34, 197, 94, 0.3)";
  }

  alert.innerHTML = message;

  // 插入到body中
  document.body.appendChild(alert);

  // 5秒后自动移除
  setTimeout(() => {
    if (alert.parentNode) {
      alert.style.animation = "slideOutRight 0.3s ease-in";
      setTimeout(() => alert.remove(), 300);
    }
  }, 5000);
}

// 加载应用版本信息
async function loadAppVersion() {
  try {
    const result = await ipcRenderer.invoke("get-app-version");
    document.getElementById("app-name").textContent = result.name;
    document.getElementById("app-version").textContent = result.version;
  } catch (error) {
    console.error("加载版本信息失败:", error);
  }
}

// 检查激活状态
async function checkActivationStatus() {
  try {
    showLoading(true);
    const result = await ipcRenderer.invoke("check-activation-status");

    isActivated = result.activated;
    updateActivationUI(result);

    if (result.activated) {
      let details = `激活时间: ${new Date(
        result.activatedAt
      ).toLocaleString()}`;
      if (result.expiresAt) {
        details += `<br>过期时间: ${new Date(
          result.expiresAt
        ).toLocaleString()}`;
      }
      if (result.offlineMode) {
        details += '<br><span style="color: orange;">⚠️ 离线模式</span>';
      }
      document.getElementById("activation-details").innerHTML = details;
    }
  } catch (error) {
    console.error("检查激活状态失败:", error);
    showAlert("检查激活状态失败: " + error.message, "error");
  } finally {
    showLoading(false);
  }
}

// 更新激活状态UI
function updateActivationUI(statusData = null) {
  const indicator = document.getElementById("status-indicator");
  const statusText = document.getElementById("status-text");
  const statusDetail = document.getElementById("status-detail");
  const activationForm = document.getElementById("activation-form");
  const activatedInfo = document.getElementById("activated-info");

  // 更新顶部快速状态
  const quickStatusIndicator = document.getElementById(
    "quick-status-indicator"
  );
  const quickStatusText = document.getElementById("quick-status-text");

  if (isActivated) {
    // 更新详细状态区域
    indicator.className = "status-indicator status-activated";
    indicator.textContent = ""; // 移除对号
    statusText.textContent = "已激活";
    statusText.className = "text-3xl font-bold text-green-600 mb-2"; // 设置绿色
    statusDetail.textContent = "设备已成功激活，功能可正常使用";
    activationForm.classList.add("hidden");
    activatedInfo.classList.remove("hidden");

    // 更新顶部快速状态
    if (quickStatusIndicator) {
      quickStatusIndicator.className = "w-3 h-3 bg-green-500 rounded-full";
    }
    if (quickStatusText) {
      quickStatusText.textContent = "设备已激活";
    }
  } else {
    // 更新详细状态区域
    indicator.className = "status-indicator status-not-activated";
    indicator.textContent = ""; // 移除叉号
    statusText.textContent = "未激活";
    statusText.className = "text-3xl font-bold text-red-600 mb-2"; // 保持红色

    if (statusData && statusData.reason) {
      statusDetail.textContent = statusData.reason;
    } else {
      statusDetail.textContent = "请输入激活码以启用功能";
    }

    activationForm.classList.remove("hidden");
    activatedInfo.classList.add("hidden");

    // 更新顶部快速状态
    if (quickStatusIndicator) {
      quickStatusIndicator.className =
        "w-3 h-3 bg-red-500 rounded-full animate-pulse";
    }
    if (quickStatusText) {
      quickStatusText.textContent = "设备未激活";
    }
  }
}

// 验证激活码
async function validateActivation() {
  console.log("validateActivation 函数被调用");

  const codeInput = document.getElementById("activation-code");
  if (!codeInput) {
    console.error("找不到激活码输入框");
    showAlert("页面元素错误，请刷新页面", "error");
    return;
  }

  const code = codeInput.value.trim();
  console.log("输入的激活码:", code);

  if (!code) {
    showAlert("请输入激活码", "error");
    return;
  }

  const validateBtn = document.getElementById("validate-btn");
  console.log("找到的按钮元素:", validateBtn);
  const originalText = validateBtn ? validateBtn.innerHTML : "验证激活码";

  try {
    if (validateBtn) {
      validateBtn.disabled = true;
      validateBtn.innerHTML =
        '<div class="spinner" style="width: 20px; height: 20px; margin: 0 auto;"></div>';
    }

    const result = await ipcRenderer.invoke("validate-activation-code", code);

    if (result.success) {
      showAlert(result.message || "激活成功！", "success");
      isActivated = true;
      updateActivationUI();
      codeInput.value = "";

      // 刷新激活状态以获取详细信息
      setTimeout(() => checkActivationStatus(), 1000);
    } else {
      showAlert(result.error || "激活失败", "error");

      if (result.offline) {
        showAlert("网络连接失败，请检查服务器状态", "warning");
      }
    }
  } catch (error) {
    console.error("激活验证失败:", error);
    showAlert("激活验证失败: " + error.message, "error");
  } finally {
    if (validateBtn) {
      validateBtn.disabled = false;
      validateBtn.innerHTML = originalText;
    }
  }
}

// 检查功能权限
function checkFeaturePermission(featureName) {
  if (!isActivated) {
    showAlert(`⚠️ 请先激活设备后再使用「${featureName}」功能`, "warning");
    // 自动切换到仪表盘标签页
    switchTab("dashboard");
    return false;
  }
  return true;
}

// 执行设备清理
async function performCleanup() {
  if (!checkFeaturePermission("设备清理工具")) {
    return;
  }

  const cleanupBtn = document.querySelector("#tools-tab .feature-card .btn");
  const originalText = cleanupBtn.innerHTML;

  try {
    cleanupBtn.disabled = true;
    cleanupBtn.innerHTML =
      '<div class="spinner" style="width: 20px; height: 20px; margin: 0 auto;"></div> 清理中...';

    const result = await ipcRenderer.invoke("perform-device-cleanup");

    if (result.success) {
      let message = "✅ 设备清理完成！";
      if (result.actions && result.actions.length > 0) {
        message +=
          "<br><br>📋 执行的操作:<br>" +
          result.actions.map((action) => `• ${action}`).join("<br>");
      }
      if (result.warning) {
        message += `<br><br><span style="color: #f59e0b;">⚠️ ${result.warning}</span>`;
      }
      showAlert(message, "success");
    } else {
      showAlert(`❌ 设备清理失败: ${result.error || "未知错误"}`, "error");

      if (result.requireActivation) {
        isActivated = false;
        updateActivationUI();
        showAlert("🔒 激活状态已失效，请重新激活", "warning");
      }
    }
  } catch (error) {
    console.error("设备清理失败:", error);
    showAlert(`❌ 设备清理失败: ${error.message}`, "error");
  } finally {
    cleanupBtn.disabled = false;
    cleanupBtn.innerHTML = originalText;
  }
}

// 重置使用计数
async function resetUsageCount() {
  if (!checkFeaturePermission("重置使用计数")) {
    return;
  }

  const resetBtn = document.querySelector(
    "#tools-tab .feature-card:nth-child(2) .btn"
  );
  const originalText = resetBtn.innerHTML;

  try {
    resetBtn.disabled = true;
    resetBtn.innerHTML =
      '<div class="spinner" style="width: 20px; height: 20px; margin: 0 auto;"></div> 重置中...';

    const result = await ipcRenderer.invoke("reset-usage-count");

    if (result.success) {
      let message = "✅ 使用计数重置完成！";
      if (result.warning) {
        message += `<br><br><span style="color: #f59e0b;">⚠️ ${result.warning}</span>`;
      }
      showAlert(message, "success");
    } else {
      showAlert(`❌ 重置失败: ${result.error || "未知错误"}`, "error");

      if (result.requireActivation) {
        isActivated = false;
        updateActivationUI();
        showAlert("🔒 激活状态已失效，请重新激活", "warning");
      }
    }
  } catch (error) {
    console.error("重置使用计数失败:", error);
    showAlert(`❌ 重置使用计数失败: ${error.message}`, "error");
  } finally {
    resetBtn.disabled = false;
    resetBtn.innerHTML = originalText;
  }
}

// 获取Augment扩展信息
async function getAugmentInfo() {
  try {
    showLoading(true);
    const result = await ipcRenderer.invoke("get-augment-info");

    const infoDiv = document.getElementById("augment-info");

    if (result.success && result.data) {
      const data = result.data;
      let html = '<div class="device-info">';

      // 扩展状态显示
      const statusColor = data.installed ? "text-green-600" : "text-red-600";
      const statusText = data.installed ? "已安装" : "未安装";
      html += `<p><strong>扩展状态:</strong> <span class="${statusColor}">${statusText}</span></p>`;

      if (data.installed) {
        // 显示版本信息
        if (data.version) {
          html += `<p><strong>版本:</strong> ${data.version}</p>`;
        }

        // 显示安装路径
        if (data.path) {
          html += `<p><strong>安装路径:</strong> <span class="text-xs text-gray-600">${data.path}</span></p>`;
        }

        // 显示存储状态
        html += `<p><strong>存储目录:</strong> ${
          data.storageExists
            ? '<span class="text-green-600">存在</span>'
            : '<span class="text-red-600">不存在</span>'
        }</p>`;

        if (data.storagePath) {
          html += `<p><strong>存储路径:</strong> <span class="text-xs text-gray-600">${data.storagePath}</span></p>`;
        }
      } else {
        html += '<p class="text-gray-600">请先在Cursor中安装Augment扩展</p>';
      }

      html += "</div>";
      html +=
        '<button class="btn btn-secondary" onclick="getAugmentInfo()">刷新信息</button>';
      infoDiv.innerHTML = html;
    } else {
      infoDiv.innerHTML = `
                <div class="alert alert-error">${
                  result.error || "获取扩展信息失败"
                }</div>
                <button class="btn btn-secondary" onclick="getAugmentInfo()">重试</button>
            `;
    }
  } catch (error) {
    console.error("获取扩展信息失败:", error);
    showAlert("获取扩展信息失败: " + error.message, "error");

    const infoDiv = document.getElementById("augment-info");
    if (infoDiv) {
      infoDiv.innerHTML = `
        <div class="alert alert-error">获取扩展信息失败: ${error.message}</div>
        <button class="btn btn-secondary" onclick="getAugmentInfo()">重试</button>
      `;
    }
  } finally {
    showLoading(false);
  }
}

// 加载设备信息
async function loadDeviceInfo() {
  try {
    showLoading(true);
    const result = await ipcRenderer.invoke("get-device-info");

    const infoDiv = document.getElementById("device-info");

    if (result.success) {
      let html = "<h3>📱 设备信息</h3>";
      html += `<p><strong>设备ID:</strong> ${result.deviceId}</p>`;
      html += `<p><strong>操作系统:</strong> ${result.systemInfo.platform}</p>`;
      html += `<p><strong>架构:</strong> ${result.systemInfo.arch}</p>`;
      html += `<p><strong>主机名:</strong> ${result.systemInfo.hostname}</p>`;
      html += `<p><strong>用户名:</strong> ${result.systemInfo.username}</p>`;
      html += `<p><strong>系统版本:</strong> ${result.systemInfo.version}</p>`;

      infoDiv.innerHTML = html;
    } else {
      infoDiv.innerHTML = `
                <h3>📱 设备信息</h3>
                <div class="alert alert-error">获取设备信息失败: ${result.error}</div>
                <button class="btn btn-secondary" onclick="loadDeviceInfo()">重试</button>
            `;
    }
  } catch (error) {
    console.error("加载设备信息失败:", error);
    showAlert("加载设备信息失败: " + error.message, "error");
  } finally {
    showLoading(false);
  }
}

// 测试服务器连接
async function testServerConnection() {
  try {
    showLoading(true);
    const result = await ipcRenderer.invoke("test-server-connection");

    const resultDiv = document.getElementById("connection-result");

    if (result.success) {
      resultDiv.innerHTML = `
                <div class="alert alert-success" style="margin-top: 15px;">
                    <strong>✅ 服务器连接正常</strong><br>
                    服务器地址: ${result.serverUrl}<br>
                    响应状态: ${result.status}
                </div>
            `;
    } else {
      resultDiv.innerHTML = `
                <div class="alert alert-error" style="margin-top: 15px;">
                    <strong>❌ 服务器连接失败</strong><br>
                    错误信息: ${result.error}<br>
                    ${result.details ? result.details + "<br>" : ""}
                    服务器地址: ${result.serverUrl}
                </div>
            `;
    }
  } catch (error) {
    console.error("测试服务器连接失败:", error);
    showAlert("测试服务器连接失败: " + error.message, "error");
  } finally {
    showLoading(false);
  }
}

// 检查更新 (HTML调用的函数名)
async function checkUpdate() {
  return await checkForUpdates();
}

// 检查更新
async function checkForUpdates() {
  try {
    showLoading(true);
    const result = await ipcRenderer.invoke("check-for-updates");

    const resultDiv = document.getElementById("update-result");

    if (result.success) {
      resultDiv.innerHTML = `
                <div class="alert alert-success" style="margin-top: 15px;">
                    <strong>✅ 更新检查完成</strong><br>
                    已检查最新版本
                </div>
            `;
    } else {
      resultDiv.innerHTML = `
                <div class="alert alert-error" style="margin-top: 15px;">
                    <strong>❌ 更新检查失败</strong><br>
                    错误信息: ${result.error}
                </div>
            `;
    }
  } catch (error) {
    console.error("检查更新失败:", error);
    showAlert("检查更新失败: " + error.message, "error");
  } finally {
    showLoading(false);
  }
}

// 更新下载进度
function updateDownloadProgress(percent) {
  const resultDiv = document.getElementById("update-result");
  resultDiv.innerHTML = `
        <div class="alert alert-warning" style="margin-top: 15px;">
            <strong>📥 正在下载更新...</strong><br>
            进度: ${percent}%<br>
            <div style="background: #e0e0e0; border-radius: 10px; height: 10px; margin-top: 10px;">
                <div style="background: #667eea; height: 100%; border-radius: 10px; width: ${percent}%; transition: width 0.3s ease;"></div>
            </div>
        </div>
    `;
}

// 键盘事件处理
document.addEventListener("keydown", (event) => {
  // Enter键提交激活码
  if (
    event.key === "Enter" &&
    document.activeElement.id === "activation-code"
  ) {
    validateActivation();
  }

  // F5刷新激活状态
  if (event.key === "F5") {
    event.preventDefault();
    checkActivationStatus();
  }
});

// 工具函数：复制到剪贴板
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showAlert("已复制到剪贴板", "success");
  } catch (error) {
    console.error("复制失败:", error);
    showAlert("复制失败", "error");
  }
}

// 测试Loading效果
function testLoading() {
  console.log("开始测试Loading效果");
  showLoading(true);

  // 3秒后隐藏loading
  setTimeout(() => {
    showLoading(false);
    showAlert("Loading测试完成！", "success");
  }, 3000);
}
