// 渲染进程脚本 - 处理前端界面逻辑
const { ipcRenderer } = require("electron");

// 全局状态
let isActivated = false;
let deviceInfo = null;
let systemInfoTimer = null;

// 页面加载完成后初始化
document.addEventListener("DOMContentLoaded", async () => {
  console.log("页面加载完成，开始初始化...");

  // 加载应用版本信息
  await loadAppVersion();

  // 调试：检查按钮是否存在
  setTimeout(() => {
    const cleanupBtn = document.querySelector(
      '#tools-tab button[onclick="performCleanup()"]'
    );
    const resetBtn = document.querySelector(
      '#tools-tab button[onclick="resetUsageCount()"]'
    );
    console.log("清理按钮检查:", cleanupBtn ? "找到" : "未找到", cleanupBtn);
    console.log("重置按钮检查:", resetBtn ? "找到" : "未找到", resetBtn);
  }, 1000);

  // 检查激活状态
  await checkActivationStatus();

  // 加载所有信息板块（不管是否激活都显示）
  await loadAllInfoPanels();

  // 设置事件监听器
  setupEventListeners();

  // 初始化响应式处理
  initializeResponsive();

  // 启动系统信息定时刷新
  startSystemInfoRefresh();

  console.log("初始化完成");

  // 确保函数暴露到全局作用域
  window.validateActivation = validateActivation;
  window.performCleanup = performCleanup;
  window.resetUsageCount = resetUsageCount;
  window.checkForUpdates = checkForUpdates;
  window.switchTab = switchTab;
  window.getAugmentInfo = getAugmentInfo;
  window.loadDeviceInfo = loadDeviceInfo;

  window.loadSystemInfo = loadSystemInfo;
  window.testLoading = testLoading;

  // 公告历史记录功能
  window.toggleAnnouncementHistory = toggleAnnouncementHistory;
  window.openAnnouncementHistory = openAnnouncementHistory;
  window.closeAnnouncementHistory = closeAnnouncementHistory;
  window.loadAnnouncementHistory = loadAnnouncementHistory;
  window.deleteAnnouncementItem = deleteAnnouncementItem;
  window.clearAnnouncementHistory = clearAnnouncementHistory;

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
    await Promise.allSettled([getAugmentInfo(), loadDeviceInfo()]);
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

  // 监听激活禁用
  ipcRenderer.on("activation-disabled", (event, data) => {
    showAlert(`账户已被禁用: ${data.reason}`, "error");
    isActivated = false;
    updateActivationUI();
  });

  // 监听激活启用
  ipcRenderer.on("activation-enabled", (event, data) => {
    showAlert(`账户已被启用: ${data.reason}`, "success");
    checkActivationStatus(); // 重新检查激活状态
  });

  // 监听服务器通知
  ipcRenderer.on("notification", (event, data) => {
    showAlert(
      `${data.title}: ${data.message}`,
      data.notificationType || "info"
    );
  });

  // 监听广播消息
  ipcRenderer.on("broadcast-message", (event, data) => {
    showBroadcastMessage(data);
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
  } else if (tabName === "dashboard") {
    // 仪表盘页面也需要加载系统信息
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

// 根据使用率获取渐变背景样式 - 柔和版本
function getUsageGradient(percentage) {
  if (percentage >= 90) {
    // 危险：柔和红色渐变
    return "linear-gradient(135deg, #f87171 0%, #ef4444 50%, #dc2626 100%)";
  } else if (percentage >= 80) {
    // 警告：柔和橙色渐变
    return "linear-gradient(135deg, #fb923c 0%, #f97316 50%, #ea580c 100%)";
  } else if (percentage >= 70) {
    // 注意：柔和黄色渐变
    return "linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)";
  } else if (percentage >= 50) {
    // 正常：柔和蓝色渐变
    return "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)";
  } else if (percentage >= 30) {
    // 良好：柔和青色渐变
    return "linear-gradient(135deg, #22d3ee 0%, #06b6d4 50%, #0891b2 100%)";
  } else {
    // 优秀：柔和绿色渐变
    return "linear-gradient(135deg, #4ade80 0%, #22c55e 50%, #16a34a 100%)";
  }
}

// 更新系统信息显示
function updateSystemDisplay(systemInfo) {
  if (!systemInfo) return;

  // 更新CPU使用率
  const cpuProgress = document.querySelector("#cpu-progress");
  const cpuText = document.querySelector("#cpu-text");
  if (cpuProgress && cpuText) {
    const cpuUsage = systemInfo.cpu || 0;
    cpuProgress.style.width = `${cpuUsage}%`;
    cpuText.textContent = `${cpuUsage}%`;

    // 动态更新渐变背景
    cpuProgress.style.background = getUsageGradient(cpuUsage);
    cpuProgress.style.transition = "all 0.5s ease";
    cpuProgress.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
    cpuProgress.style.borderRadius = "6px";
  }

  // 更新内存使用率
  const memoryProgress = document.querySelector("#memory-progress");
  const memoryText = document.querySelector("#memory-text");
  if (memoryProgress && memoryText) {
    const memoryUsage = systemInfo.memory || 0;
    memoryProgress.style.width = `${memoryUsage}%`;
    memoryText.textContent = `${memoryUsage}%`;

    // 动态更新渐变背景
    memoryProgress.style.background = getUsageGradient(memoryUsage);
    memoryProgress.style.transition = "all 0.5s ease";
    memoryProgress.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
    memoryProgress.style.borderRadius = "6px";
  }

  // 更新磁盘使用率
  const diskProgress = document.querySelector("#disk-progress");
  const diskText = document.querySelector("#disk-text");
  if (diskProgress && diskText) {
    const diskUsage = systemInfo.disk || 0;
    diskProgress.style.width = `${diskUsage}%`;
    diskText.textContent = `${diskUsage}%`;

    // 动态更新渐变背景
    diskProgress.style.background = getUsageGradient(diskUsage);
    diskProgress.style.transition = "all 0.5s ease";
    diskProgress.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
    diskProgress.style.borderRadius = "6px";
  }

  // 更新系统详细信息
  const hostnameText = document.querySelector("#hostname-text");
  if (hostnameText) {
    hostnameText.textContent = systemInfo.hostname || "-";
  }

  const uptimeText = document.querySelector("#uptime-text");
  if (uptimeText) {
    const uptime = systemInfo.uptime || 0;
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    uptimeText.textContent = `${hours}小时${minutes}分钟`;
  }

  const cpuCountText = document.querySelector("#cpu-count-text");
  if (cpuCountText) {
    cpuCountText.textContent = `${systemInfo.cpuCount || 0}核`;
  }

  const totalMemoryText = document.querySelector("#total-memory-text");
  if (totalMemoryText) {
    totalMemoryText.textContent = `${systemInfo.totalMemory || 0}GB`;
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

// 显示广播消息
function showBroadcastMessage(data) {
  const { message, timestamp, from, isHistorical } = data;
  const time = new Date(timestamp).toLocaleString();

  // 保存消息到本地历史记录（所有消息都保存，包括历史消息）
  saveAnnouncementToHistory(data);

  // 如果是历史消息，只在控制台记录，不显示弹窗（避免打扰用户）
  if (isHistorical) {
    console.log(`[历史广播消息] ${time}: ${message}`);
    return;
  }

  // 移除现有的广播消息
  const existingBroadcasts = document.querySelectorAll(
    ".broadcast-notification"
  );
  existingBroadcasts.forEach((broadcast) => broadcast.remove());

  // 创建广播消息元素
  const broadcast = document.createElement("div");
  broadcast.className = "broadcast-notification";
  broadcast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10001;
    max-width: 600px;
    min-width: 400px;
    padding: 16px 20px;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    font-size: 14px;
    line-height: 1.5;
    animation: slideInDown 0.4s ease-out;
    backdrop-filter: blur(12px);
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.95), rgba(147, 51, 234, 0.95));
    color: white;
    border: 2px solid rgba(255, 255, 255, 0.2);
  `;

  broadcast.innerHTML = `
    <div style="display: flex; align-items: center; margin-bottom: 8px;">
      <span style="font-size: 18px; margin-right: 8px;">📢</span>
      <span style="font-weight: bold; font-size: 16px;">系统广播</span>
      <span style="margin-left: auto; font-size: 12px; opacity: 0.8;">${time}</span>
    </div>
    <div style="font-size: 15px; margin-bottom: 12px;">${message}</div>
    <button onclick="this.parentElement.remove()" style="
      position: absolute;
      top: 8px;
      right: 12px;
      background: none;
      border: none;
      color: white;
      font-size: 18px;
      cursor: pointer;
      opacity: 0.7;
      transition: opacity 0.2s;
    " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'">×</button>
  `;

  // 插入到body中
  document.body.appendChild(broadcast);

  // 广播消息不自动关闭，需要用户手动关闭
  // 这样确保用户能看到重要的系统通知

  // 记录到控制台
  console.log(`[广播消息] ${time}: ${message}`);
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
    // 更新状态文本
    statusText.textContent = "已激活";
    statusText.className = "text-xl font-bold text-green-600 mb-2"; // 设置绿色
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
    // 更新状态文本
    statusText.textContent = "未激活";
    statusText.className = "text-xl font-bold text-red-600 mb-2"; // 保持红色

    if (statusData && statusData.reason) {
      statusDetail.textContent = statusData.reason;
    } else {
      statusDetail.textContent = "请输入激活码以启用功能";
    }

    activationForm.classList.remove("hidden");
    activatedInfo.classList.add("hidden");

    // 更新顶部快速状态
    if (quickStatusIndicator) {
      quickStatusIndicator.className = "w-3 h-3 bg-red-500 rounded-full";
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

// 更新清理按钮状态
function updateCleanupButtonState() {
  const cleanupBtn = document.querySelector(
    '#tools-tab button[onclick="performCleanup()"]'
  );
  if (!cleanupBtn) return;

  // 简化逻辑，只检查激活状态
  if (!isActivated) {
    cleanupBtn.disabled = true;
    cleanupBtn.style.opacity = "0.5";
    cleanupBtn.style.cursor = "not-allowed";
    cleanupBtn.title = "需要激活设备后才能使用清理功能";
  } else {
    cleanupBtn.disabled = false;
    cleanupBtn.style.opacity = "1";
    cleanupBtn.style.cursor = "pointer";
    cleanupBtn.title = "执行设备清理操作";
  }
}

// 检查功能权限
async function checkFeaturePermission(featureName, operation = null) {
  console.log(
    `检查功能权限: ${featureName}, 操作: ${operation}, 激活状态: ${isActivated}`
  );

  if (!isActivated) {
    showAlert(`⚠️ 请先激活设备后再使用「${featureName}」功能`, "warning");
    // 自动切换到仪表盘标签页
    switchTab("dashboard");
    return false;
  }

  // 如果指定了操作类型，进行服务端权限验证
  if (operation) {
    try {
      console.log(`正在验证操作权限: ${operation}`);
      const result = await ipcRenderer.invoke(
        "verify-operation-permission",
        operation
      );
      console.log("权限验证结果:", result);

      if (!result.success) {
        if (result.requireConnection) {
          showAlert(`🔒 ${result.error}`, "error");
          // 显示连接状态信息
          if (result.wsStatus) {
            console.log("WebSocket状态:", result.wsStatus);
          }
        } else {
          showAlert(`⚠️ ${result.error}`, "error");
        }
        return false;
      }
      return result.permissions;
    } catch (error) {
      console.error("权限验证失败:", error);
      showAlert("权限验证失败，请重新激活", "error");
      return false;
    }
  }

  console.log("权限检查通过");
  return true;
}

// 执行设备清理
async function performCleanup() {
  console.log("performCleanup 函数被调用");

  const permissions = await checkFeaturePermission("设备清理工具", "cleanup");
  if (!permissions) {
    console.log("权限检查失败，退出函数");
    return;
  }

  // 显示美化的确认对话框
  const confirmResult = await ipcRenderer.invoke("show-message-box", {
    type: "warning",
    title: "🧹 设备清理工具",
    message: "🧹 设备清理工具\n\n您即将执行完整的设备清理操作",
    detail: `
🔄 此操作将执行以下清理：

📁 数据清理
  • 清理所有 Augment 扩展相关数据
  • 清理设备激活信息和配置文件
  • 清理浏览器扩展本地存储数据

🔧 系统重置
  • 重置设备指纹和唯一标识
  • 清理缓存和临时文件
  • 清理注册表相关项（Windows）

✨ 清理效果
  • 扩展将认为这是全新设备
  • 所有使用记录将被重置
  • 需要重新激活设备才能使用

⚠️  重要提醒
此操作不可撤销！清理后您需要：
1. 重新激活设备
2. 重新配置相关设置
3. 可能需要重启应用

确定要继续吗？`,
    buttons: ["🚀 确定清理", "❌ 取消操作"],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  });

  if (confirmResult.response !== 0) {
    console.log("用户取消清理操作");
    return;
  }

  // 修正按钮选择器 - 直接通过onclick属性查找按钮
  const cleanupBtn = document.querySelector(
    '#tools-tab button[onclick="performCleanup()"]'
  );

  if (!cleanupBtn) {
    console.error("找不到清理按钮");
    console.log(
      "尝试查找所有工具页面按钮:",
      document.querySelectorAll("#tools-tab button")
    );
    showAlert("页面元素错误，请刷新页面", "error");
    return;
  }

  const originalText = cleanupBtn.innerHTML;
  console.log("找到清理按钮，开始执行清理操作");

  try {
    cleanupBtn.disabled = true;
    cleanupBtn.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
        <div style="width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <span>清理中...</span>
      </div>
    `;

    console.log("正在调用设备清理功能...");
    const result = await ipcRenderer.invoke("perform-device-cleanup");
    console.log("设备清理结果:", result);

    if (result.success) {
      let message = `
        <div style="text-align: center; padding: 10px;">
          <div style="font-size: 24px; margin-bottom: 15px;">🎉</div>
          <div style="font-size: 18px; font-weight: bold; color: #059669; margin-bottom: 15px;">
            设备清理完成！
          </div>
        </div>
      `;

      if (result.actions && result.actions.length > 0) {
        message += `
          <div style="background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 12px; margin: 15px 0; border-radius: 4px;">
            <div style="font-weight: bold; color: #0369a1; margin-bottom: 8px;">📋 执行的操作：</div>
            <div style="font-size: 14px; line-height: 1.6;">
              ${result.actions
                .map(
                  (action) => `<div style="margin: 4px 0;">• ${action}</div>`
                )
                .join("")}
            </div>
          </div>
        `;
      }

      if (result.warning) {
        message += `
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 15px 0; border-radius: 4px;">
            <span style="color: #92400e; font-weight: bold;">⚠️ ${result.warning}</span>
          </div>
        `;
      }

      // 添加美化的重要提示
      message += `
        <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 15px 0; border-radius: 4px;">
          <div style="font-weight: bold; color: #dc2626; margin-bottom: 10px; font-size: 16px;">
            🔄 重要提示
          </div>
          <div style="color: #7f1d1d; line-height: 1.6; font-size: 14px;">
            <div style="margin: 6px 0;">✨ 设备已重置为新设备状态</div>
            <div style="margin: 6px 0;">🆕 扩展将认为这是一个全新的设备</div>
            <div style="margin: 6px 0;">🔑 请重新激活设备以继续使用功能</div>
            <div style="margin: 6px 0;">🔄 建议重启应用以确保所有更改生效</div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 20px; padding: 10px; background: #f8fafc; border-radius: 6px;">
          <div style="color: #64748b; font-size: 14px;">
            🎯 清理成功！您现在可以重新激活设备了
          </div>
        </div>
      `;

      showAlert(message, "success");

      // 清理完成后，重置激活状态
      isActivated = false;
      updateActivationUI();

      // 自动切换到仪表盘页面
      setTimeout(() => {
        switchTab("dashboard");
        showAlert("🔒 设备已重置，请重新激活", "warning");
      }, 3000);
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
  console.log("resetUsageCount 函数被调用");

  const hasPermission = await checkFeaturePermission("重置使用计数");
  if (!hasPermission) {
    console.log("权限检查失败，退出函数");
    return;
  }

  if (!confirm("确定要重置使用计数吗？此操作不可撤销。")) {
    console.log("用户取消操作");
    return;
  }

  // 修正按钮选择器 - 直接通过onclick属性查找按钮
  const resetBtn = document.querySelector(
    '#tools-tab button[onclick="resetUsageCount()"]'
  );

  if (!resetBtn) {
    console.error("找不到重置按钮");
    console.log(
      "尝试查找所有工具页面按钮:",
      document.querySelectorAll("#tools-tab button")
    );
    showAlert("页面元素错误，请刷新页面", "error");
    return;
  }

  const originalText = resetBtn.innerHTML;
  console.log("找到重置按钮，开始执行重置操作");

  try {
    resetBtn.disabled = true;
    resetBtn.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
        <div style="width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <span>重置中...</span>
      </div>
    `;

    console.log("正在调用重置使用计数功能...");
    const result = await ipcRenderer.invoke("reset-usage-count");
    console.log("重置使用计数结果:", result);

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

// ==================== 公告历史记录功能 ====================

// 保存公告到历史记录
function saveAnnouncementToHistory(data) {
  try {
    const { message, timestamp, from, isHistorical, id } = data;

    // 获取现有历史记录
    let history = JSON.parse(
      localStorage.getItem("announcementHistory") || "[]"
    );

    // 检查是否已存在（避免重复保存）
    const exists = history.some(
      (item) =>
        item.id === id ||
        (item.timestamp === timestamp && item.message === message)
    );

    if (!exists) {
      // 添加新消息到历史记录
      history.unshift({
        id: id || Date.now(),
        message: message,
        timestamp: timestamp,
        from: from || "admin",
        isHistorical: isHistorical || false,
        savedAt: new Date().toISOString(),
      });

      // 只保留最近100条记录
      if (history.length > 100) {
        history = history.slice(0, 100);
      }

      // 保存到本地存储
      localStorage.setItem("announcementHistory", JSON.stringify(history));

      console.log("公告已保存到历史记录:", message);
    }
  } catch (error) {
    console.error("保存公告历史记录失败:", error);
  }
}

// 获取公告历史记录
function getAnnouncementHistory() {
  try {
    return JSON.parse(localStorage.getItem("announcementHistory") || "[]");
  } catch (error) {
    console.error("获取公告历史记录失败:", error);
    return [];
  }
}

// 切换公告历史记录弹窗
function toggleAnnouncementHistory() {
  const modal = document.getElementById("announcement-history-modal");
  const isVisible = !modal.classList.contains("hidden");

  if (isVisible) {
    closeAnnouncementHistory();
  } else {
    openAnnouncementHistory();
  }
}

// 打开公告历史记录弹窗
function openAnnouncementHistory() {
  const modal = document.getElementById("announcement-history-modal");
  const modalContent = modal.querySelector(".bg-white\\/95");

  // 显示弹窗
  modal.classList.remove("hidden");

  // 触发动画
  setTimeout(() => {
    modal.classList.remove("opacity-0");
    modalContent.classList.remove("scale-95");
    modalContent.classList.add("scale-100");
  }, 10);

  // 加载历史记录
  loadAnnouncementHistory();

  // 阻止页面滚动
  document.body.style.overflow = "hidden";
}

// 关闭公告历史记录弹窗
function closeAnnouncementHistory(event) {
  // 如果点击的是弹窗内容区域，不关闭
  if (event && event.target !== event.currentTarget) {
    return;
  }

  const modal = document.getElementById("announcement-history-modal");
  const modalContent = modal.querySelector(".bg-white\\/95");

  // 触发关闭动画
  modal.classList.add("opacity-0");
  modalContent.classList.remove("scale-100");
  modalContent.classList.add("scale-95");

  // 动画完成后隐藏弹窗
  setTimeout(() => {
    modal.classList.add("hidden");
    document.body.style.overflow = "auto";
  }, 300);
}

// 加载公告历史记录
function loadAnnouncementHistory() {
  const contentContainer = document.getElementById(
    "announcement-history-content"
  );
  const countElement = document.getElementById("announcement-count");

  try {
    const history = getAnnouncementHistory();

    // 更新计数
    countElement.textContent = history.length;

    if (history.length === 0) {
      contentContainer.innerHTML = `
        <div class="text-center py-12 text-gray-500">
          <svg class="w-16 h-16 mx-auto mb-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
          </svg>
          <p class="text-lg font-medium mb-2">暂无历史公告</p>
          <p class="text-sm">当收到新的广播消息时，会自动保存到这里</p>
        </div>
      `;
      return;
    }

    // 渲染历史记录
    contentContainer.innerHTML = history
      .map((item, index) => {
        const time = new Date(item.timestamp).toLocaleString();
        const isHistoricalBadge = item.isHistorical
          ? '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 ml-2">历史</span>'
          : '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 ml-2">实时</span>';

        return `
        <div class="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200/50 hover:shadow-md transition-all duration-200">
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center">
              <div class="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center mr-3">
                <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
                </svg>
              </div>
              <div>
                <div class="flex items-center">
                  <span class="font-medium text-gray-800">系统公告 #${
                    history.length - index
                  }</span>
                  ${isHistoricalBadge}
                </div>
                <div class="text-sm text-gray-500 mt-1">
                  <span>发布时间: ${time}</span>
                  <span class="mx-2">•</span>
                  <span>来源: ${item.from}</span>
                </div>
              </div>
            </div>
            <button
              onclick="deleteAnnouncementItem('${item.id}')"
              class="p-1 hover:bg-red-100 rounded-lg transition-colors duration-200 text-gray-400 hover:text-red-600"
              title="删除此条公告"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          <div class="text-gray-700 leading-relaxed bg-white/50 rounded-lg p-3 border border-gray-200/30">
            ${item.message}
          </div>
        </div>
      `;
      })
      .join("");
  } catch (error) {
    console.error("加载公告历史记录失败:", error);
    contentContainer.innerHTML = `
      <div class="text-center py-8 text-red-500">
        <p>加载历史记录失败，请稍后重试</p>
      </div>
    `;
  }
}

// 删除单条公告记录
function deleteAnnouncementItem(id) {
  try {
    let history = getAnnouncementHistory();
    history = history.filter((item) => item.id != id);
    localStorage.setItem("announcementHistory", JSON.stringify(history));

    // 重新加载历史记录
    loadAnnouncementHistory();

    showAlert("公告已删除", "success");
  } catch (error) {
    console.error("删除公告失败:", error);
    showAlert("删除失败，请稍后重试", "error");
  }
}

// 清空公告历史记录
function clearAnnouncementHistory() {
  if (confirm("确定要清空所有历史公告吗？此操作不可撤销。")) {
    try {
      localStorage.removeItem("announcementHistory");
      loadAnnouncementHistory();
      showAlert("历史公告已清空", "success");
    } catch (error) {
      console.error("清空历史记录失败:", error);
      showAlert("清空失败，请稍后重试", "error");
    }
  }
}

// 启动系统信息定时刷新
function startSystemInfoRefresh() {
  // 清除现有定时器
  if (systemInfoTimer) {
    clearInterval(systemInfoTimer);
  }

  // 立即加载一次
  loadSystemInfo();

  // 每5秒刷新一次系统信息
  systemInfoTimer = setInterval(() => {
    loadSystemInfo();
  }, 5000);
}

// 停止系统信息定时刷新
function stopSystemInfoRefresh() {
  if (systemInfoTimer) {
    clearInterval(systemInfoTimer);
    systemInfoTimer = null;
  }
}

// 移除了复杂的进度条动画样式，保持简洁
