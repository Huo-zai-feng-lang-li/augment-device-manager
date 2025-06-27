// Augment 激活码管理系统 - 前端JavaScript
let authToken = localStorage.getItem("authToken");
let currentTab = "generate";
let wsConnection = null;

// 页面加载完成后初始化
document.addEventListener("DOMContentLoaded", function () {
  if (authToken) {
    showDashboard();
    initWebSocket();
  } else {
    showLogin();
  }
});

// 显示登录表单
function showLogin() {
  document.getElementById("loginForm").classList.remove("hidden");
  document.getElementById("dashboard").classList.add("hidden");
}

// 显示管理面板
function showDashboard() {
  document.getElementById("loginForm").classList.add("hidden");
  document.getElementById("dashboard").classList.remove("hidden");
  loadStats();
  showTab(currentTab);
}

// 登录功能
async function login(event) {
  event.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const alertDiv = document.getElementById("loginAlert");

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (data.success) {
      authToken = data.token;
      localStorage.setItem("authToken", authToken);
      showAlert(alertDiv, "登录成功！", "success");
      setTimeout(() => {
        showDashboard();
        initWebSocket();
      }, 1000);
    } else {
      showAlert(alertDiv, data.error || "登录失败", "error");
    }
  } catch (error) {
    console.error("登录错误:", error);
    showAlert(alertDiv, "网络错误，请重试", "error");
  }
}

// 退出登录
function logout() {
  authToken = null;
  localStorage.removeItem("authToken");
  if (wsConnection) {
    wsConnection.close();
    wsConnection = null;
  }
  showLogin();
}

// 初始化WebSocket连接
function initWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  wsConnection = new WebSocket(wsUrl);

  wsConnection.onopen = function () {
    console.log("WebSocket连接已建立");
    // 发送认证信息
    wsConnection.send(
      JSON.stringify({
        type: "auth",
        token: authToken,
      })
    );
  };

  wsConnection.onmessage = function (event) {
    const data = JSON.parse(event.data);
    handleWebSocketMessage(data);
  };

  wsConnection.onclose = function () {
    console.log("WebSocket连接已关闭");
    // 5秒后重连
    setTimeout(() => {
      if (authToken) {
        initWebSocket();
      }
    }, 5000);
  };

  wsConnection.onerror = function (error) {
    console.error("WebSocket错误:", error);
  };
}

// 处理WebSocket消息
function handleWebSocketMessage(data) {
  switch (data.type) {
    case "client_connected":
      console.log("客户端连接:", data.clientId);
      loadStats(); // 刷新统计信息
      break;
    case "client_disconnected":
      console.log("客户端断开:", data.clientId);
      loadStats(); // 刷新统计信息
      break;
    case "activation_used":
      console.log("激活码被使用:", data.code);
      if (currentTab === "codes") loadCodes();
      if (currentTab === "logs") loadLogs();
      loadStats();
      break;
    default:
      console.log("未知消息类型:", data);
  }
}

// 显示提示信息
function showAlert(container, message, type = "info") {
  const alertClass =
    type === "success"
      ? "alert-success"
      : type === "error"
      ? "alert-error"
      : "alert-info";

  container.innerHTML = `
        <div class="alert ${alertClass}">
            ${message}
        </div>
    `;

  setTimeout(() => {
    container.innerHTML = "";
  }, 5000);
}

// API请求封装
async function apiRequest(url, options = {}) {
  const defaultOptions = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
  };

  const response = await fetch(url, { ...defaultOptions, ...options });

  if (response.status === 401) {
    logout();
    throw new Error("认证失败，请重新登录");
  }

  return response.json();
}

// 切换标签页
function showTab(tabName) {
  currentTab = tabName;

  // 更新标签按钮状态
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.remove("active");
  });
  event?.target?.classList.add("active") ||
    document
      .querySelector(`[onclick="showTab('${tabName}')"]`)
      ?.classList.add("active");

  // 隐藏所有标签内容
  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.remove("active");
  });

  // 显示当前标签内容
  const currentContent = document.getElementById(tabName + "Tab");
  if (currentContent) {
    currentContent.classList.add("active");
  }

  // 加载对应数据
  switch (tabName) {
    case "codes":
      loadCodes();
      break;
    case "logs":
      loadLogs();
      break;
    case "users":
      loadUsers();
      break;
    case "control":
      loadConnectedClients();
      break;
  }
}

// 加载统计信息
async function loadStats() {
  try {
    const data = await apiRequest("/api/stats");
    if (data.success) {
      renderStats(data.data);
    }
  } catch (error) {
    console.error("加载统计信息失败:", error);
  }
}

// 渲染统计信息
function renderStats(stats) {
  const statsGrid = document.getElementById("statsGrid");
  statsGrid.innerHTML = `
        <div class="stat-card">
            <div class="stat-number">${stats.totalCodes}</div>
            <div class="stat-label">总激活码</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.activeCodes}</div>
            <div class="stat-label">可用激活码</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.usedCodes}</div>
            <div class="stat-label">已使用</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.expiredCodes}</div>
            <div class="stat-label">已过期</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.connectedClients || 0}</div>
            <div class="stat-label">在线客户端</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.recentUsage}</div>
            <div class="stat-label">24小时使用</div>
        </div>
    `;
}

// 生成激活码
async function generateCode(event) {
  event.preventDefault();

  const formData = new FormData(event.target);
  const data = {
    deviceId: formData.get("deviceId") || null,
    expiryDays: parseInt(formData.get("expiryDays")) || 30,
    notes: formData.get("notes") || "",
  };

  try {
    const response = await apiRequest("/api/activation-codes", {
      method: "POST",
      body: JSON.stringify(data),
    });

    if (response.success) {
      const resultDiv = document.getElementById("generatedCode");
      resultDiv.innerHTML = `
                <div class="alert alert-success">
                    <h4>激活码生成成功！</h4>
                    <div class="code-display">${response.data.code}</div>
                    <p>过期时间: ${new Date(
                      response.data.expiresAt
                    ).toLocaleString()}</p>
                    <button onclick="copyToClipboard('${
                      response.data.code
                    }')" class="btn btn-secondary">
                        复制激活码
                    </button>
                </div>
            `;

      // 重置表单
      event.target.reset();

      // 刷新统计信息
      loadStats();
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error("生成激活码失败:", error);
    document.getElementById("generatedCode").innerHTML = `
            <div class="alert alert-error">
                生成失败: ${error.message}
            </div>
        `;
  }
}

// 复制到剪贴板
function copyToClipboard(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      alert("激活码已复制到剪贴板！");
    })
    .catch((err) => {
      console.error("复制失败:", err);
      // 降级方案
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      alert("激活码已复制到剪贴板！");
    });
}

// 加载激活码列表
async function loadCodes() {
  // 添加加载状态
  const refreshBtn = document.querySelector('button[onclick="loadCodes()"]');
  const originalText = refreshBtn ? refreshBtn.innerHTML : "";
  if (refreshBtn) {
    refreshBtn.innerHTML = "🔄 刷新中...";
    refreshBtn.disabled = true;
  }

  try {
    const data = await apiRequest("/api/activation-codes");
    if (data.success) {
      renderCodesTable(data.data);
    }
  } catch (error) {
    console.error("加载激活码列表失败:", error);
    document.getElementById("codesTable").innerHTML = `
            <div class="alert alert-error">加载失败: ${error.message}</div>
        `;
  } finally {
    // 恢复按钮状态
    if (refreshBtn) {
      refreshBtn.innerHTML = originalText;
      refreshBtn.disabled = false;
    }
  }
}

// 渲染激活码表格
function renderCodesTable(codes) {
  const table = document.getElementById("codesTable");

  if (codes.length === 0) {
    table.innerHTML = '<div class="alert alert-info">暂无激活码</div>';
    return;
  }

  const tableHTML = `
        <table class="data-table codes-table">
            <thead>
                <tr>
                    <th>激活码</th>
                    <th>状态</th>
                    <th>绑定设备</th>
                    <th>创建时间</th>
                    <th>过期时间</th>
                    <th>备注</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
                ${codes
                  .map((code) => {
                    // 截断长设备ID用于显示
                    const deviceId = code.used_by_device;
                    const shortDeviceId =
                      deviceId && deviceId.length > 20
                        ? deviceId.substring(0, 20) + "..."
                        : deviceId;

                    return `
                    <tr>
                        <td>
                            <div style="display: flex; align-items: center; gap: 4px;">
                              <code class="code-text" title="${code.code}">${
                      code.code
                    }</code>
                              <button onclick="copyToClipboard('${
                                code.code
                              }')" class="btn-small">复制</button>
                            </div>
                        </td>
                        <td>
                            <span class="status-badge status-${code.status}">
                                ${getStatusText(code.status)}
                            </span>
                        </td>
                        <td>
                            ${
                              deviceId
                                ? `<code class="device-id"${
                                    shortDeviceId !== deviceId
                                      ? ` title="${deviceId}"`
                                      : ""
                                  }>${shortDeviceId}</code>`
                                : "-"
                            }
                        </td>
                        <td>
                            <span class="datetime-text">${formatDateTime(
                              code.created_at
                            )}</span>
                        </td>
                        <td class="${
                          isExpired(code.expires_at) ? "text-danger" : ""
                        }">
                            <span class="datetime-text">${formatDateTime(
                              code.expires_at
                            )}</span>
                        </td>
                        <td>${code.notes || "-"}</td>
                        <td>
                            <div class="action-container">
                              <button onclick="editCode('${
                                code.id
                              }')" class="btn-small btn-secondary">编辑</button>
                              <button onclick="deleteCode('${
                                code.id
                              }')" class="btn-small btn-danger">删除</button>
                              ${
                                code.status === "active"
                                  ? `<button onclick="revokeCode('${code.id}')" class="btn-small btn-warning">撤销</button>`
                                  : ""
                              }
                            </div>
                        </td>
                    </tr>
                `;
                  })
                  .join("")}
            </tbody>
        </table>
    `;

  table.innerHTML = tableHTML;
}

// 加载使用记录
async function loadLogs() {
  // 添加加载状态
  const refreshBtn = document.querySelector('button[onclick="loadLogs()"]');
  const originalText = refreshBtn ? refreshBtn.innerHTML : "";
  if (refreshBtn) {
    refreshBtn.innerHTML = "🔄 刷新中...";
    refreshBtn.disabled = true;
  }

  try {
    const data = await apiRequest("/api/usage-logs");
    if (data.success) {
      renderLogsTable(data.data);
    }
  } catch (error) {
    console.error("加载使用记录失败:", error);
    document.getElementById("logsTable").innerHTML = `
            <div class="alert alert-error">加载失败: ${error.message}</div>
        `;
  } finally {
    // 恢复按钮状态
    if (refreshBtn) {
      refreshBtn.innerHTML = originalText;
      refreshBtn.disabled = false;
    }
  }
}

// 渲染使用记录表格
function renderLogsTable(logs) {
  const table = document.getElementById("logsTable");

  if (logs.length === 0) {
    table.innerHTML = '<div class="alert alert-info">暂无使用记录</div>';
    return;
  }

  const tableHTML = `
        <table class="data-table logs-table">
            <thead>
                <tr>
                    <th>时间</th>
                    <th>激活码</th>
                    <th>设备ID</th>
                    <th>操作</th>
                    <th>详情</th>
                </tr>
            </thead>
            <tbody>
                ${logs
                  .map((log) => {
                    // 截断长设备ID和激活码用于显示
                    const deviceId = log.device_id;
                    const shortDeviceId =
                      deviceId && deviceId.length > 20
                        ? deviceId.substring(0, 20) + "..."
                        : deviceId;

                    const activationCode = log.activation_code;
                    const shortActivationCode =
                      activationCode && activationCode.length > 15
                        ? activationCode.substring(0, 15) + "..."
                        : activationCode;

                    return `
                    <tr>
                        <td>
                            <span class="datetime-text">${formatDateTime(
                              log.timestamp
                            )}</span>
                        </td>
                        <td>
                            ${
                              activationCode
                                ? `
                              <div class="code-container">
                                <code class="code-text"${
                                  shortActivationCode !== activationCode
                                    ? ` title="${activationCode}"`
                                    : ""
                                }>${shortActivationCode}</code>
                                <button onclick="copyToClipboard('${activationCode.replace(
                                  /'/g,
                                  "\\'"
                                )}')" class="btn-small">复制</button>
                              </div>
                            `
                                : "-"
                            }
                        </td>
                        <td>
                            ${
                              deviceId
                                ? `
                              <div class="code-container">
                                <code class="device-id"${
                                  shortDeviceId !== deviceId
                                    ? ` title="${deviceId}"`
                                    : ""
                                }>${shortDeviceId}</code>
                                <button onclick="copyToClipboard('${deviceId.replace(
                                  /'/g,
                                  "\\'"
                                )}')" class="btn-small">复制</button>
                              </div>
                            `
                                : "-"
                            }
                        </td>
                        <td>
                            <span class="action-badge action-${log.action}">
                                ${getActionText(log.action)}
                            </span>
                        </td>
                        <td style="font-size: 11px; word-break: break-word;">${
                          log.details || "-"
                        }</td>
                    </tr>
                `;
                  })
                  .join("")}
            </tbody>
        </table>
    `;

  table.innerHTML = tableHTML;
}

// 工具函数
function getStatusText(status) {
  const statusMap = {
    active: "可用",
    used: "已使用",
    expired: "已过期",
    revoked: "已撤销",
    inactive: "已禁用",
  };
  return statusMap[status] || status;
}

function getActionText(action) {
  const actionMap = {
    created: "创建",
    activated: "激活",
    failed: "失败",
    revoked: "撤销",
    verified: "验证",
    deleted: "删除",
    broadcast: "广播",
    user_disable: "禁用用户",
    user_enable: "启用用户",
    operation_cleanup: "清理操作",
    创建: "创建",
    激活: "激活",
  };
  return actionMap[action] || action;
}

function formatDateTime(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleString("zh-CN");
}

function isExpired(dateString) {
  return new Date(dateString) < new Date();
}

// 删除激活码
async function deleteCode(codeId) {
  if (!confirm("确定要删除这个激活码吗？此操作不可恢复！")) {
    return;
  }

  try {
    const response = await apiRequest(`/api/activation-codes/${codeId}`, {
      method: "DELETE",
    });

    if (response.success) {
      alert("激活码删除成功！");
      loadCodes();
      loadStats();
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error("删除激活码失败:", error);
    alert("删除失败: " + error.message);
  }
}

// 撤销激活码
async function revokeCode(codeId) {
  if (!confirm("确定要撤销这个激活码吗？撤销后将立即失效！")) {
    return;
  }

  const reason = prompt("请输入撤销原因（可选）:");

  try {
    const response = await apiRequest(
      `/api/activation-codes/${codeId}/revoke`,
      {
        method: "POST",
        body: JSON.stringify({ reason: reason || "管理员撤销" }),
      }
    );

    if (response.success) {
      alert("激活码撤销成功！");
      loadCodes();
      loadStats();
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error("撤销激活码失败:", error);
    alert("撤销失败: " + error.message);
  }
}

// 编辑激活码
function editCode(codeId) {
  // 这里可以实现编辑功能，比如修改备注、延长过期时间等
  const newNotes = prompt("请输入新的备注信息:");
  if (newNotes !== null) {
    updateCodeNotes(codeId, newNotes);
  }
}

// 更新激活码备注
async function updateCodeNotes(codeId, notes) {
  try {
    const response = await apiRequest(`/api/activation-codes/${codeId}`, {
      method: "PUT",
      body: JSON.stringify({ notes }),
    });

    if (response.success) {
      alert("备注更新成功！");
      loadCodes();
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error("更新备注失败:", error);
    alert("更新失败: " + error.message);
  }
}

// 加载连接的客户端
async function loadConnectedClients() {
  try {
    const data = await apiRequest("/api/connected-clients");
    if (data.success) {
      renderConnectedClients(data.data);
    }
  } catch (error) {
    console.error("加载连接客户端失败:", error);
    document.getElementById("connectedClientsTable").innerHTML = `
      <div class="alert alert-error">加载失败: ${error.message}</div>
    `;
  }
}

// 渲染连接的客户端
function renderConnectedClients(clients) {
  const table = document.getElementById("connectedClientsTable");

  if (clients.length === 0) {
    table.innerHTML = '<div class="alert alert-info">暂无在线客户端</div>';
    return;
  }

  const tableHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>客户端ID</th>
          <th>连接时间</th>
          <th>激活状态</th>
          <th>设备信息</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${clients
          .map(
            (client) => `
          <tr>
            <td><code class="device-id">${client.id}</code></td>
            <td>${formatDateTime(client.connectedAt)}</td>
            <td>
              <span class="status-badge status-${
                client.activated ? "active" : "inactive"
              }">
                ${client.activated ? "已激活" : "未激活"}
              </span>
            </td>
            <td>${client.deviceInfo || "-"}</td>
            <td>
              <button onclick="sendControlMessage('${client.id}', 'disable')"
                      class="btn-small btn-warning">禁用</button>
              <button onclick="sendControlMessage('${client.id}', 'enable')"
                      class="btn-small btn-success">启用</button>
              <button onclick="disconnectClient('${client.id}')"
                      class="btn-small btn-danger">断开</button>
            </td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;

  table.innerHTML = tableHTML;
}

// 发送控制消息
async function sendControlMessage(clientId, action) {
  try {
    const response = await apiRequest("/api/control-client", {
      method: "POST",
      body: JSON.stringify({ clientId, action }),
    });

    if (response.success) {
      alert(`客户端${action === "enable" ? "启用" : "禁用"}成功！`);
      loadConnectedClients();
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error("发送控制消息失败:", error);
    alert("操作失败: " + error.message);
  }
}

// 断开客户端连接
async function disconnectClient(clientId) {
  if (!confirm("确定要断开这个客户端的连接吗？")) {
    return;
  }

  try {
    const response = await apiRequest("/api/disconnect-client", {
      method: "POST",
      body: JSON.stringify({ clientId }),
    });

    if (response.success) {
      alert("客户端连接已断开！");
      loadConnectedClients();
      loadStats();
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error("断开客户端失败:", error);
    alert("操作失败: " + error.message);
  }
}

// 加载用户管理数据
async function loadUsers() {
  // 添加加载状态
  const refreshBtn = document.querySelector('button[onclick="loadUsers()"]');
  const originalText = refreshBtn ? refreshBtn.innerHTML : "";
  if (refreshBtn) {
    refreshBtn.innerHTML = "🔄 刷新中...";
    refreshBtn.disabled = true;
  }

  try {
    // 使用新的用户API
    const usersData = await apiRequest("/api/users");

    if (usersData.success) {
      renderUsersTable(usersData.data);
    }
  } catch (error) {
    console.error("加载用户数据失败:", error);
    document.getElementById("usersTable").innerHTML = `
      <div class="alert alert-error">加载失败: ${error.message}</div>
    `;
  } finally {
    // 恢复按钮状态
    if (refreshBtn) {
      refreshBtn.innerHTML = originalText;
      refreshBtn.disabled = false;
    }
  }
}

// 渲染用户管理表格
function renderUsersTable(users) {
  const table = document.getElementById("usersTable");

  if (users.length === 0) {
    table.innerHTML = '<div class="alert alert-info">暂无用户数据</div>';
    return;
  }

  const tableHTML = `
    <table class="data-table users-table">
      <thead>
        <tr>
          <th>设备ID</th>
          <th>激活码</th>
          <th>激活时间</th>
          <th>过期时间</th>
          <th>状态</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${users
          .map((user) => {
            const isExpired = new Date(user.expiresAt) < new Date();
            const statusClass = user.isOnline ? "active" : "inactive";
            const activationStatus =
              user.status === "used" && !isExpired
                ? "已激活"
                : user.status === "revoked"
                ? "已撤销"
                : user.status === "inactive"
                ? "已禁用"
                : isExpired
                ? "已过期"
                : "未知";

            // 截断长设备ID和激活码用于显示
            const shortDeviceId =
              user.deviceId.length > 20
                ? user.deviceId.substring(0, 20) + "..."
                : user.deviceId;
            const shortActivationCode =
              user.activationCode.length > 15
                ? user.activationCode.substring(0, 15) + "..."
                : user.activationCode;

            return `
            <tr>
              <td>
                <div class="code-container">
                  <code class="device-id"${
                    shortDeviceId !== user.deviceId
                      ? ` title="${user.deviceId}"`
                      : ""
                  }>${shortDeviceId}</code>
                  <button onclick="copyToClipboard('${user.deviceId.replace(
                    /'/g,
                    "\\'"
                  )}')" class="btn-small">复制</button>
                </div>
              </td>
              <td>
                <div class="code-container">
                  <code class="code-text"${
                    shortActivationCode !== user.activationCode
                      ? ` title="${user.activationCode}"`
                      : ""
                  }>${shortActivationCode}</code>
                  <button onclick="copyToClipboard('${user.activationCode.replace(
                    /'/g,
                    "\\'"
                  )}')" class="btn-small">复制</button>
                </div>
              </td>
              <td>
                <span class="datetime-text">${formatDateTime(
                  user.activatedAt
                )}</span>
              </td>
              <td>
                <span class="datetime-text">${formatDateTime(
                  user.expiresAt
                )}</span>
              </td>
              <td>
                <div class="status-container">
                  <span class="status-badge status-${statusClass}">
                    ${user.isOnline ? "在线" : "离线"}
                  </span>
                  <span class="status-badge status-${user.status}">
                    ${activationStatus}
                  </span>
                </div>
              </td>
              <td>
                <div class="action-container">
                  <button onclick="viewUserDetails('${
                    user.deviceId
                  }')" class="btn-small btn-secondary">详情</button>
                  ${
                    user.status === "used"
                      ? `<button onclick="toggleUserStatus('${user.deviceId}', 'disable')" class="btn-small btn-warning">禁用</button>`
                      : `<button onclick="toggleUserStatus('${user.deviceId}', 'enable')" class="btn-small btn-success">启用</button>`
                  }
                  <button onclick="sendUserNotification('${
                    user.deviceId
                  }')" class="btn-small btn-secondary">通知</button>
                </div>
              </td>
            </tr>
          `;
          })
          .join("")}
      </tbody>
    </table>
  `;

  table.innerHTML = tableHTML;
}

// 查看用户详情
function viewUserDetails(deviceId) {
  alert(`查看用户详情功能开发中...\n设备ID: ${deviceId}`);
}

// 切换用户状态（启用/禁用）
async function toggleUserStatus(deviceId, action) {
  const actionText = action === "disable" ? "禁用" : "启用";
  if (!confirm(`确定要${actionText}设备 ${deviceId} 吗？`)) {
    return;
  }

  try {
    const response = await apiRequest(`/api/users/${deviceId}/toggle`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });

    if (response.success) {
      alert(`用户${actionText}成功！`);
      loadUsers(); // 刷新用户列表
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error(`${actionText}用户失败:`, error);
    alert(`操作失败: ${error.message}`);
  }
}

// 发送用户通知
async function sendUserNotification(deviceId) {
  const title = prompt("请输入通知标题:");
  if (!title) return;

  const message = prompt("请输入通知内容:");
  if (!message) return;

  const type = prompt("请输入通知类型 (info/warning/error):", "info");

  try {
    const response = await apiRequest("/api/send-notification", {
      method: "POST",
      body: JSON.stringify({
        deviceId: deviceId,
        title: title,
        message: message,
        type: type || "info",
      }),
    });

    if (response.success) {
      alert("通知发送成功！");
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error("发送通知失败:", error);
    alert("发送失败: " + error.message);
  }
}

// 广播消息
function broadcastMessage() {
  const message = prompt("请输入要广播的消息:");
  if (message && message.trim()) {
    sendBroadcastMessage(message.trim());
  }
}

// 发送广播消息
async function sendBroadcastMessage(message) {
  try {
    const response = await apiRequest("/api/broadcast", {
      method: "POST",
      body: JSON.stringify({ message }),
    });

    if (response.success) {
      alert("消息广播成功！");
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error("广播消息失败:", error);
    alert("广播失败: " + error.message);
  }
}
