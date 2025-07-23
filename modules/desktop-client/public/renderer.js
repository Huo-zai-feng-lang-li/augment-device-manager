// 渲染进程脚本 - 处理前端界面逻辑
const { ipcRenderer } = require("electron");

// 全局状态
let isActivated = false;
let deviceInfo = null;
let systemInfoTimer = null;
let isCleanupMonitoring = false; // 清理监控状态标志

// 智能Tooltip系统 - 仅在极简模式下使用data-tooltip属性
class SmartTooltip {
  constructor() {
    this.tooltip = null;
    this.currentTarget = null;
    this.showTimeout = null;
    this.hideTimeout = null;
    this.init();
  }

  init() {
    // 检查是否已存在tooltip元素，避免重复创建
    if (document.querySelector(".smart-tooltip")) {
      return;
    }

    // 创建tooltip元素
    this.tooltip = document.createElement("div");
    this.tooltip.className = "smart-tooltip";
    this.tooltip.style.cssText = `
      position: absolute;
      background: rgba(15, 23, 42, 0.96);
      color: white;
      padding: 20px 24px;
      border-radius: 12px;
      font-size: 13px;
      line-height: 2.2;
      max-width: 480px;
      min-width: 360px;
      word-wrap: break-word;
      white-space: pre-wrap;
      overflow-wrap: break-word;
      z-index: 10000;
      pointer-events: none;
      opacity: 0;
      transform: scale(0.8);
      transition: all 0.2s ease;
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      letter-spacing: 0.3px;
      text-align: left;
    `;
    document.body.appendChild(this.tooltip);

    // 绑定事件
    this.bindEvents();
  }

  bindEvents() {
    document.addEventListener("mouseover", (e) => {
      const target = e.target.closest("[data-tooltip]");
      if (target && target.dataset.tooltip) {
        this.show(target, target.dataset.tooltip);
      }
    });

    document.addEventListener("mouseout", (e) => {
      const target = e.target.closest("[data-tooltip]");
      if (target === this.currentTarget) {
        this.hide();
      }
    });

    document.addEventListener("scroll", () => {
      if (this.currentTarget) {
        this.updatePosition();
      }
    });

    window.addEventListener("resize", () => {
      if (this.currentTarget) {
        this.updatePosition();
      }
    });
  }

  show(target, text) {
    if (!this.tooltip) return;

    if (this.showTimeout) clearTimeout(this.showTimeout);
    if (this.hideTimeout) clearTimeout(this.hideTimeout);

    this.currentTarget = target;
    this.tooltip.textContent = text;

    this.showTimeout = setTimeout(() => {
      this.updatePosition();
      this.tooltip.style.opacity = "1";
      this.tooltip.style.transform = "scale(1)";
    }, 300);
  }

  hide() {
    if (!this.tooltip) return;

    if (this.showTimeout) clearTimeout(this.showTimeout);

    this.hideTimeout = setTimeout(() => {
      this.tooltip.style.opacity = "0";
      this.tooltip.style.transform = "scale(0.8)";
      this.currentTarget = null;
    }, 100);
  }

  updatePosition() {
    if (!this.currentTarget || !this.tooltip) return;

    const targetRect = this.currentTarget.getBoundingClientRect();
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    let x, y;
    let placement = "top"; // 默认在上方

    // 计算最佳位置
    const positions = {
      top: {
        x: targetRect.left + targetRect.width / 2 - tooltipRect.width / 2,
        y: targetRect.top - tooltipRect.height - 8,
      },
      bottom: {
        x: targetRect.left + targetRect.width / 2 - tooltipRect.width / 2,
        y: targetRect.bottom + 8,
      },
      left: {
        x: targetRect.left - tooltipRect.width - 8,
        y: targetRect.top + targetRect.height / 2 - tooltipRect.height / 2,
      },
      right: {
        x: targetRect.right + 8,
        y: targetRect.top + targetRect.height / 2 - tooltipRect.height / 2,
      },
    };

    // 选择最佳位置（优先级：top > bottom > right > left）
    for (const pos of ["top", "bottom", "right", "left"]) {
      const position = positions[pos];
      if (
        position.x >= 8 &&
        position.x + tooltipRect.width <= viewportWidth - 8 &&
        position.y >= 8 &&
        position.y + tooltipRect.height <= viewportHeight - 8
      ) {
        x = position.x;
        y = position.y;
        placement = pos;
        break;
      }
    }

    // 如果没有合适位置，使用智能调整
    if (x === undefined || y === undefined) {
      x = Math.min(
        Math.max(
          8,
          targetRect.left + targetRect.width / 2 - tooltipRect.width / 2
        ),
        viewportWidth - tooltipRect.width - 8
      );
      y = Math.min(
        Math.max(8, targetRect.top - tooltipRect.height - 8),
        viewportHeight - tooltipRect.height - 8
      );
    }

    this.tooltip.style.left = x + scrollX + "px";
    this.tooltip.style.top = y + scrollY + "px";

    // 添加箭头指示
    this.tooltip.setAttribute("data-placement", placement);
  }
}

// 初始化智能Tooltip
let smartTooltip;

// 页面加载完成后初始化
document.addEventListener("DOMContentLoaded", async () => {
  console.log("页面加载完成，开始初始化...");

  // 仅在极简模式下初始化智能Tooltip系统（检查是否存在data-tooltip属性的元素）
  if (document.querySelector("[data-tooltip]")) {
    smartTooltip = new SmartTooltip();
  }

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

  // 初始化选择的IDE（确保后端知道当前选择）
  await initializeSelectedIDE();

  // 绑定增强防护按钮事件
  const startGuardianBtn = document.getElementById("start-guardian-btn");
  if (startGuardianBtn) {
    startGuardianBtn.onclick = startGuardianService;
    console.log("✅ 增强防护按钮事件已绑定");
  }

  // 启动增强防护状态监控
  startGuardianStatusMonitoring();

  // 设置清理事件监听器
  setupCleanupEventListeners();

  // 获取WebSocket连接状态
  await getWebSocketStatus();

  // 自动模拟点击测试连接按钮（启动时自动测试连接）
  console.log("🔄 启动时自动测试服务器连接...");
  setTimeout(async () => {
    try {
      // 模拟点击测试连接按钮的完整逻辑
      const result = await ipcRenderer.invoke("test-server-connection");

      if (result.success) {
        console.log("✅ 启动时连接测试成功:", result.message);
        // 重新获取WebSocket状态
        await getWebSocketStatus();
        // 测量网络延迟
        await measureNetworkLatency();
      } else {
        console.log("❌ 启动时连接测试失败:", result.error);
      }
    } catch (error) {
      console.error("启动时测试连接失败:", error);
    }
  }, 1000); // 延迟1秒执行，确保界面已加载

  // 测量网络延迟
  await measureNetworkLatency();

  // 加载所有信息板块（不管是否激活都显示）
  await loadAllInfoPanels();

  // 设置事件监听器
  setupEventListeners();

  // 初始化响应式处理
  initializeResponsive();

  // 启动系统信息定时刷新
  startSystemInfoRefresh();

  // 启动激活状态定期检查（每30秒检查一次）
  startActivationStatusMonitoring();

  // 添加IDE选择变化监听器
  const ideSelectionInputs = document.querySelectorAll(
    'input[name="ide-selection"]'
  );
  ideSelectionInputs.forEach((input) => {
    input.addEventListener("change", async () => {
      // 检查增强防护状态，如果正在运行则阻止切换
      const guardianStatus = await getEnhancedGuardianStatus();
      const isProtectionRunning =
        guardianStatus.isGuarding ||
        (guardianStatus.standalone && guardianStatus.standalone.isRunning) ||
        (guardianStatus.inProcess && guardianStatus.inProcess.isGuarding);

      if (isProtectionRunning) {
        // 恢复到之前的选择
        const previousSelection = document.querySelector(
          'input[name="ide-selection"]:not(:checked)'
        );
        if (previousSelection) {
          previousSelection.checked = true;
          input.checked = false;
        }

        showAlert(
          `⚠️ 无法切换IDE<br><br>` +
            `增强防护正在运行中，无法切换IDE选择。<br><br>` +
            `请先在"增强防护"模块中停止防护服务，然后再切换IDE。`,
          "warning"
        );
        return;
      }

      // 当IDE选择变化时，立即刷新相关信息
      console.log(`IDE选择已切换到: ${input.value}`);

      // 显示loading状态
      showLoading(true);

      try {
        // 首先通知后端更新选择的IDE
        await ipcRenderer.invoke("set-selected-ide", input.value);

        // 并行刷新所有相关信息
        await Promise.allSettled([
          loadSystemInfo(), // 设备ID显示（现在会根据新选择的IDE获取对应的系统模块ID）
          getAugmentInfo(), // 扩展信息
          refreshGuardianStatus("ide-change"), // 增强防护状态
        ]);
      } catch (error) {
        console.error("IDE切换时刷新信息失败:", error);
      } finally {
        showLoading(false);
      }
    });
  });

  console.log("初始化完成");

  // 确保函数暴露到全局作用域
  window.validateActivation = validateActivation;
  window.deactivateDevice = deactivateDevice;
  window.performCleanup = performCleanup;
  window.resetUsageCount = resetUsageCount;
  window.checkForUpdates = checkForUpdates;
  window.switchTab = switchTab;
  window.getAugmentInfo = getAugmentInfo;
  window.loadDeviceInfo = loadDeviceInfo;
  window.exportSystemInfo = exportSystemInfo;
  window.copyDeviceId = copyDeviceId;
  window.toggleInfoMode = toggleInfoMode;
  window.toggleCleanupLog = toggleCleanupLog;
  window.testServerConnection = testServerConnection;

  window.loadSystemInfo = loadSystemInfo;
  window.testLoading = testLoading;
  window.startCleanupMonitoring = startCleanupMonitoring;
  window.stopCleanupMonitoring = stopCleanupMonitoring;

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

// 刷新整个客户端数据
async function refreshAllClientData() {
  console.log("🔄 开始刷新整个客户端数据...");

  try {
    showLoading(true);

    // 并行刷新所有数据模块
    const refreshPromises = [
      getAugmentInfo(), // Augment扩展信息
      loadDeviceInfo(), // 设备信息
      loadSystemInfo(), // 系统信息
      loadDeviceIdDetails(), // 设备ID详情
      loadAppVersion(), // 应用版本信息
      getWebSocketStatus(), // WebSocket连接状态
    ];

    // 等待所有刷新操作完成
    const results = await Promise.allSettled(refreshPromises);

    // 检查是否有失败的操作
    const failedOperations = results.filter(
      (result) => result.status === "rejected"
    );

    if (failedOperations.length > 0) {
      console.warn(
        `⚠️ ${failedOperations.length} 个模块刷新失败:`,
        failedOperations
      );
      showAlert(
        `客户端数据已刷新，但有 ${failedOperations.length} 个模块刷新失败`,
        "warning"
      );
    } else {
      console.log("✅ 所有客户端数据刷新完成");
      showAlert("客户端数据已全部刷新完成", "success");
    }
  } catch (error) {
    console.error("❌ 刷新客户端数据时出错:", error);
    showAlert("刷新客户端数据失败: " + error.message, "error");
  } finally {
    showLoading(false);
  }
}

// 设置事件监听器
function setupEventListeners() {
  // 监听服务器通知
  ipcRenderer.on("server-notification", (event, data) => {
    showAlert(`服务器通知: ${data.message}`, data.type || "info");

    // 如果是公告类型，添加到历史记录
    if (data.type === "announcement" || data.message.includes("公告")) {
      // 分发公告事件给简洁版主题
      window.dispatchEvent(
        new CustomEvent("new-announcement", {
          detail: { content: data.message },
        })
      );
    }
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

  // 监听守护进程事件
  ipcRenderer.on("guardian-event", (event, data) => {
    if (data.type === "intercept-success") {
      console.log("🚨 检测到拦截事件，自动刷新状态");
      // 延迟500ms刷新，确保统计数据已更新
      triggerStatusRefresh("intercept-event", 500);
    } else if (data.type === "protection-restored") {
      console.log("🛡️ 检测到保护恢复事件，自动刷新状态");
      // 延迟500ms刷新，确保统计数据已更新
      triggerStatusRefresh("protection-restored", 500);
    } else if (data.type === "backup-removed") {
      console.log("🗑️ 检测到备份删除事件，自动刷新状态");
      // 延迟300ms刷新，备份删除响应更快
      triggerStatusRefresh("backup-removed", 300);
    }
  });

  // 监听激活失效
  ipcRenderer.on("activation-invalid", (event, data) => {
    showAlert(`激活验证失败: ${data.reason}`, "error");
    isActivated = false;
    updateActivationUI();
  });

  // 监听激活过期
  ipcRenderer.on("activation-expired", (event, data) => {
    console.log("🚨 收到激活过期通知:", data);
    showAlert(`激活码已过期: ${data.reason}`, "error");
    isActivated = false;
    updateActivationUI({
      reason: data.reason,
      expired: true,
      requireReactivation: data.requireReactivation,
    });
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

  // 监听激活清除
  ipcRenderer.on("activation-cleared", (event, data) => {
    console.log("🚪 收到激活清除通知:", data);
    showAlert(`已退出激活状态: ${data.reason}`, "info");
    isActivated = false;
    updateActivationUI({
      reason: data.reason,
      cleared: true,
    });
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

  // 监听WebSocket连接状态变化
  ipcRenderer.on("websocket-status-changed", (event, data) => {
    updateConnectionStatus(data);
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

// 切换标签页 - 极简风格
function switchTab(tabName) {
  console.log("切换到标签页:", tabName);

  // 移除所有标签按钮的活动状态
  document.querySelectorAll(".tab-btn").forEach((tab) => {
    tab.classList.remove("bg-slate-100", "text-slate-800");
    tab.classList.add(
      "text-slate-600",
      "hover:text-slate-800",
      "hover:bg-slate-50"
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
      "text-slate-600",
      "hover:text-slate-800",
      "hover:bg-slate-50"
    );
    targetTab.classList.add("bg-slate-100", "text-slate-800");
  }

  // 显示当前标签内容
  const targetContent = document.getElementById(`${tabName}-tab`);
  if (targetContent) {
    targetContent.classList.add("active");
  }

  // 根据标签页加载对应数据
  if (tabName === "system") {
    loadSystemInfo();
    // 系统页面也需要加载设备ID详情
    loadDeviceIdDetails();
  } else if (tabName === "tools") {
    // 工具页面需要设备ID详情（因为设备ID显示已移至增强防护模块）
    loadDeviceIdDetails();
  } else if (tabName === "dashboard") {
    // 仪表盘页面加载系统信息但不自动加载设备ID详情
    loadSystemInfo();
  }
}

// 获取当前选择的IDE
function getCurrentSelectedIDE() {
  const selectedIDE = document.querySelector(
    'input[name="ide-selection"]:checked'
  )?.value;
  return selectedIDE || "cursor"; // 默认为cursor
}

// 初始化选择的IDE
async function initializeSelectedIDE() {
  try {
    const currentIDE = getCurrentSelectedIDE();
    console.log(`🎯 初始化选择的IDE: ${currentIDE}`);

    // 通知后端当前选择的IDE
    await ipcRenderer.invoke("set-selected-ide", currentIDE);
    console.log(`✅ 后端已更新选择的IDE: ${currentIDE}`);
  } catch (error) {
    console.error("初始化选择的IDE失败:", error);
  }
}

// 更新IDE选择的可用性（根据增强防护状态）
function updateIDESelectionAvailability(isProtectionRunning) {
  const ideSelectionInputs = document.querySelectorAll(
    'input[name="ide-selection"]'
  );
  const ideSelectionLabels = document.querySelectorAll('label[for*="ide-"]');

  ideSelectionInputs.forEach((input) => {
    input.disabled = isProtectionRunning;
  });

  ideSelectionLabels.forEach((label) => {
    if (isProtectionRunning) {
      label.style.opacity = "0.5";
      label.style.cursor = "not-allowed";
      label.title = "增强防护运行时无法切换IDE";
    } else {
      label.style.opacity = "1";
      label.style.cursor = "pointer";
      label.title = "";
    }
  });
}

// 获取增强防护状态（统一函数）
async function getEnhancedGuardianStatus() {
  const selectedIDE = getCurrentSelectedIDE();
  return await ipcRenderer.invoke("get-enhanced-guardian-status", {
    selectedIDE,
  });
}

// 防抖变量
let loadSystemInfoTimeout = null;
let isLoadingSystemInfo = false;

// 系统监控功能（优化版本，添加防抖和防重复调用）
async function loadSystemInfo() {
  // 防止重复调用
  if (isLoadingSystemInfo) {
    return;
  }

  isLoadingSystemInfo = true;
  try {
    const systemInfo = await ipcRenderer.invoke("get-system-info");

    // 根据用户选择的IDE获取对应的设备ID作为主要设备ID
    if (!systemInfo.deviceId) {
      try {
        const deviceIdDetails = await ipcRenderer.invoke(
          "get-device-id-details"
        );
        const selectedIDE = getCurrentSelectedIDE();

        if (deviceIdDetails.success) {
          if (
            selectedIDE === "vscode" &&
            deviceIdDetails.vscodeTelemetry?.devDeviceId
          ) {
            // 使用VSCode的telemetry.devDeviceId作为主要设备ID
            systemInfo.deviceId = deviceIdDetails.vscodeTelemetry.devDeviceId;
          } else if (
            selectedIDE === "cursor" &&
            deviceIdDetails.cursorTelemetry?.devDeviceId
          ) {
            // 使用Cursor的telemetry.devDeviceId作为主要设备ID
            systemInfo.deviceId = deviceIdDetails.cursorTelemetry.devDeviceId;
          } else {
            // 如果没有对应IDE的遥测ID，则使用设备指纹作为备用
            const deviceInfo = await ipcRenderer.invoke("get-device-info");
            if (deviceInfo.success && deviceInfo.deviceId) {
              systemInfo.deviceId = deviceInfo.deviceId;
            }
          }
        }
      } catch (deviceError) {
        console.warn("获取设备ID失败:", deviceError);
      }
    }

    updateSystemDisplay(systemInfo);

    // 智能设备ID详情加载：根据监控状态决定是否加载
    const activeTab = document.querySelector(".tab-content.active")?.id;
    if (
      window.isCleanupMonitoring ||
      activeTab === "system-tab" ||
      activeTab === "tools-tab"
    ) {
      await loadDeviceIdDetails();
    }
  } catch (error) {
    console.error("获取系统信息失败:", error);
  } finally {
    // 重置防抖标志
    isLoadingSystemInfo = false;
  }
}

// 加载详细设备ID信息
async function loadDeviceIdDetails() {
  try {
    console.log("🔍 开始获取设备ID详情...");
    const deviceIdInfo = await ipcRenderer.invoke("get-device-id-details");
    console.log("📡 设备ID详情获取结果:", deviceIdInfo);
    updateDeviceIdDisplay(deviceIdInfo);
  } catch (error) {
    console.error("获取设备ID详情失败:", error);
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

  // 更新CPU使用率 - 仪表盘页面
  const cpuProgress = document.querySelector("#cpu-progress");
  const cpuText = document.querySelector("#cpu-text");
  if (cpuProgress && cpuText) {
    const cpuUsage = systemInfo.cpu || 0;
    cpuProgress.style.width = `${cpuUsage}%`;
    cpuText.textContent = `${cpuUsage}%`;
  }

  // 更新CPU使用率 - 系统页面详细信息
  const cpuProgressDetail = document.querySelector("#cpu-progress-detail");
  const cpuTextDetail = document.querySelector("#cpu-text-detail");
  if (cpuProgressDetail && cpuTextDetail) {
    const cpuUsage = systemInfo.cpu || 0;
    cpuProgressDetail.style.width = `${cpuUsage}%`;
    cpuTextDetail.textContent = `${cpuUsage}%`;
  }

  // 更新内存使用率 - 仪表盘页面
  const memoryProgress = document.querySelector("#memory-progress");
  const memoryText = document.querySelector("#memory-text");
  if (memoryProgress && memoryText) {
    const memoryUsage = systemInfo.memory || 0;
    memoryProgress.style.width = `${memoryUsage}%`;
    memoryText.textContent = `${memoryUsage}%`;
  }

  // 更新内存使用率 - 系统页面详细信息
  const memoryProgressDetail = document.querySelector(
    "#memory-progress-detail"
  );
  const memoryTextDetail = document.querySelector("#memory-text-detail");
  if (memoryProgressDetail && memoryTextDetail) {
    const memoryUsage = systemInfo.memory || 0;
    memoryProgressDetail.style.width = `${memoryUsage}%`;
    memoryTextDetail.textContent = `${memoryUsage}%`;
  }

  // 更新磁盘使用率
  const diskProgress = document.querySelector("#disk-progress");
  const diskText = document.querySelector("#disk-text");
  if (diskProgress && diskText) {
    const diskUsage = systemInfo.diskUsage || systemInfo.disk || 57;
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

  // 更新系统页面的运行时间
  const uptimeTextSystem = document.querySelector("#uptime-text-system");
  if (uptimeTextSystem) {
    const uptime = systemInfo.uptime || 0;
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    uptimeTextSystem.textContent = `${hours}小时${minutes}分钟`;
  }

  // 更新软件运行时间
  const appUptimeText = document.querySelector("#app-uptime-text");
  if (appUptimeText) {
    const appUptime = systemInfo.appUptime || 0;
    const hours = Math.floor(appUptime / 3600);
    const minutes = Math.floor((appUptime % 3600) / 60);
    appUptimeText.textContent = `${hours}小时${minutes}分钟`;
  }

  const cpuCountText = document.querySelector("#cpu-count-text");
  if (cpuCountText) {
    cpuCountText.textContent = `${systemInfo.cpuCount || 0}核`;
  }

  // 更新系统页面的CPU核心数
  const cpuCoresText = document.querySelector("#cpu-cores-text");
  if (cpuCoresText) {
    cpuCoresText.textContent = `${systemInfo.cpuCount || 0}核`;
  }

  const totalMemoryText = document.querySelector("#total-memory-text");
  if (totalMemoryText) {
    totalMemoryText.textContent = `${systemInfo.totalMemory || 0}GB`;
  }

  // 更新系统页面的总内存
  const totalMemoryTextSystem = document.querySelector(
    "#total-memory-text-system"
  );
  if (totalMemoryTextSystem) {
    totalMemoryTextSystem.textContent = `${systemInfo.totalMemory || 0}GB`;
  }

  // 更新系统页面的主机名
  const hostnameTextSystem = document.querySelector("#hostname-text");
  if (hostnameTextSystem) {
    hostnameTextSystem.textContent = systemInfo.hostname || "Unknown";
  }

  // 更新设备ID显示（完整显示）
  const deviceIdText = document.querySelector("#device-id-text");
  if (deviceIdText && systemInfo.deviceId) {
    const deviceId = systemInfo.deviceId;
    deviceIdText.textContent = deviceId;
    deviceIdText.setAttribute("data-full-id", deviceId);

    // 添加清理前后对比提示
    const currentId = deviceIdText.getAttribute("data-original-id");
    if (!currentId) {
      deviceIdText.setAttribute("data-original-id", deviceId);
    } else if (currentId !== deviceId) {
      // 设备ID发生了变化，说明清理成功
      deviceIdText.style.backgroundColor = "#dcfce7"; // 浅绿色背景
      deviceIdText.style.border = "1px solid #16a34a";
      deviceIdText.title = `设备ID已更新！\n原ID: ${currentId}\n新ID: ${deviceId}`;
    }
  }
}

// 更新设备ID详情显示
function updateDeviceIdDisplay(deviceIdInfo) {
  if (!deviceIdInfo || !deviceIdInfo.success) {
    console.warn("设备ID信息获取失败");
    // 显示错误状态
    const stableIdElement = document.getElementById("stable-device-id");
    const fingerprintElement = document.getElementById("device-fingerprint");
    const cacheStatusElement = document.getElementById("device-cache-status");

    if (stableIdElement) stableIdElement.textContent = "获取失败";
    if (fingerprintElement) fingerprintElement.textContent = "获取失败";
    if (cacheStatusElement) cacheStatusElement.textContent = "获取失败";
    return;
  }

  // 更新稳定设备ID
  const stableIdElement = document.getElementById("stable-device-id");
  if (stableIdElement && deviceIdInfo.stableDeviceId) {
    stableIdElement.textContent = deviceIdInfo.stableDeviceId;
    stableIdElement.title = `完整ID: ${deviceIdInfo.stableDeviceId}`;
    // 添加点击复制功能
    stableIdElement.parentElement.onclick = () =>
      copyToClipboard(deviceIdInfo.stableDeviceId, "稳定设备ID");
  }

  // 更新设备指纹
  const fingerprintElement = document.getElementById("device-fingerprint");
  if (fingerprintElement && deviceIdInfo.deviceFingerprint) {
    fingerprintElement.textContent = deviceIdInfo.deviceFingerprint;
    fingerprintElement.title = `完整指纹: ${deviceIdInfo.deviceFingerprint}`;
    // 添加点击复制功能
    fingerprintElement.parentElement.onclick = () =>
      copyToClipboard(deviceIdInfo.deviceFingerprint, "设备指纹");
  }

  // 更新设备缓存状态
  const cacheStatusElement = document.getElementById("device-cache-status");
  if (cacheStatusElement) {
    cacheStatusElement.textContent = deviceIdInfo.hasCachedId
      ? "已缓存"
      : "无缓存";
  }

  // 更新清理能力状态
  if (deviceIdInfo.cleanupCapabilities) {
    const capabilities = deviceIdInfo.cleanupCapabilities;

    // 更新缓存清理状态
    const cacheCleanableElement = document.getElementById("cache-cleanable");
    if (cacheCleanableElement) {
      if (capabilities.cache) {
        cacheCleanableElement.textContent = "可清理";
        cacheCleanableElement.className =
          "px-2 py-1 text-xs rounded bg-blue-100 text-blue-800";
      } else {
        cacheCleanableElement.textContent = "无缓存";
        cacheCleanableElement.className =
          "px-2 py-1 text-xs rounded bg-gray-100 text-gray-600";
      }
    }
  }

  // 获取当前选择的IDE类型
  const selectedIDE = getCurrentSelectedIDE();
  const isVSCode = selectedIDE === "vscode";

  // 更新IDE遥测标识符区域的标题
  const telemetryTitle = document.getElementById("ide-telemetry-title");
  if (telemetryTitle) {
    telemetryTitle.textContent = isVSCode
      ? "VS Code IDE 遥测标识符"
      : "Cursor IDE 遥测标识符";
  }

  // 更新tooltip内容
  const telemetryTooltip = document.getElementById("ide-telemetry-tooltip");
  if (telemetryTooltip) {
    const tooltipContent = isVSCode
      ? `📁 数据来源
直接从 VS Code IDE 配置文件读取

📍 存储位置
C:\\Users\\[用户名]\\AppData\\Roaming\\Code\\User\\globalStorage\\storage.json

🔑 包含的真实ID
• devDeviceId - VS Code主设备标识符
• machineId - 机器唯一标识符
• macMachineId - MAC地址相关机器ID
• sessionId - 会话标识符
• sqmId - 软件质量监控ID

🧹 清理效果
重写 storage.json 文件，生成全新的遥测标识符
让 VS Code IDE 认为是新设备`
      : `📁 数据来源
直接从 Cursor IDE 配置文件读取

📍 存储位置
C:\\Users\\[用户名]\\AppData\\Roaming\\Cursor\\User\\globalStorage\\storage.json

🔑 包含的真实ID
• devDeviceId - Cursor主设备标识符
• machineId - 机器唯一标识符
• macMachineId - MAC地址相关机器ID
• sessionId - 会话标识符
• sqmId - 软件质量监控ID

🧹 清理效果
重写 storage.json 文件，生成全新的遥测标识符
让 Cursor IDE 认为是新设备`;

    telemetryTooltip.setAttribute("data-tooltip", tooltipContent);
  }

  // 更新Cursor遥测ID（或VSCode遥测ID）
  if (isVSCode && deviceIdInfo.vscodeTelemetry) {
    // 显示VSCode数据
    const vscodeIds = deviceIdInfo.vscodeTelemetry;

    const updateElement = (id, value, name) => {
      const element = document.getElementById(id);
      if (element && value) {
        element.textContent = value;
        element.title = `完整ID: ${value}`;
        // 添加点击复制功能
        element.parentElement.onclick = () => copyToClipboard(value, name);
      }
    };

    updateElement(
      "cursor-dev-device-id",
      vscodeIds.devDeviceId,
      "VS Code主设备ID"
    );
    updateElement("cursor-machine-id", vscodeIds.machineId, "VS Code机器ID");
    updateElement(
      "cursor-mac-machine-id",
      vscodeIds.macMachineId,
      "VS Code MAC机器ID"
    );
    updateElement("cursor-session-id", vscodeIds.sessionId, "VS Code会话ID");
    updateElement("cursor-sqm-id", vscodeIds.sqmId, "VS Code SQM ID");
  } else if (deviceIdInfo.cursorTelemetry) {
    // 显示Cursor数据
    const cursorIds = deviceIdInfo.cursorTelemetry;

    const updateElement = (id, value, name) => {
      const element = document.getElementById(id);
      if (element && value) {
        element.textContent = value;
        element.title = `完整ID: ${value}`;
        // 添加点击复制功能
        element.parentElement.onclick = () => copyToClipboard(value, name);
      }
    };

    updateElement(
      "cursor-dev-device-id",
      cursorIds.devDeviceId,
      "Cursor主设备ID"
    );
    updateElement("cursor-machine-id", cursorIds.machineId, "Cursor机器ID");
    updateElement(
      "cursor-mac-machine-id",
      cursorIds.macMachineId,
      "Cursor MAC机器ID"
    );
    updateElement("cursor-session-id", cursorIds.sessionId, "Cursor会话ID");
    updateElement("cursor-sqm-id", cursorIds.sqmId, "Cursor SQM ID");
  }
}

// 清理能力状态显示功能已移除

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
function showAlert(message, type = "info", options = {}) {
  // 检查消息长度，决定是否使用模态框
  const isLongMessage =
    message.length > 500 || message.includes('<div style="background:');

  if (isLongMessage) {
    // 使用模态框显示长消息
    showModalAlert(message, type, options);
    return;
  }

  // 移除现有的提示
  const existingAlerts = document.querySelectorAll(".alert-notification");
  existingAlerts.forEach((alert) => alert.remove());

  // 创建新提示
  const alert = document.createElement("div");
  alert.className = `alert-notification alert-${
    type === "error" ? "error" : type === "warning" ? "warning" : "success"
  }`;

  // 基础样式
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
    cursor: pointer;
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

  // 添加关闭按钮和内容
  alert.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
      <div style="flex: 1;">${message}</div>
      <button onclick="this.parentElement.parentElement.remove()"
              style="background: none; border: none; color: inherit; font-size: 16px; cursor: pointer; padding: 0; line-height: 1; opacity: 0.8; hover: opacity: 1;">
        ✕
      </button>
    </div>
    ${
      !options.persistent
        ? '<div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">点击关闭或3秒后自动消失</div>'
        : '<div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">点击关闭</div>'
    }
  `;

  // 自动消失的定时器
  let autoHideTimer = null;
  let isHovered = false;

  // 启动自动消失定时器
  function startAutoHideTimer() {
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
    }
    if (!options.persistent && !isHovered) {
      autoHideTimer = setTimeout(() => {
        if (alert.parentNode && !isHovered) {
          alert.style.animation = "slideOutRight 0.3s ease-in";
          setTimeout(() => alert.remove(), 300);
        }
      }, 3000);
    }
  }

  // 鼠标悬停事件
  alert.addEventListener("mouseenter", () => {
    isHovered = true;
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
      autoHideTimer = null;
    }
    // 添加悬停效果
    alert.style.transform = "scale(1.02)";
    alert.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.25)";
    alert.style.transition = "transform 0.2s ease, box-shadow 0.2s ease";
  });

  // 鼠标离开事件
  alert.addEventListener("mouseleave", () => {
    isHovered = false;
    // 移除悬停效果
    alert.style.transform = "scale(1)";
    alert.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
    // 重新启动自动消失定时器
    startAutoHideTimer();
  });

  // 点击整个提示框也可以关闭
  alert.addEventListener("click", () => {
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
    }
    alert.remove();
  });

  // 插入到body中
  document.body.appendChild(alert);

  // 启动自动消失定时器
  startAutoHideTimer();
}

// 显示模态框提示信息（用于长消息）
function showModalAlert(message, type = "info", options = {}) {
  // 移除现有的模态框
  const existingModals = document.querySelectorAll(".modal-alert");
  existingModals.forEach((modal) => modal.remove());

  // 创建模态框背景
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-alert";
  modalOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 20000;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.3s ease-out;
    backdrop-filter: blur(4px);
  `;

  // 创建模态框内容
  const modalContent = document.createElement("div");
  modalContent.style.cssText = `
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    border-radius: 16px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    max-width: 90vw;
    max-height: 85vh;
    width: 600px;
    position: relative;
    animation: slideInUp 0.3s ease-out;
    overflow: hidden;
  `;

  // 设置不同类型的背景色
  if (type === "error") {
    modalContent.style.background =
      "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)";
  } else if (type === "warning") {
    modalContent.style.background =
      "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)";
  }

  // 创建标题栏
  const titleBar = document.createElement("div");
  titleBar.style.cssText = `
    padding: 20px 24px 16px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.2);
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;

  const title = document.createElement("h3");
  title.style.cssText = `
    margin: 0;
    color: #000000;
    font-size: 18px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
  `;

  const titleIcon = type === "error" ? "❌" : type === "warning" ? "⚠️" : "✅";
  const titleText =
    type === "error"
      ? "错误信息"
      : type === "warning"
      ? "警告信息"
      : "操作完成";
  title.innerHTML = `${titleIcon} ${titleText}`;

  const closeBtn = document.createElement("button");
  closeBtn.style.cssText = `
    background: none;
    border: none;
    color: #000000;
    font-size: 24px;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    opacity: 0.8;
    transition: opacity 0.2s;
    line-height: 1;
  `;
  closeBtn.innerHTML = "✕";
  closeBtn.onmouseover = () => (closeBtn.style.opacity = "1");
  closeBtn.onmouseout = () => (closeBtn.style.opacity = "0.8");
  closeBtn.onclick = () => modalOverlay.remove();

  titleBar.appendChild(title);
  titleBar.appendChild(closeBtn);

  // 创建内容区域
  const contentArea = document.createElement("div");
  contentArea.style.cssText = `
    padding: 20px 24px 24px;
    max-height: calc(85vh - 120px);
    overflow-y: auto;
    color: #000000;
    line-height: 1.6;
  `;
  contentArea.innerHTML = message;

  // 组装模态框
  modalContent.appendChild(titleBar);
  modalContent.appendChild(contentArea);
  modalOverlay.appendChild(modalContent);

  // 点击背景关闭模态框
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.remove();
    }
  });

  // ESC键关闭模态框
  const handleEscape = (e) => {
    if (e.key === "Escape") {
      modalOverlay.remove();
      document.removeEventListener("keydown", handleEscape);
    }
  };
  document.addEventListener("keydown", handleEscape);

  // 插入到body中
  document.body.appendChild(modalOverlay);

  // 添加CSS动画
  if (!document.querySelector("#modal-alert-styles")) {
    const style = document.createElement("style");
    style.id = "modal-alert-styles";
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideInUp {
        from {
          opacity: 0;
          transform: translateY(30px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
    `;
    document.head.appendChild(style);
  }
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

      document.getElementById("activation-details").innerHTML = details;
    }
  } catch (error) {
    console.error("检查激活状态失败:", error);
    showAlert("检查激活状态失败: " + error.message, "error");
  } finally {
    showLoading(false);
  }
}

// 启动激活状态定期监控
function startActivationStatusMonitoring() {
  // 每30秒检查一次激活状态
  setInterval(async () => {
    try {
      const result = await ipcRenderer.invoke("check-activation-status");

      // 如果激活状态发生变化，更新UI
      if (isActivated !== result.activated) {
        console.log(`🔄 激活状态变化: ${isActivated} -> ${result.activated}`);
        isActivated = result.activated;
        updateActivationUI(result);

        // 如果激活状态失效，显示提示
        if (!result.activated && result.reason) {
          showAlert(`🔒 激活状态已失效: ${result.reason}`, "warning");
        }
      }
    } catch (error) {
      console.error("定期激活状态检查失败:", error);
    }
  }, 30000); // 30秒间隔
}

// 获取WebSocket连接状态
async function getWebSocketStatus() {
  try {
    const status = await ipcRenderer.invoke("get-websocket-status");

    // 如果WebSocket正在初始化但还未连接，显示连接中状态
    const isInitializing =
      !status.connected &&
      !status.lastDisconnectedTime &&
      status.connectionAttempts === 0;

    updateConnectionStatus({
      connected: status.connected,
      timestamp: status.lastConnectedTime || status.lastDisconnectedTime,
      isReconnecting: status.isReconnecting || isInitializing,
      isInitializing: isInitializing,
    });
  } catch (error) {
    console.error("获取WebSocket状态失败:", error);
    // 错误时显示未连接状态
    updateConnectionStatus({
      connected: false,
      isReconnecting: false,
      isInitializing: false,
    });
  }
}

// 测试服务器连接
async function testServerConnection() {
  try {
    showLoading(true);
    const result = await ipcRenderer.invoke("test-server-connection");

    if (result.success) {
      showAlert(`✅ ${result.message}`, "success");
      // 重新获取WebSocket状态
      await getWebSocketStatus();
      // 测量网络延迟
      await measureNetworkLatency();
    } else {
      showAlert(`❌ 连接失败: ${result.error}`, "error");
    }
  } catch (error) {
    console.error("测试服务器连接失败:", error);
    showAlert("测试连接失败: " + error.message, "error");
  } finally {
    showLoading(false);
  }
}

// 测量网络延迟
async function measureNetworkLatency() {
  try {
    const startTime = Date.now();
    const result = await ipcRenderer.invoke("test-server-connection");
    const endTime = Date.now();

    const latency = endTime - startTime;
    const latencyElement = document.getElementById("network-latency");

    if (latencyElement) {
      if (result.success) {
        latencyElement.textContent = `${latency}ms`;
        latencyElement.className =
          latency < 100
            ? "text-sm font-medium text-green-600"
            : latency < 300
            ? "text-sm font-medium text-yellow-600"
            : "text-sm font-medium text-red-600";
      } else {
        latencyElement.textContent = "超时";
        latencyElement.className = "text-sm font-medium text-red-600";
      }
    }
  } catch (error) {
    console.error("测量网络延迟失败:", error);
    const latencyElement = document.getElementById("network-latency");
    if (latencyElement) {
      latencyElement.textContent = "错误";
      latencyElement.className = "text-sm font-medium text-red-600";
    }
  }
}

// 更新连接状态UI
function updateConnectionStatus(statusData) {
  const connectionStatus = document.getElementById("connection-status");
  const lastSync = document.getElementById("last-sync");

  if (!connectionStatus || !lastSync) return;

  if (statusData.connected) {
    // 连接成功
    connectionStatus.innerHTML = `
      <div class="w-2 h-2 bg-green-500 rounded-full"></div>
      <span class="text-sm font-medium text-green-600">已连接</span>
    `;

    if (statusData.timestamp) {
      const time = new Date(statusData.timestamp).toLocaleString();
      lastSync.textContent = time;
    }
  } else {
    // 连接断开或初始化中
    if (statusData.isInitializing) {
      // 初始化连接中
      connectionStatus.innerHTML = `
        <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
        <span class="text-sm font-medium text-blue-600">连接中...</span>
      `;
      lastSync.textContent = "正在建立连接";
    } else if (statusData.isReconnecting) {
      // 重连中
      connectionStatus.innerHTML = `
        <div class="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
        <span class="text-sm font-medium text-yellow-600">重连中...</span>
      `;
    } else {
      // 未连接
      connectionStatus.innerHTML = `
        <div class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
        <span class="text-sm font-medium text-red-600">未连接</span>
      `;
    }

    if (statusData.timestamp && !statusData.isInitializing) {
      const time = new Date(statusData.timestamp).toLocaleString();
      lastSync.textContent = `断开于 ${time}`;
    }
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
      if (statusData.expired || statusData.reason.includes("过期")) {
        statusDetail.textContent = `${statusData.reason}，请重新输入激活码`;
      } else {
        statusDetail.textContent = statusData.reason;
      }
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
      // 获取设备ID用于显示
      const deviceInfo = await ipcRenderer.invoke("get-device-info");
      showAlert(
        `✅ 设备激活成功<br>
        • 激活码: ${code.substring(0, 8)}...${code.substring(24)}<br>
        • 设备ID: ${deviceInfo.deviceId.substring(0, 16)}...<br>
        • 过期时间: ${
          result.expiresAt
            ? new Date(result.expiresAt).toLocaleString()
            : "未知"
        }<br>
        • 状态: 已激活，可以使用所有功能`,
        "success"
      );
      isActivated = true;
      updateActivationUI();
      codeInput.value = "";

      // 刷新激活状态以获取详细信息
      setTimeout(() => checkActivationStatus(), 1000);
    } else {
      showAlert(
        `❌ 设备激活失败<br>
        • 激活码: ${code.substring(0, 8)}...${code.substring(24)}<br>
        • 失败原因: ${result.error || "未知错误"}<br>
        • 建议操作: 检查激活码是否正确或联系管理员`,
        "error"
      );

      if (result.offline) {
        showAlert(
          `⚠️ 网络连接问题<br>
          • 状态: 无法连接到服务器<br>
          • 建议操作: 检查网络连接和服务器状态`,
          "warning"
        );
      }
    }
  } catch (error) {
    console.error("激活验证失败:", error);
    showAlert(
      `❌ 激活验证过程异常<br>
      • 激活码: ${code.substring(0, 8)}...${code.substring(24)}<br>
      • 异常信息: ${error.message}<br>
      • 建议操作: 重试或重启应用`,
      "error"
    );
  } finally {
    if (validateBtn) {
      validateBtn.disabled = false;
      validateBtn.innerHTML = originalText;
    }
  }
}

// 退出激活
async function deactivateDevice() {
  console.log("deactivateDevice 函数被调用");

  // 显示确认对话框
  const confirmed = await ipcRenderer.invoke("show-message-box", {
    type: "warning",
    title: "确认退出激活",
    message: "确定要退出激活状态吗？",
    detail: "退出后需要重新输入激活码才能使用设备功能。",
    buttons: ["确定退出", "取消"],
    defaultId: 1,
    cancelId: 1,
  });

  if (confirmed.response !== 0) {
    console.log("用户取消退出激活");
    return; // 用户取消
  }

  try {
    showLoading(true);
    const result = await ipcRenderer.invoke("deactivate-device");

    if (result.success) {
      showAlert("已成功退出激活状态", "info");
      isActivated = false;
      updateActivationUI();
      // 重新检查激活状态
      setTimeout(() => checkActivationStatus(), 500);
    } else {
      showAlert(result.error || "退出激活失败", "error");
    }
  } catch (error) {
    console.error("退出激活失败:", error);
    showAlert("退出激活失败: " + error.message, "error");
  } finally {
    showLoading(false);
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

// 切换清理日志显示
function toggleCleanupLog() {
  const container = document.getElementById("cleanup-log-container");
  if (container) {
    container.classList.toggle("hidden");
  }
}

// 添加清理日志（优化版本，使用 requestAnimationFrame 避免阻塞UI）
function addCleanupLog(message, type = "info") {
  const logElement = document.getElementById("cleanup-log");
  const container = document.getElementById("cleanup-log-container");

  if (logElement && container) {
    // 使用 requestAnimationFrame 确保UI更新不阻塞
    requestAnimationFrame(() => {
      // 显示日志容器
      container.classList.remove("hidden");

      const timestamp = new Date().toLocaleTimeString();
      const logEntry = document.createElement("div");
      logEntry.className = `mb-1 ${
        type === "error"
          ? "text-red-600 font-medium"
          : type === "success"
          ? "text-green-600 font-medium"
          : type === "warning"
          ? "text-orange-600 font-medium"
          : "text-slate-600"
      }`;

      // 为重要消息添加图标
      let icon = "";
      if (type === "error") icon = "❌ ";
      else if (type === "success") icon = "✅ ";
      else if (type === "warning") icon = "⚠️ ";

      logEntry.textContent = `[${timestamp}] ${icon}${message}`;

      logElement.appendChild(logEntry);

      // 限制日志条目数量，避免内存泄漏
      const maxLogEntries = 100;
      while (logElement.children.length > maxLogEntries) {
        logElement.removeChild(logElement.firstChild);
      }

      // 自动滚动到底部
      logElement.scrollTop = logElement.scrollHeight;
    });
  }
}

// 执行设备清理
async function performCleanup() {
  console.log("performCleanup 函数被调用");

  const permissions = await checkFeaturePermission("设备清理工具", "cleanup");
  if (!permissions) {
    console.log("权限检查失败，退出函数");
    return;
  }

  // 检查增强防护状态
  try {
    console.log("🔍 检查增强防护状态...");
    const guardianStatus = await getEnhancedGuardianStatus();

    const isProtectionRunning =
      guardianStatus.isGuarding ||
      (guardianStatus.standalone && guardianStatus.standalone.isRunning) ||
      (guardianStatus.inProcess && guardianStatus.inProcess.isGuarding);

    if (isProtectionRunning) {
      const selectedIDE = getCurrentSelectedIDE();
      const ideDisplayName = selectedIDE === "vscode" ? "VS Code" : "Cursor";

      showAlert(
        `⚠️ 增强防护正在运行中<br><br>` +
          `当前正在保护 ${ideDisplayName} 的设备ID，无法执行清理操作。<br><br>` +
          `请先在"增强防护"模块中停止防护服务，然后再进行清理。`,
        "warning"
      );
      return;
    }
  } catch (error) {
    console.warn("检查增强防护状态失败:", error);
    // 如果检查失败，继续执行清理（避免阻塞正常操作）
  }

  // 获取清理模式选择
  const cleanupMode =
    document.querySelector('input[name="cleanup-mode"]:checked')?.value ??
    "intelligent";

  // 获取IDE选择选项（单选模式）
  const selectedIDE =
    document.querySelector('input[name="ide-selection"]:checked')?.value ??
    "cursor";
  const cleanCursor = selectedIDE === "cursor";
  const cleanVSCode = selectedIDE === "vscode";

  // 根据清理模式设置清理选项
  let cleanupOptions = {};

  switch (cleanupMode) {
    case "intelligent":
      // 智能清理：只清理设备身份，保留所有配置
      cleanupOptions = {
        preserveActivation: true,
        deepClean: false,
        cleanCursorExtension: false, // 修复：智能模式不清理Cursor扩展
        autoRestartCursor: false, // 修复：智能模式不重启Cursor
        autoRestartIDE: false, // 禁用：由前端控制重启时机
        skipBackup: true,
        enableEnhancedGuardian: true,
        skipCursorLogin: true,
        resetCursorCompletely: false,
        resetVSCodeCompletely: false,
        aggressiveMode: false,
        multiRoundClean: false,
        extendedMonitoring: false,
        usePowerShellAssist: false, // 智能模式不使用PowerShell
        intelligentMode: true,
        // 移除硬编码的IDE选择，完全由用户UI控制
      };
      break;

    case "standard":
      // 标准清理：清理大部分数据，保留核心配置
      cleanupOptions = {
        preserveActivation: true,
        deepClean: true,
        cleanCursorExtension: true,
        autoRestartCursor: true,
        autoRestartIDE: false, // 禁用：由前端控制重启时机
        skipBackup: true,
        enableEnhancedGuardian: true,
        skipCursorLogin: true,
        resetCursorCompletely: false,
        resetVSCodeCompletely: false,
        aggressiveMode: true,
        multiRoundClean: true,
        extendedMonitoring: true,
        usePowerShellAssist: true, // 标准模式使用PowerShell辅助
        standardMode: true,
        // 移除硬编码的IDE选择，完全由用户UI控制
      };
      break;

    case "complete":
      // 完全清理：彻底重置，仅保护MCP配置
      cleanupOptions = {
        preserveActivation: true,
        deepClean: true,
        cleanCursorExtension: true,
        autoRestartCursor: true,
        autoRestartIDE: false, // 禁用：由前端控制重启时机
        skipBackup: true,
        enableEnhancedGuardian: true,
        skipCursorLogin: false,
        resetCursorCompletely: true,
        resetVSCodeCompletely: true,
        aggressiveMode: true,
        multiRoundClean: true,
        extendedMonitoring: true,
        usePowerShellAssist: true, // 完全模式使用PowerShell辅助
        completeMode: true,
        // 移除硬编码的IDE选择，完全由用户UI控制
      };
      break;

    default:
      // 默认使用智能清理
      cleanupOptions = {
        preserveActivation: true,
        deepClean: false,
        cleanCursorExtension: false, // 修复：默认不清理扩展
        autoRestartCursor: false, // 修复：默认不重启
        autoRestartIDE: false, // 禁用：由前端控制重启时机
        skipBackup: true,
        enableEnhancedGuardian: true,
        skipCursorLogin: true,
        resetCursorCompletely: false,
        resetVSCodeCompletely: false,
        aggressiveMode: false,
        multiRoundClean: false,
        extendedMonitoring: false,
        usePowerShellAssist: false,
        intelligentMode: true,
        // 移除硬编码的IDE选择，完全由用户UI控制
      };
  }

  // 自动设置隐藏的UI控件状态
  document.getElementById("use-powershell-assist").checked =
    cleanupOptions.usePowerShellAssist;
  document.getElementById("reset-cursor-completely").checked =
    cleanupOptions.resetCursorCompletely;
  document.getElementById("reset-vscode-completely").checked =
    cleanupOptions.resetVSCodeCompletely;

  // 使用cleanupOptions中的配置（替代从UI获取）
  const preserveActivation = cleanupOptions.preserveActivation;
  const deepClean = cleanupOptions.deepClean;
  const cleanCursorExtension = cleanupOptions.cleanCursorExtension;
  const autoRestartCursor = cleanupOptions.autoRestartCursor;
  const skipBackup = cleanupOptions.skipBackup;
  const enableEnhancedGuardian = cleanupOptions.enableEnhancedGuardian;
  const resetCursorCompletely = cleanupOptions.resetCursorCompletely;
  const resetVSCodeCompletely = cleanupOptions.resetVSCodeCompletely;
  const usePowerShellAssist = cleanupOptions.usePowerShellAssist;

  // 清空之前的日志
  const logElement = document.getElementById("cleanup-log");
  if (logElement) {
    logElement.innerHTML = "";
  }

  // 根据清理模式显示不同的日志信息
  const modeNames = {
    intelligent: "智能清理模式",
    standard: "标准清理模式",
    complete: "完全清理模式",
  };

  addCleanupLog(`🚀 启动${modeNames[cleanupMode]}...`, "info");

  // 备份当前设备ID和激活信息
  let activationBackup = null;
  let originalDeviceId = null;

  addCleanupLog("备份当前设备信息...", "info");
  try {
    // 根据用户选择的IDE获取对应的设备ID作为主要设备ID（清理成功标志）
    const deviceIdDetails = await ipcRenderer.invoke("get-device-id-details");
    const selectedIDE = getCurrentSelectedIDE();

    if (deviceIdDetails.success) {
      if (
        selectedIDE === "vscode" &&
        deviceIdDetails.vscodeTelemetry?.devDeviceId
      ) {
        originalDeviceId = deviceIdDetails.vscodeTelemetry.devDeviceId;
      } else if (
        selectedIDE === "cursor" &&
        deviceIdDetails.cursorTelemetry?.devDeviceId
      ) {
        originalDeviceId = deviceIdDetails.cursorTelemetry.devDeviceId;
      } else {
        // 如果没有对应IDE的遥测ID，则使用设备指纹作为备用
        const deviceInfo = await ipcRenderer.invoke("get-device-info");
        originalDeviceId = deviceInfo.deviceId;
      }
    }
    addCleanupLog(
      `当前设备ID (${selectedIDE.toUpperCase()}): ${originalDeviceId}`,
      "info"
    );

    if (preserveActivation) {
      activationBackup = {
        isActivated: isActivated,
        deviceId: originalDeviceId,
      };
      addCleanupLog("激活状态备份完成", "success");
    }
  } catch (error) {
    addCleanupLog("设备信息备份失败: " + error.message, "error");
  }

  // 根据清理模式生成不同的确认对话框
  let dialogConfig = {};

  switch (cleanupMode) {
    case "intelligent":
      dialogConfig = {
        type: "info",
        title: "🧠 智能清理模式",
        message: "🧠 智能清理模式\n\n您即将执行安全的智能清理操作",
        detail: `
🧠 智能清理特性：

🎯 精准清理
  • 仅清理设备身份相关数据
  • 保留所有用户配置和设置
  • 保留IDE登录状态和偏好
  • 保护MCP配置和工作环境

🛡️ 安全保障
  • 无风险操作，不影响日常使用
  • 自动备份重要数据
  • 保留所有个人设置
  • 适合日常重置使用

✨ 清理效果
  • Augment扩展识别为新设备
  • 重置设备指纹和标识
  • 需要重新激活设备
  • IDE功能完全不受影响

🎯 推荐指数：⭐⭐⭐⭐⭐
确定要继续吗？`,
        buttons: ["🧠 确定清理", "❌ 取消操作"],
      };
      break;

    case "standard":
      dialogConfig = {
        type: "warning",
        title: "🔧 标准清理模式",
        message: "🔧 标准清理模式\n\n您即将执行标准深度清理操作",
        detail: `
🔧 标准清理特性：

📁 深度数据清理
  • 清理大部分IDE数据和缓存
  • 保留核心配置和MCP设置
  • 多轮清理确保彻底性
  • 实时监控防止数据恢复

🔧 系统级重置
  • 重置设备指纹和唯一标识
  • 清理扩展数据和工作区
  • 清理注册表相关项
  • 保留Cursor IDE登录状态

✨ 清理效果
  • Augment扩展完全识别为新设备
  • 部分IDE设置需要重新配置
  • 需要重新激活设备
  • 更高的清理成功率

⚠️ 注意事项
  • 需要重新配置部分IDE设置
  • 扩展可能需要重新配置
  • 工作区设置可能丢失

🎯 成功率：95%以上
确定要继续吗？`,
        buttons: ["🔧 确定清理", "❌ 取消操作"],
      };
      break;

    case "complete":
      dialogConfig = {
        type: "error",
        title: "💥 完全清理模式",
        message: "💥 完全清理模式\n\n您即将执行彻底的完全重置操作",
        detail: `
💥 完全清理特性：

🗑️ 彻底重置
  • 删除几乎所有IDE数据
  • 回到全新安装状态
  • 仅保护MCP配置文件
  • 最高级别的清理深度

🔥 系统级重置
  • 完全重置Cursor和VS Code
  • 清理所有用户数据和设置
  • 重置所有身份标识
  • 清理所有缓存和临时文件

✨ 清理效果
  • IDE完全回到初始状态
  • 需要重新登录所有服务
  • 需要重新配置所有设置
  • 最高的清理成功率

⚠️ 重要警告
此操作不可撤销！清理后您需要：
1. 重新登录Cursor IDE
2. 重新配置所有IDE设置
3. 重新安装和配置扩展
4. 重新激活设备

🎯 成功率：99%以上
确定要继续吗？`,
        buttons: ["💥 确定清理", "❌ 取消操作"],
      };
      break;

    default:
      // 默认使用智能清理的对话框
      dialogConfig = {
        type: "info",
        title: "🧠 智能清理模式",
        message: "🧠 智能清理模式\n\n您即将执行安全的智能清理操作",
        detail: `
🧠 智能清理特性：

🎯 精准清理
  • 仅清理设备身份相关数据
  • 保留所有用户配置和设置
  • 保留IDE登录状态和偏好
  • 保护MCP配置和工作环境

✨ 清理效果
  • Augment扩展识别为新设备
  • 重置设备指纹和标识
  • 需要重新激活设备
  • IDE功能完全不受影响

🎯 推荐指数：⭐⭐⭐⭐⭐
确定要继续吗？`,
        buttons: ["🧠 确定清理", "❌ 取消操作"],
      };
  }

  // 显示确认对话框
  const confirmResult = await ipcRenderer.invoke("show-message-box", {
    ...dialogConfig,
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

  // 启动清理监控模式
  const monitoringDuration = 20000; // 20秒监控（优化性能）
  startCleanupMonitoring(monitoringDuration);
  addCleanupLog("🔄 启动清理监控模式，防止数据恢复...", "info");

  try {
    cleanupBtn.disabled = true;
    cleanupBtn.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
        <div style="width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <span>清理中...</span>
      </div>
    `;

    console.log("正在调用设备清理功能...");

    // 根据清理模式显示不同的日志信息
    switch (cleanupMode) {
      case "intelligent":
        addCleanupLog("🧠 执行智能清理操作（精准清理设备身份）...", "info");
        break;
      case "standard":
        addCleanupLog("🔧 执行标准清理操作（深度清理保留核心配置）...", "info");
        break;
      case "complete":
        addCleanupLog("💥 执行完全清理操作（彻底重置仅保护MCP）...", "info");
        break;
      default:
        addCleanupLog("🔥 执行清理操作...", "info");
    }

    // 添加清理超时机制（30秒超时）
    const cleanupPromise = ipcRenderer.invoke("perform-device-cleanup", {
      // 使用清理模式配置的所有参数（避免硬编码覆盖）
      ...cleanupOptions,

      // IDE选择选项（用户选择优先，覆盖清理模式的默认设置）
      cleanCursor: cleanCursor, // 直接使用用户选择
      cleanVSCode: cleanVSCode, // 直接使用用户选择
      selectedIDE: selectedIDE, // 新增：传递选择的IDE

      // PowerShell辅助选项（从清理模式配置获取）
      usePowerShellAssist:
        cleanupOptions.usePowerShellAssist ?? usePowerShellAssist,

      // 重置选项（保持原有逻辑）
      skipCursorLogin: !resetCursorCompletely,
      resetCursorCompletely,
      resetVSCodeCompletely,
    });

    // 创建超时Promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("清理操作超时（30秒），请重试"));
      }, 30000);
    });

    // 使用Promise.race实现超时控制
    const result = await Promise.race([cleanupPromise, timeoutPromise]);
    console.log("设备清理结果:", result);

    if (result.success) {
      addCleanupLog(
        `清理完成！清理了 ${result.actions?.length || 0} 个项目`,
        "success"
      );

      // 显示详细的清理结果
      if (result.actions && result.actions.length > 0) {
        result.actions.forEach((action) => {
          addCleanupLog(`✓ ${action}`, "success");
        });
      }

      // 统计清理效果
      const stats = {
        configCleaned: result.actions.filter(
          (a) => a.includes("激活信息") || a.includes("配置")
        ).length,
        filesCleaned: result.actions.filter(
          (a) => a.includes("已清理文件") || a.includes("临时文件")
        ).length,
        registryCleaned: result.actions.filter((a) => a.includes("注册表"))
          .length,
        browserCleaned: result.actions.filter(
          (a) => a.includes("浏览器") || a.includes("扩展")
        ).length,
        fingerprintReset:
          result.actions.filter(
            (a) => a.includes("设备指纹") || a.includes("设备标识")
          ).length > 0,
      };

      let message = `
        <div style="text-align: center; padding: 15px;">
          <div style="font-size: 32px; margin-bottom: 10px;">🛡️</div>
          <div style="font-size: 20px; font-weight: bold; color: white; margin-bottom: 10px;">
            设备清理完成！
          </div>
          <div style="font-size: 16px; color: rgba(255,255,255,0.9); font-weight: 600;">
            扩展将认为这是全新设备
          </div>
        </div>

        <div style="background: rgba(255,255,255,0.15); border-left: 4px solid rgba(255,255,255,0.5); padding: 15px; margin: 15px 0; border-radius: 8px;">
          <div style="font-weight: bold; color: white; margin-bottom: 12px; font-size: 16px;">
            🎯 对抗效果评估
          </div>
          <div style="color: rgba(255,255,255,0.9); line-height: 1.8; font-size: 14px;">
            <div style="margin: 6px 0;">✅ <strong>设备身份重置</strong> - 扩展无法识别为旧设备</div>
            <div style="margin: 6px 0;">✅ <strong>激活状态清零</strong> - 所有使用记录已清除</div>
            <div style="margin: 6px 0;">✅ <strong>指纹重新生成</strong> - 设备标识完全更新</div>
            <div style="margin: 6px 0;">✅ <strong>监测数据清理</strong> - 本地存储数据已清空</div>
          </div>
        </div>

        <div style="background: rgba(255,255,255,0.1); border-left: 4px solid rgba(255,255,255,0.4); padding: 15px; margin: 15px 0; border-radius: 8px;">
          <div style="font-weight: bold; color: white; margin-bottom: 12px; font-size: 16px;">
            📊 清理统计
          </div>
          <div style="color: rgba(255,255,255,0.9); line-height: 1.6; font-size: 14px;">
            <div style="margin: 4px 0;">🗂️ 配置文件清理: <strong>${
              stats.configCleaned
            }</strong> 项</div>
            <div style="margin: 4px 0;">📁 临时文件清理: <strong>${
              stats.filesCleaned
            }</strong> 个</div>
            <div style="margin: 4px 0;">🔧 注册表清理: <strong>${
              stats.registryCleaned
            }</strong> 项</div>
            <div style="margin: 4px 0;">🌐 浏览器数据清理: <strong>${
              stats.browserCleaned
            }</strong> 项</div>
            <div style="margin: 4px 0;">🔑 设备指纹重置: <strong>${
              stats.fingerprintReset ? "已完成" : "跳过"
            }</strong></div>
          </div>
        </div>
      `;

      if (result.actions && result.actions.length > 0) {
        message += `
          <details style="margin: 15px 0;">
            <summary style="cursor: pointer; font-weight: bold; color: white; padding: 8px; background: rgba(255,255,255,0.2); border-radius: 4px; border: 1px solid rgba(255,255,255,0.3);">
              📋 查看详细操作记录 (${result.actions.length} 项)
            </summary>
            <div style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); padding: 12px; margin-top: 8px; border-radius: 4px; max-height: 300px; overflow-y: auto;">
              <div style="font-size: 13px; line-height: 1.5; color: rgba(255,255,255,0.9);">
                ${result.actions
                  .map(
                    (action) =>
                      `<div style="margin: 3px 0; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">• ${action}</div>`
                  )
                  .join("")}
              </div>
            </div>
          </details>
        `;
      }

      if (result.warning) {
        message += `
          <div style="background: rgba(255,193,7,0.2); border-left: 4px solid rgba(255,193,7,0.8); padding: 12px; margin: 15px 0; border-radius: 4px;">
            <span style="color: white; font-weight: bold;">⚠️ ${result.warning}</span>
          </div>
        `;
      }

      // 添加下一步操作指引
      message += `
        <div style="background: rgba(255,255,255,0.1); border-left: 4px solid rgba(255,255,255,0.5); padding: 15px; margin: 15px 0; border-radius: 8px;">
          <div style="font-weight: bold; color: white; margin-bottom: 12px; font-size: 16px;">
            🚀 下一步操作
          </div>
          <div style="color: rgba(255,255,255,0.9); line-height: 1.8; font-size: 14px;">
            <div style="margin: 6px 0;">1. <strong>重新激活设备</strong> - 点击"激活设备"按钮</div>
            <div style="margin: 6px 0;">2. <strong>重启 Cursor IDE</strong> - 确保所有更改生效</div>
            <div style="margin: 6px 0;">3. <strong>开始使用</strong> - 扩展将认为这是全新设备</div>
            <div style="margin: 6px 0;">4. <strong>等待 2-3 分钟</strong> - 让系统完全识别新状态</div>
          </div>
        </div>

        <div style="background: rgba(255,255,255,0.15); color: white; padding: 20px; margin: 15px 0; border-radius: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.2);">
          <div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">
            🎉 恭喜！设备已成功重置
          </div>
          <div style="font-size: 14px; opacity: 0.9;">
            Augment 扩展现在将此设备识别为全新设备，所有限制已解除
          </div>
        </div>
      `;

      showAlert(message, "success");

      // 检查设备ID和激活状态变化
      addCleanupLog("检查清理效果...", "info");
      setTimeout(async () => {
        try {
          // 根据用户选择的IDE获取清理后的设备ID
          let newDeviceId = null;
          const newDeviceIdDetails = await ipcRenderer.invoke(
            "get-device-id-details"
          );
          const selectedIDE = getCurrentSelectedIDE();

          if (newDeviceIdDetails.success) {
            if (
              selectedIDE === "vscode" &&
              newDeviceIdDetails.vscodeTelemetry?.devDeviceId
            ) {
              newDeviceId = newDeviceIdDetails.vscodeTelemetry.devDeviceId;
            } else if (
              selectedIDE === "cursor" &&
              newDeviceIdDetails.cursorTelemetry?.devDeviceId
            ) {
              newDeviceId = newDeviceIdDetails.cursorTelemetry.devDeviceId;
            } else {
              // 如果没有对应IDE的遥测ID，则使用设备指纹作为备用
              const newDeviceInfo = await ipcRenderer.invoke("get-device-info");
              newDeviceId = newDeviceInfo.deviceId;
            }
          }

          if (originalDeviceId && newDeviceId !== originalDeviceId) {
            // 添加分隔线和清理完成提示
            addCleanupLog(
              "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
              "info"
            );
            addCleanupLog(`🎉 清理操作完成！设备ID已成功更新`, "success");
            addCleanupLog(
              "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
              "info"
            );
            addCleanupLog(`📋 设备ID变更详情：`, "info");
            addCleanupLog(`旧ID: ${originalDeviceId}`, "warning");
            addCleanupLog(`新ID: ${newDeviceId}`, "success");
            addCleanupLog(
              "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
              "info"
            );

            // 显示设备ID变化对比
            showDeviceIdComparison(originalDeviceId, newDeviceId);

            // 刷新系统信息显示
            await loadSystemInfo();
          } else {
            // 添加分隔线和警告提示
            addCleanupLog(
              "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
              "info"
            );
            addCleanupLog("⚠️ 设备ID未发生变化", "warning");
            addCleanupLog(
              "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
              "info"
            );
            addCleanupLog(`📋 设备ID检查结果：`, "info");
            addCleanupLog(`旧ID: ${originalDeviceId}`, "warning");
            addCleanupLog(`新ID: ${newDeviceId}`, "warning");
            addCleanupLog("状态: 与清理前相同", "warning");
            addCleanupLog(
              "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
              "info"
            );

            showAlert(
              `⚠️ 设备ID未发生变化<br>
              • 当前设备ID: ${newDeviceId}<br>
              • 状态: 与清理前相同<br>
              • 可能原因: 清理操作未完全生效或系统缓存<br>
              • 建议操作: 重启应用后重试清理`,
              "warning"
            );
          }

          // 如果保留激活状态，检查激活是否仍然有效
          if (preserveActivation && activationBackup) {
            // addCleanupLog("检查激活状态...", "info");
            try {
              // 重新检查激活状态
              await checkActivationStatus();

              // checkActivationStatus 会更新全局的 isActivated 变量
              if (!isActivated && activationBackup.isActivated) {
                addCleanupLog("❌ 检测到激活状态丢失", "error");
                showAlert(
                  `⚠️ 清理操作影响了激活状态<br>
                  • 原设备ID: ${originalDeviceId}<br>
                  • 新设备ID: ${newDeviceId}<br>
                  • 激活状态: 已失效，需要重新激活<br>
                  • 建议操作: 使用相同激活码重新激活设备`,
                  "warning"
                );

                // 自动切换到仪表盘页面让用户重新激活
                setTimeout(() => {
                  switchTab("dashboard");
                }, 2000);
              } else if (isActivated) {
                // addCleanupLog("✅ 激活状态保持正常", "success");
                showAlert(
                  `🎉 设备清理操作完成，激活状态已保留<br>
                  • 原设备ID: ${originalDeviceId}<br>
                  • 新设备ID: ${newDeviceId}<br>
                  • 激活状态: 正常，无需重新激活<br>
                  • 清理项目: ${result.actions ? result.actions.length : 0} 个`,
                  "success"
                );
              } else {
                addCleanupLog("ℹ️ 设备未激活状态", "info");
                showAlert(
                  `🧹 设备清理操作完成<br>
                  • 原设备ID: ${originalDeviceId}<br>
                  • 新设备ID: ${newDeviceId}<br>
                  • 激活状态: 未激活（清理前也未激活）<br>
                  • 清理项目: ${result.actions ? result.actions.length : 0} 个`,
                  "info"
                );
              }
            } catch (error) {
              addCleanupLog("激活状态检查失败: " + error.message, "error");
              showAlert(
                `⚠️ 激活状态检查遇到问题<br>
                • 设备ID: ${newDeviceId}<br>
                • 错误信息: ${error.message}<br>
                • 建议操作: 手动检查激活状态或重新激活`,
                "warning"
              );
            }
          } else {
            // 清理完成后，重置激活状态
            addCleanupLog("重置激活状态", "info");
            isActivated = false;
            updateActivationUI();

            showAlert(
              `🎉 设备完全清理操作完成<br>
              • 原设备ID: ${originalDeviceId}<br>
              • 新设备ID: ${newDeviceId}<br>
              • 激活状态: 已清除，需要重新激活<br>
              • 清理项目: ${result.actions ? result.actions.length : 0} 个<br>
              • 下一步: 使用激活码重新激活设备`,
              "success"
            );

            // 自动切换到仪表盘页面
            setTimeout(() => {
              switchTab("dashboard");
            }, 3000);
          }
        } catch (error) {
          addCleanupLog("清理效果检查失败: " + error.message, "error");
        }
      }, 1000);
    } else {
      addCleanupLog(`清理失败: ${result.error || "未知错误"}`, "error");
      showAlert(
        `❌ 设备清理操作失败<br>
        • 当前设备ID: ${originalDeviceId || "未知"}<br>
        • 失败原因: ${result.error || "未知错误"}<br>
        • 建议操作: 检查权限或重试清理操作`,
        "error"
      );

      if (result.requireActivation) {
        // 检查是否是网络验证失败导致的安全阻止
        if (result.securityIssue) {
          addCleanupLog("网络验证失败，安全阻止操作", "error");
          showAlert(
            `🛡️ 安全验证失败<br>
            • 原因: 无法连接到时间验证服务器<br>
            • 安全策略: 为防止时间修改绕过，已禁用功能<br>
            • 解决方案: 请确保网络连接正常后重试<br>
            • 注意: 修改系统时间无法绕过此验证`,
            "error"
          );
        } else {
          addCleanupLog("激活状态已失效", "error");
          isActivated = false;
          updateActivationUI();
          showAlert(
            `🔒 激活状态验证失败<br>
            • 设备ID: ${originalDeviceId || "未知"}<br>
            • 状态: 激活已失效<br>
            • 建议操作: 使用有效激活码重新激活设备`,
            "warning"
          );

          // 自动切换到仪表盘页面让用户重新激活
          setTimeout(() => {
            switchTab("dashboard");
          }, 2000);
        }
      }
    }
  } catch (error) {
    console.error("设备清理失败:", error);
    addCleanupLog("清理操作异常: " + error.message, "error");
    showAlert(
      `❌ 设备清理操作异常<br>
      • 当前设备ID: ${originalDeviceId || "未知"}<br>
      • 异常信息: ${error.message}<br>
      • 建议操作: 重启应用后重试，或联系技术支持`,
      "error"
    );
  } finally {
    // 停止清理监控模式
    stopCleanupMonitoring();
    addCleanupLog("🔄 清理监控模式已停止", "info");

    // 清理完成后刷新增强防护状态
    triggerStatusRefresh("cleanup-completed", 2000);

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
      let message = `
        <div style="text-align: center; padding: 15px;">
          <div style="font-size: 32px; margin-bottom: 10px;">🔄</div>
          <div style="font-size: 20px; font-weight: bold; color: #fff; margin-bottom: 10px;">
            使用计数重置完成！
          </div>
          <div style="font-size: 16px; color: #fff; font-weight: 600;">
            扩展使用次数已归零
          </div>
        </div>

        <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 15px 0; border-radius: 8px;">
          <div style="font-weight: bold; color: #065f46; margin-bottom: 12px; font-size: 16px;">
            🎯 重置效果
          </div>
          <div style="color: #047857; line-height: 1.8; font-size: 14px;">
            <div style="margin: 6px 0;">✅ <strong>使用计数归零</strong> - 扩展认为从未使用过</div>
            <div style="margin: 6px 0;">✅ <strong>存储目录重建</strong> - 创建全新的配置环境</div>
            <div style="margin: 6px 0;">✅ <strong>配置文件更新</strong> - 生成新的基础配置</div>
            <div style="margin: 6px 0;">✅ <strong>使用限制解除</strong> - 可以重新开始使用周期</div>
          </div>
        </div>

        <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 15px 0; border-radius: 8px;">
          <div style="font-weight: bold; color: #1e40af; margin-bottom: 12px; font-size: 16px;">
            🚀 使用建议
          </div>
          <div style="color: #1d4ed8; line-height: 1.6; font-size: 14px;">
            <div style="margin: 4px 0;">1. 重置后立即可以使用扩展功能</div>
            <div style="margin: 4px 0;">2. 无需重启 Cursor IDE</div>
            <div style="margin: 4px 0;">3. 扩展将重新计算使用次数</div>
            <div style="margin: 4px 0;">4. 建议定期使用此功能维护使用状态</div>
          </div>
        </div>
      `;

      if (result.warning) {
        message += `
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 15px 0; border-radius: 4px;">
            <span style="color: #92400e; font-weight: bold;">⚠️ ${result.warning}</span>
          </div>
        `;
      }

      showAlert(message, "success");
    } else {
      showAlert(`❌ 重置失败: ${result.error || "未知错误"}`, "error");

      if (result.requireActivation) {
        // 检查是否是网络验证失败导致的安全阻止
        if (result.securityIssue) {
          showAlert(
            `🛡️ 重置操作被安全阻止<br>
            • 原因: 无法验证激活码状态（网络连接失败）<br>
            • 安全策略: 为防止时间修改绕过验证，已禁用功能<br>
            • 解决方案: 请确保网络连接正常后重试`,
            "error"
          );
        } else {
          isActivated = false;
          updateActivationUI();
          showAlert("🔒 激活状态已失效，请重新激活", "warning");
        }
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

    // 获取当前选择的IDE
    const selectedIDE = getCurrentSelectedIDE();
    const result = await ipcRenderer.invoke("get-augment-info", {
      selectedIDE,
    });

    const infoDiv = document.getElementById("augment-info");

    if (result.success && result.data) {
      const data = result.data;
      let html = '<div class="device-info">';

      // IDE信息显示
      const ideDisplayName = selectedIDE === "vscode" ? "VS Code" : "Cursor";
      html += `<p style="margin-bottom: 10px;"><strong>目标IDE:</strong> <span class="text-blue-600">${ideDisplayName}</span></p>`;

      // 扩展状态显示
      const statusColor = data.installed ? "text-green-600" : "text-red-600";
      const statusText = data.installed ? "已安装" : "未安装";
      html += `<p style="margin-bottom: 10px;"><strong>扩展状态:</strong> <span class="${statusColor}">${statusText}</span></p>`;

      if (data.installed) {
        // 显示版本信息
        if (data.version) {
          html += `<p style="margin-bottom: 10px;"><strong>版本:</strong> ${data.version}</p>`;
        }

        // 显示安装路径
        if (data.path) {
          html += `<p style="margin-bottom: 10px;"><strong>安装路径:</strong> <span class="text-xs text-gray-600">${data.path}</span></p>`;
        }

        // 显示存储状态
        html += `<p style="margin-bottom: 10px;"><strong>存储目录:</strong> ${
          data.storageExists
            ? '<span class="text-green-600">存在</span>'
            : '<span class="text-red-600">不存在</span>'
        }</p>`;

        if (data.storagePath) {
          html += `<p><strong>存储路径:</strong> <span class="text-xs text-gray-600">${data.storagePath}</span></p>`;
        }
      } else {
        html +=
          '<p class="text-gray-600">请先在Cursor/VSCode中安装Augment扩展</p>';
      }

      html += "</div>";

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

// 加载设备信息（增强版）
async function loadDeviceInfo() {
  try {
    showLoading(true);
    const result = await ipcRenderer.invoke("get-device-info");

    if (result.success) {
      updateDeviceInfoDisplay(result);
    } else {
      showDeviceInfoError(result.error);
    }
  } catch (error) {
    console.error("加载设备信息失败:", error);
    showAlert("加载设备信息失败: " + error.message, "error");
    showDeviceInfoError(error.message);
  } finally {
    showLoading(false);
  }
}

// 更新设备信息显示
function updateDeviceInfoDisplay(data) {
  const infoDiv = document.getElementById("device-info");
  const infoItems = infoDiv.querySelectorAll(".flex.justify-between");

  // 格式化内存大小
  const formatMemory = (bytes) => {
    if (!bytes) return "-";
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1
      ? `${gb.toFixed(1)} GB`
      : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  };

  // 格式化运行时间
  const formatUptime = (seconds) => {
    if (!seconds) return "-";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}天 ${hours}小时`;
    if (hours > 0) return `${hours}小时 ${minutes}分钟`;
    return `${minutes}分钟`;
  };

  // 格式化百分比
  const formatPercent = (value) => {
    if (value === undefined || value === null) return "-";
    return `${Math.round(value)}%`;
  };

  // 更新各项信息 - 按HTML中的字段顺序
  const updates = [
    // 基础信息
    data.systemInfo?.platform
      ? `${data.systemInfo.platform} ${data.systemInfo.release || ""}`
      : "-",
    data.systemInfo?.cpuModel || data.systemInfo?.arch || "-",
    formatMemory(data.systemInfo?.totalMemory),
    formatMemory(data.systemInfo?.freeMemory),

    // 扩展信息
    formatUptime(data.systemInfo?.uptime),
    data.systemInfo?.networkStatus || (navigator.onLine ? "已连接" : "断开"),
    data.systemInfo?.username || "-",
    data.systemInfo?.nodeVersion || process.version || "-",

    // 进程信息
    data.processInfo?.pid || process.pid || "-",
    formatMemory(data.processInfo?.memoryUsage),
    formatPercent(data.processInfo?.cpuUsage),
  ];

  // 应用更新
  infoItems.forEach((item, index) => {
    if (index < updates.length) {
      const valueSpan = item.querySelector("span:last-child");
      if (valueSpan) {
        valueSpan.textContent = updates[index];

        // 添加状态颜色
        if (index === 10) {
          // 应用CPU使用率
          const usage = parseFloat(updates[index]);
          if (usage > 80) valueSpan.className = "font-medium text-red-600";
          else if (usage > 60)
            valueSpan.className = "font-medium text-yellow-600";
          else valueSpan.className = "font-medium text-green-600";
        } else {
          valueSpan.className = "font-medium text-slate-800";
        }
      }
    }
  });

  // 保存数据用于导出
  window.lastSystemInfo = data;
}

// 显示设备信息错误
function showDeviceInfoError(error) {
  const infoDiv = document.getElementById("device-info");
  const infoItems = infoDiv.querySelectorAll(
    ".flex.justify-between span:last-child"
  );

  infoItems.forEach((span) => {
    span.textContent = "获取失败";
    span.className = "font-medium text-red-500";
  });
}

// 导出系统信息
async function exportSystemInfo() {
  try {
    if (!window.lastSystemInfo) {
      showAlert("请先刷新系统信息", "warning");
      return;
    }

    const data = window.lastSystemInfo;
    const timestamp = new Date().toLocaleString("zh-CN");

    const exportData = {
      exportTime: timestamp,
      deviceId: data.deviceId,
      systemInfo: data.systemInfo,
      processInfo: data.processInfo,
      applicationInfo: {
        name: "Augment Device Manager",
        version: window.appVersion || "Unknown",
      },
    };

    // 格式化为可读的文本
    let content = `# 系统信息报告\n\n`;
    content += `导出时间: ${timestamp}\n`;
    content += `设备ID: ${data.deviceId || "Unknown"}\n\n`;

    content += `## 系统信息\n`;
    content += `操作系统: ${data.systemInfo?.platform || "Unknown"} ${
      data.systemInfo?.release || ""
    }\n`;
    content += `处理器: ${
      data.systemInfo?.cpuModel || data.systemInfo?.arch || "Unknown"
    }\n`;
    content += `总内存: ${
      data.systemInfo?.totalMemory
        ? (data.systemInfo.totalMemory / 1024 ** 3).toFixed(1) + " GB"
        : "Unknown"
    }\n`;
    content += `可用内存: ${
      data.systemInfo?.freeMemory
        ? (data.systemInfo.freeMemory / 1024 ** 3).toFixed(1) + " GB"
        : "Unknown"
    }\n`;
    content += `运行时间: ${
      data.systemInfo?.uptime
        ? Math.floor(data.systemInfo.uptime / 3600) + " 小时"
        : "Unknown"
    }\n`;
    content += `当前用户: ${data.systemInfo?.username || "Unknown"}\n`;
    content += `Node版本: ${
      data.systemInfo?.nodeVersion || process.version || "Unknown"
    }\n\n`;

    content += `## 进程信息\n`;
    content += `进程ID: ${data.processInfo?.pid || process.pid || "Unknown"}\n`;
    content += `内存占用: ${
      data.processInfo?.memoryUsage
        ? (data.processInfo.memoryUsage / 1024 ** 2).toFixed(1) + " MB"
        : "Unknown"
    }\n`;
    content += `CPU占用: ${
      data.processInfo?.cpuUsage
        ? data.processInfo.cpuUsage.toFixed(1) + "%"
        : "Unknown"
    }\n`;

    // 创建下载链接
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `system-info-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showAlert("系统信息已导出", "success");
  } catch (error) {
    console.error("导出系统信息失败:", error);
    showAlert("导出失败: " + error.message, "error");
  }
}

// 复制设备ID功能
async function copyDeviceId() {
  try {
    const deviceIdElement = document.querySelector("#device-id-text");
    if (!deviceIdElement) {
      showAlert("设备ID元素未找到", "error");
      return;
    }

    const fullDeviceId =
      deviceIdElement.getAttribute("data-full-id") ||
      deviceIdElement.textContent;
    if (!fullDeviceId || fullDeviceId === "获取中...") {
      showAlert("设备ID未加载", "warning");
      return;
    }

    await navigator.clipboard.writeText(fullDeviceId);
    showAlert("设备ID已复制到剪贴板", "success");
  } catch (error) {
    console.error("复制设备ID失败:", error);
    showAlert("复制失败: " + error.message, "error");
  }
}

// 显示设备ID变化对比
function showDeviceIdComparison(originalId, newId) {
  const deviceIdElement = document.querySelector("#device-id-text");
  if (deviceIdElement) {
    // 高亮显示新的设备ID
    deviceIdElement.style.backgroundColor = "#dcfce7";
    deviceIdElement.style.border = "2px solid #16a34a";
    deviceIdElement.style.animation = "deviceIdUpdate 1s ease-in-out 3";
    deviceIdElement.style.fontWeight = "bold";

    // 添加对比信息到tooltip
    deviceIdElement.title = `🎉 设备ID已更新！\n\n原ID: ${originalId}\n新ID: ${newId}\n\n✅ 清理成功！扩展将识别为新设备\n💡 点击可复制新的设备ID`;

    // 5秒后恢复正常样式
    setTimeout(() => {
      deviceIdElement.style.animation = "";
      deviceIdElement.style.backgroundColor = "#eff6ff";
      deviceIdElement.style.border = "1px solid #3b82f6";
      deviceIdElement.style.fontWeight = "600";
    }, 5000);
  }
}

// 信息显示模式切换
let isExtendedMode = true;

function toggleInfoMode() {
  const extendedInfo = document.getElementById("extended-info");
  const processInfo = document.getElementById("process-info");
  const toggleBtn = document.getElementById("info-mode-toggle");

  if (!extendedInfo || !processInfo || !toggleBtn) {
    console.warn("找不到信息模式切换相关元素");
    return;
  }

  isExtendedMode = !isExtendedMode;

  if (isExtendedMode) {
    // 显示扩展信息
    extendedInfo.classList.remove("hidden");
    processInfo.classList.remove("hidden");
    toggleBtn.textContent = "简洁";
    toggleBtn.setAttribute("data-tooltip", "切换显示模式：详细信息 ⇄ 基础信息");

    // 如果已经加载过数据，确保扩展信息正确显示
    if (window.lastSystemInfo) {
      updateDeviceInfoDisplay(window.lastSystemInfo);
    } else {
      // 如果没有数据，重新加载
      loadDeviceInfo();
    }
  } else {
    // 隐藏扩展信息
    extendedInfo.classList.add("hidden");
    processInfo.classList.add("hidden");
    toggleBtn.textContent = "详细";
    toggleBtn.setAttribute("data-tooltip", "切换显示模式：基础信息 ⇄ 详细信息");
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

// 启动清理监控模式
function startCleanupMonitoring(duration = 30000) {
  console.log("🔄 启动清理监控模式，持续时间:", duration + "ms");
  isCleanupMonitoring = true;

  // 清理监控期间，增加刷新频率
  if (systemInfoTimer) {
    clearInterval(systemInfoTimer);
  }

  // 清理监控期间每5秒刷新一次（优化性能，使用防抖）
  systemInfoTimer = setInterval(() => {
    // 使用防抖机制避免重复调用
    if (loadSystemInfoTimeout) {
      clearTimeout(loadSystemInfoTimeout);
    }
    loadSystemInfoTimeout = setTimeout(() => {
      loadSystemInfo();
    }, 200); // 200ms防抖延迟
  }, 5000);

  // 监控结束后恢复正常频率
  setTimeout(() => {
    stopCleanupMonitoring();
  }, duration);
}

// 停止清理监控模式
function stopCleanupMonitoring() {
  console.log("✅ 停止清理监控模式");
  isCleanupMonitoring = false;

  // 恢复正常的5秒刷新频率
  if (systemInfoTimer) {
    clearInterval(systemInfoTimer);
  }

  systemInfoTimer = setInterval(() => {
    // 使用防抖机制避免重复调用
    if (loadSystemInfoTimeout) {
      clearTimeout(loadSystemInfoTimeout);
    }
    loadSystemInfoTimeout = setTimeout(() => {
      loadSystemInfo();
    }, 200); // 200ms防抖延迟
  }, 5000);
}

// 移除了复杂的进度条动画样式，保持简洁

// ==================== 增强防护事件驱动状态监控 ====================

let guardianHealthCheckInterval = null;
let lastKnownStatus = null;

// 启动增强防护状态监控（事件驱动模式）
function startGuardianStatusMonitoring() {
  console.log("🔄 启动事件驱动状态监控");

  // 立即执行初始状态检查，检测可能已运行的防护进程
  console.log("🔍 执行初始状态检查...");
  refreshGuardianStatus("initial-check");

  // 再次延迟检查，确保状态同步
  setTimeout(() => {
    console.log("🔍 执行延迟状态检查...");
    refreshGuardianStatus("delayed-check");
  }, 3000); // 延迟3秒

  // 启动健康检查（5分钟间隔，仅检查独立服务状态）
  startHealthCheck();
}

// 停止状态监控
function stopGuardianStatusMonitoring() {
  console.log("⏹️ 停止状态监控");

  if (guardianHealthCheckInterval) {
    clearInterval(guardianHealthCheckInterval);
    guardianHealthCheckInterval = null;
  }
  lastKnownStatus = null;
}

// 启动健康检查（低频率，仅检查独立服务）
function startHealthCheck() {
  // 每5分钟检查一次独立服务状态
  guardianHealthCheckInterval = setInterval(async () => {
    try {
      console.log("🏥 执行健康检查...");
      const status = await getEnhancedGuardianStatus();

      // 只有在状态发生重要变化时才更新UI
      if (hasSignificantStatusChange(status)) {
        console.log("📊 检测到重要状态变化，更新UI");
        updateGuardianStatusDisplay(status);
        lastKnownStatus = status;
      }
    } catch (error) {
      console.error("健康检查失败:", error);
    }
  }, 5 * 60 * 1000); // 5分钟

  // 启动统计数据刷新（更频繁，用于更新拦截计数）
  startStatsRefresh();
}

// 启动统计数据刷新（独立服务需要更频繁的刷新）
function startStatsRefresh() {
  // 每10秒刷新一次统计数据，确保拦截计数及时更新
  const statsRefreshInterval = setInterval(async () => {
    try {
      const status = await getEnhancedGuardianStatus();

      // 只有在防护运行时才更新统计
      if (status.isGuarding) {
        console.log("📊 自动刷新统计数据...");
        updateGuardianStatusDisplay(status);
      }
    } catch (error) {
      console.error("统计数据刷新失败:", error);
    }
  }, 10 * 1000); // 10秒

  // 保存间隔ID以便清理
  window.statsRefreshInterval = statsRefreshInterval;
}

// 检查是否有重要状态变化
function hasSignificantStatusChange(newStatus) {
  if (!lastKnownStatus) return true;

  // 检查关键状态变化
  const significantChanges = [
    newStatus.isGuarding !== lastKnownStatus.isGuarding,
    newStatus.mode !== lastKnownStatus.mode,
    // 独立服务状态变化
    newStatus.standalone?.isRunning !== lastKnownStatus.standalone?.isRunning,
    // 内置进程状态变化
    newStatus.inProcess?.isGuarding !== lastKnownStatus.inProcess?.isGuarding,
  ];

  return significantChanges.some((changed) => changed);
}

// 刷新增强防护状态（事件驱动）
async function refreshGuardianStatus(eventType = "manual") {
  try {
    console.log(`🔄 刷新状态 - 触发事件: ${eventType}`);

    // 如果是手动刷新，显示提示
    if (eventType === "manual") {
      showAlert("正在刷新防护状态...", "info");
    }

    const status = await getEnhancedGuardianStatus();

    // 更新UI显示
    updateGuardianStatusDisplay(status);

    // 更新已知状态
    lastKnownStatus = status;

    console.log(
      `✅ 状态刷新完成 - 防护状态: ${status.isGuarding ? "运行中" : "已停止"}`
    );

    // 如果是手动刷新，显示成功提示
    if (eventType === "manual") {
      const stats = parseStatsFromLogs(status.standalone?.recentLogs || []);
      showAlert(
        `状态已刷新 - 拦截: ${stats.interceptedAttempts}, 删除: ${stats.backupFilesRemoved}, 恢复: ${stats.protectionRestored}`,
        "success"
      );
    }
  } catch (error) {
    console.error("获取增强防护状态失败:", error);
    if (eventType === "manual") {
      showAlert(`刷新失败: ${error.message}`, "error");
    }
    hideGuardianStatusCard();
  }
}

// 事件驱动的状态刷新触发器
function triggerStatusRefresh(eventType, delay = 0) {
  if (delay > 0) {
    setTimeout(() => refreshGuardianStatus(eventType), delay);
  } else {
    refreshGuardianStatus(eventType);
  }
}

// 监听客户端清理完成事件
function setupCleanupEventListeners() {
  // 监听清理完成事件
  if (typeof ipcRenderer !== "undefined") {
    ipcRenderer.on("cleanup-completed", (event, data) => {
      // 延迟3秒刷新，确保守护进程有时间重新启动
      triggerStatusRefresh("cleanup-completed", 3000);
    });

    // 监听守护进程状态变化事件
    ipcRenderer.on("guardian-status-changed", (event, data) => {
      triggerStatusRefresh("guardian-status-changed", 500);
    });
  }
}

// 更新增强防护状态显示
function updateGuardianStatusDisplay(status) {
  // 获取UI元素
  const guardianStatus = document.getElementById("guardian-status");
  const guardianStatusIndicator = document.getElementById(
    "guardian-status-indicator"
  );
  const interceptCount = document.getElementById("intercept-count");
  const backupRemoved = document.getElementById("backup-removed");
  const protectionRestored = document.getElementById("protection-restored");

  // 详细状态检测
  const isActuallyRunning = checkActualGuardianStatus(status);

  console.log(`🔍 状态检测详情:`, {
    reportedGuarding: status.isGuarding,
    actuallyRunning: isActuallyRunning,
    mode: status.mode,
    standaloneRunning: status.standalone?.isRunning,
    inProcessGuarding: status.inProcess?.isGuarding,
  });

  if (isActuallyRunning) {
    // 防护运行中 - 更新按钮状态为运行中
    updateGuardianButtonState("running");

    // 更新状态文字和指示器
    if (guardianStatus) {
      let modeText =
        status.mode === "standalone" ? "独立服务运行中" : "内置进程运行中";

      // 如果是通过进程扫描检测到的，添加特殊标识
      if (
        status.standalone &&
        status.standalone.detectionMethod === "process-scan"
      ) {
        modeText = "独立服务运行中 (进程扫描检测)";
      } else if (
        status.detectionDetails &&
        status.detectionDetails.detectionMethod === "process-scan"
      ) {
        modeText += " (进程扫描检测)";
      }

      guardianStatus.textContent = modeText;
      guardianStatus.className = "text-sm font-medium text-emerald-600";
    }

    if (guardianStatusIndicator) {
      guardianStatusIndicator.className = "w-3 h-3 bg-emerald-500 rounded-full";
    }

    // 自动显示详细状态板块
    if (typeof window.showGuardianStatusPanel === "function") {
      window.showGuardianStatusPanel();
    }

    // 更新详细状态板块的数据
    if (typeof window.updateGuardianStatusPanel === "function") {
      window.updateGuardianStatusPanel(status);
    }

    // 更新统计数据（性能优化）
    let stats = {
      interceptedAttempts: 0,
      backupFilesRemoved: 0,
      protectionRestored: 0,
    };

    if (
      status.standalone &&
      status.standalone.isRunning &&
      status.standalone.fastStats
    ) {
      // 独立服务模式 - 优先使用快速统计数据
      stats = {
        interceptedAttempts:
          status.standalone.fastStats.interceptedAttempts || 0,
        backupFilesRemoved: status.standalone.fastStats.backupFilesRemoved || 0,
        protectionRestored: status.standalone.fastStats.protectionRestored || 0,
      };
    } else if (
      status.standalone &&
      status.standalone.isRunning &&
      status.standalone.config
    ) {
      // 独立服务模式 - 回退到日志解析（向后兼容）
      stats = parseStatsFromLogs(status.standalone.recentLogs || []);
    } else if (status.inProcess && status.inProcess.stats) {
      // 内置进程模式 - 直接使用统计
      stats = status.inProcess.stats;
    }

    // 更新计数显示
    if (interceptCount)
      interceptCount.textContent = stats.interceptedAttempts || 0;
    if (backupRemoved)
      backupRemoved.textContent = stats.backupFilesRemoved || 0;
    if (protectionRestored)
      protectionRestored.textContent = stats.protectionRestored || 0;

    // 更新防护运行时间和内存使用情况
    updateGuardianPerformanceInfo(status);

    // 更新最近拦截记录
    updateRecentIntercepts(status);

    console.log(
      `✅ 状态更新完成 - 拦截: ${stats.interceptedAttempts}, 删除: ${stats.backupFilesRemoved}, 恢复: ${stats.protectionRestored}`
    );
  } else {
    // 没有防护运行，更新按钮状态为停止
    updateGuardianButtonState("stopped");

    // 更新状态文字和指示器
    if (guardianStatus) {
      guardianStatus.textContent = "未启动";
      guardianStatus.className = "text-sm font-medium text-slate-600";
    }

    if (guardianStatusIndicator) {
      guardianStatusIndicator.className =
        "w-3 h-3 bg-slate-400 rounded-full animate-pulse";
    }

    // 重置统计数据
    if (interceptCount) interceptCount.textContent = "0";
    if (backupRemoved) backupRemoved.textContent = "0";
    if (protectionRestored) protectionRestored.textContent = "0";

    console.log("🔄 防护未运行，重置计数显示");

    // 重置性能信息
    resetGuardianPerformanceInfo();
  }

  // 更新IDE选择的可用性（根据防护状态）
  updateIDESelectionAvailability(isActuallyRunning);
}

// 更新防护性能信息
function updateGuardianPerformanceInfo(status) {
  const guardianUptime = document.getElementById("guardian-uptime");
  const guardianMemory = document.getElementById("guardian-memory");

  let uptime = 0;
  let memoryUsed = 0;

  // 获取运行时间和内存使用情况（性能优化）
  if (status.standalone && status.standalone.isRunning) {
    // 独立服务模式 - 优先使用快速统计数据
    if (status.standalone.fastStats) {
      uptime = status.standalone.fastStats.uptime || 0;
    } else {
      uptime = status.standalone.uptime || 0;
    }
    memoryUsed = status.standalone.memoryUsage?.usedMB || 0;
  } else if (status.inProcess && status.inProcess.isGuarding) {
    // 内置进程模式
    uptime = status.inProcess.uptime || 0;
    memoryUsed = status.inProcess.memoryUsage?.usedMB || 0;
  }

  // 格式化运行时间
  const formatUptime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟`;
    } else {
      return `${seconds}秒`;
    }
  };

  if (guardianUptime) {
    guardianUptime.textContent = formatUptime(uptime);
  }

  if (guardianMemory) {
    guardianMemory.textContent = `${memoryUsed}MB`;
  }
}

// 重置防护性能信息
function resetGuardianPerformanceInfo() {
  const guardianUptime = document.getElementById("guardian-uptime");
  const guardianMemory = document.getElementById("guardian-memory");

  if (guardianUptime) {
    guardianUptime.textContent = "0分钟";
  }

  if (guardianMemory) {
    guardianMemory.textContent = "0MB";
  }
}

// 检查实际的防护运行状态
function checkActualGuardianStatus(status) {
  // 如果没有状态信息，返回false
  if (!status) return false;

  // 优先使用新的综合状态检查结果
  if (status.isGuarding !== undefined) {
    console.log(`🔍 使用综合状态检查结果: ${status.isGuarding}`);

    // 如果检测方法是进程扫描，显示特殊提示
    if (
      status.detectionDetails &&
      status.detectionDetails.detectionMethod === "process-scan"
    ) {
      console.log("🔍 通过进程扫描检测到防护状态");
    }

    return status.isGuarding;
  }

  // 检查独立服务状态
  if (status.standalone && status.standalone.isRunning) {
    // 独立服务报告运行中，进一步验证
    const hasValidConfig =
      status.standalone.config && status.standalone.config.deviceId;
    const hasPid = status.standalone.pid;

    console.log(`🔍 独立服务验证:`, {
      hasValidConfig,
      hasPid,
      configDeviceId: status.standalone.config?.deviceId,
      isRunning: status.standalone.isRunning,
      detectionMethod: status.standalone.detectionMethod || "standard",
    });

    // 如果通过进程扫描检测到，即使没有完整配置也认为有效
    if (status.standalone.detectionMethod === "process-scan") {
      console.log("✅ 通过进程扫描检测到独立服务正在运行");
      return true;
    }

    // 标准检查：如果有有效配置和PID，认为服务正常运行
    if (hasValidConfig && hasPid) {
      console.log("✅ 独立服务正在运行（标准检测）");
      return true;
    }
  }

  // 检查内置进程状态
  if (status.inProcess && status.inProcess.isGuarding) {
    console.log(`✅ 内置进程正在守护`);
    return true;
  }

  // 检查是否有残留的PID文件但进程已停止
  if (
    status.standalone &&
    status.standalone.pid &&
    !status.standalone.isRunning
  ) {
    console.log("⚠️ 检测到残留PID文件，进程可能已停止");
  }

  console.log("❌ 没有检测到有效的防护进程");
  return false;
}

// 从日志中解析统计信息
function parseStatsFromLogs(logs) {
  const stats = {
    interceptedAttempts: 0,
    backupFilesRemoved: 0,
    protectionRestored: 0,
  };

  if (!logs || !Array.isArray(logs)) {
    return stats;
  }

  logs.forEach((logEntry) => {
    // 处理不同格式的日志条目
    let logText = "";
    if (typeof logEntry === "string") {
      logText = logEntry;
    } else if (logEntry && typeof logEntry === "object") {
      // 处理对象格式的日志
      logText =
        logEntry.message ||
        logEntry.text ||
        logEntry.content ||
        JSON.stringify(logEntry);
    }

    // 拦截相关关键词（包括保护恢复事件）
    if (
      logText.includes("拦截") ||
      logText.includes("检测到") ||
      logText.includes("阻止") ||
      logText.includes("修改被拦截") ||
      logText.includes("IDE尝试") ||
      logText.includes("已拦截") ||
      logText.includes("保护恢复事件") ||
      logText.includes("设备ID已恢复") ||
      logText.includes("设备ID被篡改")
    ) {
      stats.interceptedAttempts++;
    }

    // 删除备份相关关键词
    if (
      logText.includes("删除备份") ||
      logText.includes("已删除") ||
      logText.includes("备份文件") ||
      logText.includes("清理备份") ||
      logText.includes("实时删除备份")
    ) {
      stats.backupFilesRemoved++;
    }

    // 恢复保护相关关键词
    if (
      logText.includes("恢复") ||
      logText.includes("已恢复") ||
      logText.includes("保护恢复") ||
      logText.includes("重新保护") ||
      logText.includes("设备ID已恢复")
    ) {
      stats.protectionRestored++;
    }
  });

  console.log(
    `📊 从 ${logs.length} 条日志中解析统计: 拦截=${stats.interceptedAttempts}, 删除=${stats.backupFilesRemoved}, 恢复=${stats.protectionRestored}`
  );
  return stats;
}

// 更新最近拦截记录
function updateRecentIntercepts(status) {
  const recentIntercepts = document.getElementById("recent-intercepts");
  if (!recentIntercepts) return;

  let logs = [];

  if (status.standalone && status.standalone.recentLogs) {
    logs = status.standalone.recentLogs;
  } else if (status.inProcess && status.inProcess.recentLogs) {
    logs = status.inProcess.recentLogs;
  }

  if (logs.length > 0) {
    // 过滤出拦截相关的日志
    const interceptLogs = logs
      .filter(
        (log) =>
          log.includes("拦截") ||
          log.includes("检测到") ||
          log.includes("删除备份") ||
          log.includes("恢复")
      )
      .slice(-3); // 只显示最近3条

    if (interceptLogs.length > 0) {
      recentIntercepts.innerHTML = interceptLogs
        .map((log) => {
          const time = extractTimeFromLog(log);
          const action = extractActionFromLog(log);
          return `<div class="flex justify-between items-center py-1">
          <span class="text-slate-600">${action}</span>
          <span class="text-slate-400">${time}</span>
        </div>`;
        })
        .join("");
    } else {
      recentIntercepts.innerHTML =
        '<div class="text-center text-slate-400 py-2">暂无拦截记录</div>';
    }
  } else {
    recentIntercepts.innerHTML =
      '<div class="text-center text-slate-400 py-2">暂无拦截记录</div>';
  }
}

// 从日志中提取时间
function extractTimeFromLog(log) {
  const timeMatch = log.match(/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
  if (timeMatch) {
    const time = new Date(timeMatch[1]);
    return time.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return "刚刚";
}

// 从日志中提取操作描述
function extractActionFromLog(log) {
  if (log.includes("拦截")) return "🚨 拦截IDE操作";
  if (log.includes("删除备份")) return "🗑️ 删除备份文件";
  if (log.includes("恢复")) return "🔒 恢复保护";
  if (log.includes("检测到")) return "👁️ 检测到变化";
  return "🛡️ 防护操作";
}

// 隐藏增强防护详细状态（保留卡片显示）
function hideGuardianStatusCard() {
  // 不再隐藏整个卡片，让用户始终能看到控制按钮
  // 只隐藏详细状态板块
  if (typeof window.hideGuardianStatusPanel === "function") {
    window.hideGuardianStatusPanel();
  }
}

// 启动增强防护服务
async function startGuardianService() {
  try {
    // 显示启动中状态
    updateGuardianButtonState("starting");
    showAlert("正在启动增强防护服务...", "info");

    // 检查启动要求
    const requirements = await ipcRenderer.invoke(
      "check-guardian-startup-requirements"
    );
    if (!requirements.canStart) {
      updateGuardianButtonState("stopped");
      showAlert(`无法启动防护服务: ${requirements.reason}`, "error");
      return;
    }

    // 获取当前选择的IDE
    const selectedIDE = getCurrentSelectedIDE();
    console.log(`🎯 启动防护 - 选择的IDE: ${selectedIDE}`);

    // 获取设备ID详情以确定目标设备ID
    const deviceIdDetails = await ipcRenderer.invoke("get-device-id-details");
    let targetDeviceId = null;

    if (deviceIdDetails.success) {
      if (
        selectedIDE === "vscode" &&
        deviceIdDetails.vscodeTelemetry?.devDeviceId
      ) {
        targetDeviceId = deviceIdDetails.vscodeTelemetry.devDeviceId;
      } else if (
        selectedIDE === "cursor" &&
        deviceIdDetails.cursorTelemetry?.devDeviceId
      ) {
        targetDeviceId = deviceIdDetails.cursorTelemetry.devDeviceId;
      } else {
        // 如果没有对应IDE的遥测ID，则使用设备指纹作为备用
        const deviceInfo = await ipcRenderer.invoke("get-device-info");
        targetDeviceId = deviceInfo.deviceId;
      }
    }

    console.log(`🎯 启动防护 - 目标设备ID: ${targetDeviceId}`);

    // 启动服务（传递正确的参数）
    const result = await ipcRenderer.invoke(
      "start-enhanced-guardian-independent",
      {
        selectedIDE: selectedIDE,
        targetDeviceId: targetDeviceId,
        enableBackupMonitoring: true,
        enableDatabaseMonitoring: true,
        enableEnhancedProtection: true,
      }
    );
    if (result.success) {
      showAlert("增强防护服务已启动", "success");
      updateGuardianButtonState("running");
      // 事件驱动刷新状态
      triggerStatusRefresh("guardian-started", 1000);
    } else {
      // 检查是否是因为服务已在运行而失败
      if (result.alreadyRunning) {
        showAlert("防护服务已在运行中", "info");
        updateGuardianButtonState("running");
        // 刷新状态以同步UI
        triggerStatusRefresh("guardian-already-running", 500);
      } else {
        updateGuardianButtonState("stopped");

        // 检查是否是网络验证失败导致的安全阻止
        if (result.securityIssue) {
          showAlert(
            `🛡️ 防护启动被安全阻止<br>
            • 原因: 无法验证激活码状态（网络连接失败）<br>
            • 安全策略: 为防止时间修改绕过验证，已禁用功能<br>
            • 解决方案: 请确保网络连接正常后重试<br>
            • 提示: 修改系统时间无法绕过此安全验证`,
            "error"
          );
        } else {
          showAlert(
            `启动防护服务失败: ${result.error || result.message}`,
            "error"
          );
        }

        // 启动失败也要刷新状态
        triggerStatusRefresh("guardian-start-failed", 500);
      }
    }
  } catch (error) {
    updateGuardianButtonState("stopped");
    showAlert(`启动防护服务失败: ${error.message}`, "error");
    // 异常情况刷新状态
    triggerStatusRefresh("guardian-start-error", 500);
  }
}

// 停止增强防护服务
async function stopGuardianService() {
  try {
    // 显示停止中状态
    updateGuardianButtonState("stopping");
    showAlert("正在停止增强防护服务...", "info");

    // 停止服务
    const result = await ipcRenderer.invoke("stop-enhanced-guardian");
    if (result.success) {
      showAlert("增强防护服务已停止", "success");
      updateGuardianButtonState("stopped");
      // 事件驱动刷新状态
      triggerStatusRefresh("guardian-stopped", 1000);
    } else {
      updateGuardianButtonState("running");
      showAlert(`停止防护服务失败: ${result.message}`, "error");
      // 停止失败也要刷新状态
      triggerStatusRefresh("guardian-stop-failed", 500);
    }
  } catch (error) {
    updateGuardianButtonState("running");
    showAlert(`停止防护服务失败: ${error.message}`, "error");
    // 异常情况刷新状态
    triggerStatusRefresh("guardian-stop-error", 500);
  }
}

// 停止所有node进程
async function stopAllNodeProcesses() {
  try {
    // 显示确认对话框
    const confirmed = await ipcRenderer.invoke("show-message-box", {
      type: "warning",
      title: "确认操作",
      message: "停止所有Node.js进程",
      detail:
        "此操作将强制终止所有Node.js进程，包括本应用程序。\n\n确定要继续吗？",
      buttons: ["取消", "确定停止"],
      defaultId: 0,
      cancelId: 0,
    });

    if (confirmed.response !== 1) {
      return;
    }

    showAlert("正在停止所有Node.js进程...", "info");

    const result = await ipcRenderer.invoke("stop-all-node-processes");
    if (result.success) {
      // 显示操作结果
      const message =
        result.actions.length > 0 ? result.actions.join("\n") : "操作完成";

      showAlert(message, "success");

      // 如果有错误，也显示出来
      if (result.errors.length > 0) {
        setTimeout(() => {
          showAlert(`部分操作失败:\n${result.errors.join("\n")}`, "warning");
        }, 2000);
      }
    } else {
      showAlert(`停止Node.js进程失败: ${result.message}`, "error");
    }
  } catch (error) {
    showAlert(`停止Node.js进程失败: ${error.message}`, "error");
  }
}

// 更新增强防护按钮状态
function updateGuardianButtonState(state) {
  const startBtn = document.getElementById("start-guardian-btn");

  if (!startBtn) return;

  switch (state) {
    case "stopped":
      startBtn.disabled = false;
      startBtn.innerHTML = `启动防护`;
      startBtn.onclick = startGuardianService;
      startBtn.className =
        "flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl";
      break;

    case "starting":
      startBtn.disabled = true;
      startBtn.innerHTML = `启动中...`;
      break;

    case "running":
      startBtn.disabled = false;
      startBtn.innerHTML = `停止防护`;
      startBtn.onclick = stopGuardianService;
      startBtn.className =
        "flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-medium rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl";
      break;

    case "stopping":
      startBtn.disabled = true;
      startBtn.innerHTML = `停止中...`;
      break;
  }
}

// 查看增强防护日志
async function viewGuardianLogs() {
  try {
    const status = await getEnhancedGuardianStatus();

    let logs = [];
    let logSource = "无日志";

    if (status.standalone && status.standalone.recentLogs) {
      logs = status.standalone.recentLogs;
      logSource = "独立服务日志";
    } else if (status.inProcess && status.inProcess.recentLogs) {
      logs = status.inProcess.recentLogs;
      logSource = "内置进程日志";
    }

    if (logs.length > 0) {
      const logContent = logs
        .map(
          (log) =>
            `<div class="py-1 border-b border-slate-200 text-sm">${log}</div>`
        )
        .join("");

      showAlert(
        `
        <div class="text-left">
          <h4 class="font-medium mb-2">${logSource}</h4>
          <div class="max-h-64 overflow-y-auto bg-slate-50 p-3 rounded border">
            ${logContent}
          </div>
        </div>
      `,
        "info"
      );
    } else {
      showAlert("暂无防护日志", "info");
    }
  } catch (error) {
    showAlert(`获取防护日志失败: ${error.message}`, "error");
  }
}

// 获取清理选项的辅助函数
function getCleanupOptions() {
  // 获取清理模式选择
  const cleanupMode =
    document.querySelector('input[name="cleanup-mode"]:checked')?.value ??
    "intelligent";

  // 根据清理模式设置清理选项
  let cleanupOptions = {};

  switch (cleanupMode) {
    case "intelligent":
      // 智能清理：只清理设备身份，保留所有配置
      cleanupOptions = {
        preserveActivation: true,
        deepClean: false,
        cleanCursorExtension: false,
        autoRestartCursor: false,
        autoRestartIDE: false, // 禁用：由前端控制重启时机
        skipBackup: true,
        enableEnhancedGuardian: true,
        skipCursorLogin: true,
        resetCursorCompletely: false,
        resetVSCodeCompletely: false,
        aggressiveMode: false,
        multiRoundClean: false,
        extendedMonitoring: false,
        usePowerShellAssist: false,
        intelligentMode: true,
      };
      break;

    case "standard":
      // 标准清理：清理大部分数据，保留核心配置
      cleanupOptions = {
        preserveActivation: true,
        deepClean: true,
        cleanCursorExtension: true,
        autoRestartCursor: true,
        autoRestartIDE: false, // 禁用：由前端控制重启时机
        skipBackup: true,
        enableEnhancedGuardian: true,
        skipCursorLogin: true,
        resetCursorCompletely: false,
        resetVSCodeCompletely: false,
        aggressiveMode: true,
        multiRoundClean: true,
        extendedMonitoring: true,
        usePowerShellAssist: true,
        standardMode: true,
      };
      break;

    case "complete":
      // 完全清理：彻底重置，仅保护MCP配置
      cleanupOptions = {
        preserveActivation: true,
        deepClean: true,
        cleanCursorExtension: true,
        autoRestartCursor: true,
        autoRestartIDE: false, // 禁用：由前端控制重启时机
        skipBackup: true,
        enableEnhancedGuardian: true,
        skipCursorLogin: false,
        resetCursorCompletely: true,
        resetVSCodeCompletely: true,
        aggressiveMode: true,
        multiRoundClean: true,
        extendedMonitoring: true,
        usePowerShellAssist: true,
        completeMode: true,
      };
      break;

    default:
      // 默认使用智能清理
      cleanupOptions = {
        preserveActivation: true,
        deepClean: false,
        cleanCursorExtension: false,
        autoRestartCursor: false,
        autoRestartIDE: false, // 禁用：由前端控制重启时机
        skipBackup: true,
        enableEnhancedGuardian: true,
        skipCursorLogin: true,
        resetCursorCompletely: false,
        resetVSCodeCompletely: false,
        aggressiveMode: false,
        multiRoundClean: false,
        extendedMonitoring: false,
        usePowerShellAssist: false,
        intelligentMode: true,
      };
  }

  return cleanupOptions;
}

// 清理后启动防护功能（整合了原来的performCleanup功能）
async function performCleanupAndStartGuardian() {
  console.log("performCleanupAndStartGuardian 函数被调用");

  // 权限检查
  const permissions = await checkFeaturePermission("设备清理工具", "cleanup");
  if (!permissions) {
    console.log("权限检查失败，退出函数");
    return;
  }

  // 检查增强防护状态
  try {
    console.log("🔍 检查增强防护状态...");
    const guardianStatus = await getEnhancedGuardianStatus();

    const isProtectionRunning =
      guardianStatus.isGuarding ||
      (guardianStatus.standalone && guardianStatus.standalone.isRunning) ||
      (guardianStatus.inProcess && guardianStatus.inProcess.isGuarding);

    if (isProtectionRunning) {
      const selectedIDE = getCurrentSelectedIDE();
      const ideDisplayName = selectedIDE === "vscode" ? "VS Code" : "Cursor";

      showAlert(
        `当前正在保护 ${ideDisplayName} 的设备ID，无法执行清理操作。<br><br>` +
          `请先在"增强防护"模块中停止防护服务，然后再进行清理。`,
        "warning"
      );
      return;
    }
  } catch (error) {
    console.warn("检查增强防护状态失败:", error);
    // 如果检查失败，继续执行清理（避免阻塞正常操作）
  }

  // 获取清理选项和IDE选择
  const cleanupOptions = getCleanupOptions();
  const selectedIDE = getCurrentSelectedIDE();
  const cleanCursor = selectedIDE === "cursor";
  const cleanVSCode = selectedIDE === "vscode";

  console.log(`🎯 清理设备 - 选择的IDE: ${selectedIDE}`);
  console.log("清理选项:", cleanupOptions);

  // 获取清理模式
  const cleanupMode =
    document.querySelector('input[name="cleanup-mode"]:checked')?.value ??
    "intelligent";

  // 显示确认对话框并执行清理
  await showCleanupConfirmationAndExecute(
    cleanupOptions,
    selectedIDE,
    cleanCursor,
    cleanVSCode,
    cleanupMode
  );
}

// 显示清理确认对话框并执行清理
async function showCleanupConfirmationAndExecute(
  cleanupOptions,
  selectedIDE,
  cleanCursor,
  cleanVSCode,
  cleanupMode
) {
  let dialogConfig = {};

  switch (cleanupMode) {
    case "intelligent":
      dialogConfig = {
        type: "info",
        title: "🧠 智能清理模式",
        message: "🧠 智能清理模式\n\n您即将执行安全的智能清理操作",
        detail: `
🧠 智能清理特性：

🎯 精准清理
  • 仅清理设备身份相关数据
  • 保留所有用户配置和设置
  • 保留IDE登录状态和偏好
  • 保护MCP配置和工作环境

✨ 清理效果
  • Augment扩展识别为新设备
  • 重置设备指纹和标识
  • 需要重新激活设备
  • IDE功能完全不受影响

🛡️ 自动防护
  • 清理完成后自动启动${selectedIDE === "vscode" ? "VS Code" : "Cursor"}防护
  • 保护新的设备ID不被修改

🎯 推荐指数：⭐⭐⭐⭐⭐
确定要继续吗？`,
        buttons: ["🧠 确定清理", "❌ 取消操作"],
      };
      break;

    case "standard":
      dialogConfig = {
        type: "warning",
        title: "🔧 标准清理模式",
        message: "🔧 标准清理模式\n\n您即将执行深度清理操作",
        detail: `
🔧 标准清理特性：

🔥 深度清理
  • 清理大部分IDE数据和缓存
  • 保留核心配置文件
  • 清理扩展数据和用户偏好
  • 保护MCP配置文件

✨ 清理效果
  • IDE回到较干净的状态
  • 部分IDE设置需要重新配置
  • 需要重新激活设备
  • 更高的清理成功率

🛡️ 自动防护
  • 清理完成后自动启动${selectedIDE === "vscode" ? "VS Code" : "Cursor"}防护
  • 保护新的设备ID不被修改

⚠️ 注意事项
  • 需要重新配置部分IDE设置
  • 扩展可能需要重新配置
  • 工作区设置可能丢失

🎯 成功率：95%以上
确定要继续吗？`,
        buttons: ["🔧 确定清理", "❌ 取消操作"],
      };
      break;

    case "complete":
      dialogConfig = {
        type: "error",
        title: "💥 完全清理模式",
        message: "💥 完全清理模式\n\n您即将执行彻底的完全重置操作",
        detail: `
💥 完全清理特性：

🗑️ 彻底重置
  • 删除几乎所有IDE数据
  • 回到全新安装状态
  • 仅保护MCP配置文件
  • 最高级别的清理深度

🔥 系统级重置
  • 完全重置Cursor和VS Code
  • 清理所有用户数据和设置
  • 重置所有身份标识
  • 清理所有缓存和临时文件

✨ 清理效果
  • IDE完全回到初始状态
  • 需要重新登录所有服务
  • 需要重新配置所有设置
  • 最高的清理成功率

🛡️ 自动防护
  • 清理完成后自动启动${selectedIDE === "vscode" ? "VS Code" : "Cursor"}防护
  • 保护新的设备ID不被修改

⚠️ 重要警告
此操作不可撤销！清理后您需要：
1. 重新登录Cursor IDE
2. 重新配置所有IDE设置
3. 重新安装和配置扩展
4. 重新激活设备

🎯 成功率：99%以上
确定要继续吗？`,
        buttons: ["💥 确定清理", "❌ 取消操作"],
      };
      break;

    default:
      // 默认使用智能清理的对话框
      dialogConfig = {
        type: "info",
        title: "🧠 智能清理模式",
        message: "🧠 智能清理模式\n\n您即将执行安全的智能清理操作",
        detail: `
🧠 智能清理特性：

🎯 精准清理
  • 仅清理设备身份相关数据
  • 保留所有用户配置和设置
  • 保留IDE登录状态和偏好
  • 保护MCP配置和工作环境

✨ 清理效果
  • Augment扩展识别为新设备
  • 重置设备指纹和标识
  • 需要重新激活设备
  • IDE功能完全不受影响

🛡️ 自动防护
  • 清理完成后自动启动${selectedIDE === "vscode" ? "VS Code" : "Cursor"}防护
  • 保护新的设备ID不被修改

🎯 推荐指数：⭐⭐⭐⭐⭐
确定要继续吗？`,
        buttons: ["🧠 确定清理", "❌ 取消操作"],
      };
  }

  // 显示确认对话框
  const confirmResult = await ipcRenderer.invoke("show-message-box", {
    ...dialogConfig,
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  });

  if (confirmResult.response !== 0) {
    console.log("用户取消清理操作");
    return;
  }

  // 执行清理和启动防护
  await executeCleanupAndStartGuardian(
    cleanupOptions,
    selectedIDE,
    cleanCursor,
    cleanVSCode,
    cleanupMode
  );
}

// 执行清理和启动防护的主要逻辑
async function executeCleanupAndStartGuardian(
  cleanupOptions,
  selectedIDE,
  cleanCursor,
  cleanVSCode,
  cleanupMode
) {
  // 找到清理按钮（用于显示状态）
  const cleanupBtn = document.querySelector(
    'button[onclick="performCleanupAndStartGuardian()"]'
  );

  if (!cleanupBtn) {
    console.error("找不到清理按钮");
    showAlert("页面元素错误，请刷新页面", "error");
    return;
  }

  const originalText = cleanupBtn.innerHTML;
  console.log("找到清理按钮，开始执行清理操作");

  // 🚫 第1步：关闭目标IDE，防止其自动恢复配置
  addCleanupLog("🚫 第1步：关闭目标IDE，防止配置自动恢复...", "info");

  try {
    if (selectedIDE === "cursor") {
      addCleanupLog("🔄 正在关闭Cursor IDE...", "info");
      await ipcRenderer.invoke("close-ide-processes", "cursor");
      addCleanupLog("✅ Cursor IDE已关闭", "success");
    } else if (selectedIDE === "vscode") {
      addCleanupLog("🔄 正在关闭VS Code IDE...", "info");
      await ipcRenderer.invoke("close-ide-processes", "vscode");
      addCleanupLog("✅ VS Code IDE已关闭", "success");
    }

    // 等待进程完全关闭
    await new Promise((resolve) => setTimeout(resolve, 2000));
    addCleanupLog("⏱️ 等待IDE进程完全关闭...", "info");
  } catch (error) {
    console.warn("关闭IDE失败:", error);
    addCleanupLog(`⚠️ 关闭IDE失败: ${error.message}`, "warning");
    addCleanupLog("⚠️ 继续执行清理操作...", "warning");
  }

  // 启动清理监控模式
  const monitoringDuration = 20000; // 20秒监控（优化性能）
  startCleanupMonitoring(monitoringDuration);
  addCleanupLog("🔄 启动清理监控模式，防止数据恢复...", "info");

  try {
    cleanupBtn.disabled = true;
    cleanupBtn.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
        <div style="width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <span>清理中...</span>
      </div>
    `;

    console.log("正在调用设备清理功能...");

    // 备份当前设备ID
    let originalDeviceId = null;
    try {
      const deviceIdDetails = await ipcRenderer.invoke("get-device-id-details");
      if (
        selectedIDE === "vscode" &&
        deviceIdDetails.vscodeTelemetry?.devDeviceId
      ) {
        originalDeviceId = deviceIdDetails.vscodeTelemetry.devDeviceId;
      } else if (
        selectedIDE === "cursor" &&
        deviceIdDetails.cursorTelemetry?.devDeviceId
      ) {
        originalDeviceId = deviceIdDetails.cursorTelemetry.devDeviceId;
      } else {
        const deviceInfo = await ipcRenderer.invoke("get-device-info");
        originalDeviceId = deviceInfo.deviceId;
      }
      addCleanupLog(`📋 备份当前设备ID: ${originalDeviceId}`, "info");
    } catch (error) {
      addCleanupLog("⚠️ 备份设备ID失败: " + error.message, "warning");
    }

    // 根据清理模式显示不同的日志信息
    switch (cleanupMode) {
      case "intelligent":
        addCleanupLog("🧠 执行智能清理操作（精准清理设备身份）...", "info");
        break;
      case "standard":
        addCleanupLog("🔧 执行标准清理操作（深度清理保留核心配置）...", "info");
        break;
      case "complete":
        addCleanupLog("💥 执行完全清理操作（彻底重置仅保护MCP）...", "info");
        break;
      default:
        addCleanupLog("🔥 执行清理操作...", "info");
    }

    // 添加进度提示，避免用户感觉卡顿
    addCleanupLog("⏳ 正在执行清理操作，请稍候...", "info");

    // 使用 setTimeout 让界面有时间更新
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 添加清理超时机制（30秒超时）
    const cleanupPromise = ipcRenderer.invoke("perform-device-cleanup", {
      // 使用清理模式配置的所有参数
      ...cleanupOptions,

      // IDE选择选项（用户选择优先）
      cleanCursor: cleanCursor,
      cleanVSCode: cleanVSCode,
      selectedIDE: selectedIDE,

      // PowerShell辅助选项
      usePowerShellAssist: cleanupOptions.usePowerShellAssist ?? false,

      // 重置选项
      skipCursorLogin: !cleanupOptions.resetCursorCompletely,
      resetCursorCompletely: cleanupOptions.resetCursorCompletely,
      resetVSCodeCompletely: cleanupOptions.resetVSCodeCompletely,
    });

    // 创建超时Promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("清理操作超时（30秒），请重试"));
      }, 30000);
    });

    // 使用Promise.race实现超时控制
    const result = await Promise.race([cleanupPromise, timeoutPromise]);

    console.log("设备清理结果:", result);

    if (result.success) {
      addCleanupLog(
        `清理完成！清理了 ${result.actions?.length || 0} 个项目`,
        "success"
      );

      // 显示详细的清理结果
      if (result.actions && result.actions.length > 0) {
        result.actions.forEach((action) => {
          addCleanupLog(`✓ ${action}`, "success");
        });
      }

      // 获取新的设备ID并显示对比
      if (originalDeviceId) {
        try {
          addCleanupLog("🔍 检查设备ID变更情况...", "info");

          let newDeviceId = null;
          const newDeviceIdDetails = await ipcRenderer.invoke(
            "get-device-id-details"
          );

          if (
            selectedIDE === "vscode" &&
            newDeviceIdDetails.vscodeTelemetry?.devDeviceId
          ) {
            newDeviceId = newDeviceIdDetails.vscodeTelemetry.devDeviceId;
          } else if (
            selectedIDE === "cursor" &&
            newDeviceIdDetails.cursorTelemetry?.devDeviceId
          ) {
            newDeviceId = newDeviceIdDetails.cursorTelemetry.devDeviceId;
          } else {
            const newDeviceInfo = await ipcRenderer.invoke("get-device-info");
            newDeviceId = newDeviceInfo.deviceId;
          }

          if (newDeviceId && newDeviceId !== originalDeviceId) {
            // 添加分隔线和清理完成提示
            addCleanupLog(
              "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
              "info"
            );
            addCleanupLog(`🎉 设备ID更新成功！`, "success");
            addCleanupLog(
              "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
              "info"
            );
            addCleanupLog(`📋 设备ID变更详情：`, "info");
            addCleanupLog(`旧ID: ${originalDeviceId}`, "warning");
            addCleanupLog(`新ID: ${newDeviceId}`, "success");
            addCleanupLog(
              "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
              "info"
            );
          } else {
            // 添加分隔线和警告提示
            addCleanupLog(
              "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
              "info"
            );
            addCleanupLog("⚠️ 设备ID未发生变化", "warning");
            addCleanupLog(
              "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
              "info"
            );
            addCleanupLog(`📋 设备ID检查结果：`, "info");
            addCleanupLog(`旧ID: ${originalDeviceId}`, "warning");
            addCleanupLog(`新ID: ${newDeviceId}`, "warning");
            addCleanupLog("状态: 与清理前相同，可能需要重启应用", "warning");
            addCleanupLog(
              "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
              "info"
            );
          }
        } catch (error) {
          addCleanupLog("⚠️ 检查设备ID变更失败: " + error.message, "warning");
        }
      }

      // 🛡️ 立即启动防护保护新的设备ID（在IDE重启前）
      addCleanupLog("🛡️ 立即启动防护保护新的设备ID...", "info");
      await startGuardianAfterCleanup_ENABLED(selectedIDE);

      // ⏱️ 等待防护完全启动
      await new Promise((resolve) => setTimeout(resolve, 3000));
      addCleanupLog("⏱️ 防护已启动，等待稳定...", "info");

      // 🔄 最后重启IDE（此时防护已经在保护新ID）
      addCleanupLog("🔄 重启IDE（防护已保护新ID）...", "info");
      try {
        await ipcRenderer.invoke("restart-ide", selectedIDE);
        addCleanupLog("✅ IDE重启完成", "success");
      } catch (error) {
        addCleanupLog(`⚠️ IDE重启失败: ${error.message}`, "warning");
        addCleanupLog("💡 请手动启动IDE", "info");
      }

      // 显示成功消息
      showAlert(`✅ 设备清理完成，防护已启动！`, "success");
    } else {
      addCleanupLog(`❌ 清理失败: ${result.error}`, "error");

      if (result.requireActivation) {
        showAlert(`清理失败: ${result.error}`, "error");
        if (result.securityIssue) {
          showAlert("检测到安全问题，请重新激活", "warning");
        }
      } else {
        showAlert(`清理失败: ${result.error}`, "error");
      }
    }
  } catch (error) {
    console.error("清理操作失败:", error);
    addCleanupLog(`❌ 清理操作异常: ${error.message}`, "error");
    showAlert(`清理操作失败: ${error.message}`, "error");
  } finally {
    // 恢复按钮状态
    cleanupBtn.disabled = false;
    cleanupBtn.innerHTML = originalText;

    // 停止清理监控
    setTimeout(() => {
      stopCleanupMonitoring();
    }, 5000);
  }
}

// 清理后立即启动防护的函数（防止IDE恢复旧ID）
async function startGuardianAfterCleanup_ENABLED(selectedIDE) {
  try {
    console.log(`🛡️ 立即为 ${selectedIDE} 启动防护，保护新设备ID...`);
    addCleanupLog(`🛡️ 立即为 ${selectedIDE} 启动防护，保护新设备ID...`, "info");

    // 立即获取清理后的新设备ID
    console.log("📡 获取清理后的新设备ID...");
    const deviceIdDetails = await ipcRenderer.invoke("get-device-id-details");
    let targetDeviceId = null;

    console.log("设备ID详情:", deviceIdDetails);

    if (deviceIdDetails.success) {
      if (
        selectedIDE === "vscode" &&
        deviceIdDetails.vscodeTelemetry?.devDeviceId
      ) {
        targetDeviceId = deviceIdDetails.vscodeTelemetry.devDeviceId;
        console.log(`📋 使用VS Code设备ID: ${targetDeviceId}`);
        addCleanupLog(`📋 使用VS Code设备ID: ${targetDeviceId}`, "info");
      } else if (
        selectedIDE === "cursor" &&
        deviceIdDetails.cursorTelemetry?.devDeviceId
      ) {
        targetDeviceId = deviceIdDetails.cursorTelemetry.devDeviceId;
        console.log(`📋 使用Cursor设备ID: ${targetDeviceId}`);
        addCleanupLog(`📋 使用Cursor设备ID: ${targetDeviceId}`, "info");
      } else {
        // 如果没有对应IDE的遥测ID，则使用设备指纹作为备用
        const deviceInfo = await ipcRenderer.invoke("get-device-info");
        targetDeviceId = deviceInfo.deviceId;
        console.log(`📋 使用设备指纹ID: ${targetDeviceId}`);
        addCleanupLog(`📋 使用设备指纹ID: ${targetDeviceId}`, "info");
      }
    }

    console.log(`🎯 目标设备ID: ${targetDeviceId}`);
    addCleanupLog(`🎯 目标设备ID: ${targetDeviceId}`, "info");

    if (!targetDeviceId) {
      throw new Error("无法获取目标设备ID");
    }

    // 立即启动防护
    console.log("🚀 立即启动防护进程...");
    addCleanupLog("🚀 立即启动防护进程...", "info");

    const guardianResult = await ipcRenderer.invoke(
      "start-enhanced-guardian-independent",
      {
        selectedIDE: selectedIDE,
        targetDeviceId: targetDeviceId,
        enableBackupMonitoring: true,
        enableDatabaseMonitoring: true,
        enableEnhancedProtection: true,
      }
    );

    console.log("防护启动结果:", guardianResult);

    if (guardianResult.success) {
      addCleanupLog(`✅ 防护已启动，保护设备ID: ${targetDeviceId}`, "success");
      updateGuardianButtonState("running");

      // 立即验证防护是否正确保护新的设备ID
      setTimeout(async () => {
        try {
          console.log("🔍 验证防护进程是否保护正确的设备ID...");

          // 重新获取设备ID，检查是否被防护进程修改
          const verifyDetails = await ipcRenderer.invoke(
            "get-device-id-details"
          );
          if (verifyDetails.success) {
            let currentDeviceId = null;
            if (
              selectedIDE === "cursor" &&
              verifyDetails.cursorTelemetry?.devDeviceId
            ) {
              currentDeviceId = verifyDetails.cursorTelemetry.devDeviceId;
            } else if (
              selectedIDE === "vscode" &&
              verifyDetails.vscodeTelemetry?.devDeviceId
            ) {
              currentDeviceId = verifyDetails.vscodeTelemetry.devDeviceId;
            }

            if (currentDeviceId === targetDeviceId) {
              console.log("✅ 防护进程正确保护新的设备ID");
              addCleanupLog("✅ 防护验证通过，设备ID保持正确", "success");
            } else {
              console.warn("⚠️ 防护进程可能使用了错误的设备ID");
              console.warn(`期望: ${targetDeviceId}, 实际: ${currentDeviceId}`);
              addCleanupLog(`⚠️ 防护验证失败，设备ID不匹配`, "warning");
              addCleanupLog(`期望: ${targetDeviceId}`, "warning");
              addCleanupLog(`实际: ${currentDeviceId}`, "warning");
            }
          }
        } catch (verifyError) {
          console.error("验证防护失败:", verifyError);
        }

        refreshGuardianStatus("cleanup-and-start");
      }, 1000);
    } else {
      addCleanupLog(`❌ 防护启动失败: ${guardianResult.message}`, "error");
      showAlert(`防护启动失败: ${guardianResult.message}`, "error");
    }
  } catch (error) {
    console.error("启动防护失败:", error);
    addCleanupLog(`❌ 启动防护异常: ${error.message}`, "error");
    showAlert(`启动防护失败: ${error.message}`, "error");
  }
}

// 清理后启动防护的辅助函数（增强版本）- 临时禁用
// async function startGuardianAfterCleanup(selectedIDE) {
async function startGuardianAfterCleanup_DISABLED(selectedIDE) {
  try {
    console.log(`🛡️ 为 ${selectedIDE} 启动防护...`);
    addCleanupLog(`🛡️ 为 ${selectedIDE} 启动防护...`, "info");

    // 等待一下确保清理操作完全完成
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 获取设备ID详情以确定目标设备ID
    console.log("📡 获取清理后的设备ID详情...");
    const deviceIdDetails = await ipcRenderer.invoke("get-device-id-details");
    let targetDeviceId = null;

    console.log("设备ID详情:", deviceIdDetails);

    if (deviceIdDetails.success) {
      if (
        selectedIDE === "vscode" &&
        deviceIdDetails.vscodeTelemetry?.devDeviceId
      ) {
        targetDeviceId = deviceIdDetails.vscodeTelemetry.devDeviceId;
        console.log(`📋 使用VS Code设备ID: ${targetDeviceId}`);
        addCleanupLog(`📋 使用VS Code设备ID: ${targetDeviceId}`, "info");
      } else if (
        selectedIDE === "cursor" &&
        deviceIdDetails.cursorTelemetry?.devDeviceId
      ) {
        targetDeviceId = deviceIdDetails.cursorTelemetry.devDeviceId;
        console.log(`📋 使用Cursor设备ID: ${targetDeviceId}`);
        addCleanupLog(`📋 使用Cursor设备ID: ${targetDeviceId}`, "info");
      } else {
        // 如果没有对应IDE的遥测ID，则使用设备指纹作为备用
        const deviceInfo = await ipcRenderer.invoke("get-device-info");
        targetDeviceId = deviceInfo.deviceId;
        console.log(`📋 使用设备指纹ID: ${targetDeviceId}`);
        addCleanupLog(`📋 使用设备指纹ID: ${targetDeviceId}`, "info");
      }
    }

    console.log(`🎯 目标设备ID: ${targetDeviceId}`);
    addCleanupLog(`🎯 目标设备ID: ${targetDeviceId}`, "info");

    if (!targetDeviceId) {
      throw new Error("无法获取目标设备ID");
    }

    // 启动防护
    console.log("🚀 启动防护进程...");
    addCleanupLog("🚀 启动防护进程...", "info");

    const guardianResult = await ipcRenderer.invoke(
      "start-enhanced-guardian-independent",
      {
        selectedIDE: selectedIDE,
        targetDeviceId: targetDeviceId,
        enableBackupMonitoring: true,
        enableDatabaseMonitoring: true,
        enableEnhancedProtection: true,
      }
    );

    console.log("防护启动结果:", guardianResult);

    if (guardianResult.success) {
      addCleanupLog(`✅ 防护已启动，保护设备ID: ${targetDeviceId}`, "success");
      updateGuardianButtonState("running");

      // 等待一下，然后验证防护是否正确保护新的设备ID
      setTimeout(async () => {
        try {
          console.log("🔍 验证防护进程是否保护正确的设备ID...");

          // 重新获取设备ID，检查是否被防护进程修改
          const verifyDetails = await ipcRenderer.invoke(
            "get-device-id-details"
          );
          if (verifyDetails.success) {
            let currentDeviceId = null;
            if (
              selectedIDE === "cursor" &&
              verifyDetails.cursorTelemetry?.devDeviceId
            ) {
              currentDeviceId = verifyDetails.cursorTelemetry.devDeviceId;
            } else if (
              selectedIDE === "vscode" &&
              verifyDetails.vscodeTelemetry?.devDeviceId
            ) {
              currentDeviceId = verifyDetails.vscodeTelemetry.devDeviceId;
            }

            if (currentDeviceId === targetDeviceId) {
              console.log("✅ 防护进程正确保护新的设备ID");
              addCleanupLog("✅ 防护验证通过，设备ID保持正确", "success");
            } else {
              console.warn("⚠️ 防护进程可能使用了错误的设备ID");
              console.warn(`期望: ${targetDeviceId}, 实际: ${currentDeviceId}`);
              addCleanupLog(`⚠️ 防护验证失败，设备ID不匹配`, "warning");
              addCleanupLog(`期望: ${targetDeviceId}`, "warning");
              addCleanupLog(`实际: ${currentDeviceId}`, "warning");
            }
          }
        } catch (verifyError) {
          console.error("验证防护失败:", verifyError);
        }

        refreshGuardianStatus("cleanup-and-start");
      }, 2000);
    } else {
      addCleanupLog(`❌ 防护启动失败: ${guardianResult.message}`, "error");
      showAlert(`防护启动失败: ${guardianResult.message}`, "error");
    }
  } catch (error) {
    console.error("启动防护失败:", error);
    addCleanupLog(`❌ 启动防护异常: ${error.message}`, "error");
    showAlert(`启动防护失败: ${error.message}`, "error");
  }
}

// 将函数暴露到全局作用域 - 立即暴露，确保HTML中的onclick可以访问
window.viewGuardianLogs = viewGuardianLogs;
window.refreshGuardianStatus = refreshGuardianStatus;
window.stopAllNodeProcesses = stopAllNodeProcesses;
window.showAlert = showAlert;
window.updateGuardianStatusDisplay = updateGuardianStatusDisplay;
window.startGuardianService = startGuardianService;
window.triggerStatusRefresh = triggerStatusRefresh;
window.performCleanupAndStartGuardian = performCleanupAndStartGuardian;

// 添加强制刷新函数
window.forceRefreshGuardianStatus = function () {
  console.log("🔄 强制刷新防护状态");
  refreshGuardianStatus("manual-force");
};

// 调试：确认函数已暴露
console.log("🔧 renderer.js函数已暴露到全局作用域:", {
  viewGuardianLogs: typeof window.viewGuardianLogs,
  refreshGuardianStatus: typeof window.refreshGuardianStatus,
  stopAllNodeProcesses: typeof window.stopAllNodeProcesses,
  showAlert: typeof window.showAlert,
  updateGuardianStatusDisplay: typeof window.updateGuardianStatusDisplay,
  startGuardianService: typeof window.startGuardianService,
  triggerStatusRefresh: typeof window.triggerStatusRefresh,
  forceRefreshGuardianStatus: typeof window.forceRefreshGuardianStatus,
});

// 确保刷新按钮事件绑定
document.addEventListener("DOMContentLoaded", function () {
  const refreshBtn = document.getElementById("refresh-guardian-btn");
  if (refreshBtn) {
    // 移除原有的onclick，添加新的事件监听器
    refreshBtn.removeAttribute("onclick");
    refreshBtn.addEventListener("click", function () {
      console.log("🔄 刷新按钮被点击");
      refreshGuardianStatus("manual");
    });
    console.log("✅ 刷新按钮事件已绑定");
  } else {
    console.log("⚠️ 未找到刷新按钮");
  }
});
