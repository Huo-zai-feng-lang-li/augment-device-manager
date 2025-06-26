// 设置控制台编码
process.stdout.setEncoding("utf8");
if (process.platform === "win32") {
  process.stdout.write("\x1b]0;Augment设备管理器后端服务\x07");
}

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const WebSocket = require("ws");
const http = require("http");

const {
  generateActivationCode,
  validateActivationCode,
  generateDeviceFingerprint,
} = require("../../shared/crypto/encryption");

const app = express();
const PORT = process.env.PORT || 3002;
const JWT_SECRET = "augment-admin-jwt-secret-2024";
const DATA_FILE = path.join(__dirname, "../data/store.json");

// 确保数据目录存在
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 默认数据结构
const defaultStore = {
  admins: [
    {
      id: 1,
      username: "admin",
      password_hash: bcrypt.hashSync("admin123", 10),
    },
  ],
  activationCodes: [],
  usageLogs: [],
};

// 加载数据
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, "utf8");
      const loadedData = JSON.parse(data);

      // 确保数据结构完整
      return {
        admins: loadedData.admins || defaultStore.admins,
        activationCodes: loadedData.activationCodes || [],
        usageLogs: loadedData.usageLogs || [],
      };
    }
  } catch (error) {
    console.error("加载数据失败:", error);
  }
  return defaultStore;
}

// 保存数据
function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error("保存数据失败:", error);
    return false;
  }
}

// 初始化数据存储
let memoryStore = loadData();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// JWT验证中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "访问令牌缺失" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "访问令牌无效" });
    }
    req.user = user;
    next();
  });
};

// 健康检查接口
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 登录接口
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const admin = memoryStore.admins.find((a) => a.username === username);
    if (!admin) {
      return res.status(401).json({ error: "用户名或密码错误" });
    }

    const validPassword = bcrypt.compareSync(password, admin.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: "用户名或密码错误" });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: admin.id,
        username: admin.username,
      },
    });
  } catch (error) {
    console.error("登录错误:", error);
    res.status(500).json({ error: "服务器错误" });
  }
});

// 生成激活码
app.post("/api/activation-codes", authenticateToken, async (req, res) => {
  try {
    const { deviceId, expiryDays, notes } = req.body;

    // 生成激活码
    const code = generateActivationCode(deviceId, expiryDays || 30);

    // 计算过期时间
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expiryDays || 30));

    // 保存到内存
    const activationCode = {
      id: memoryStore.activationCodes.length + 1,
      code: code,
      device_id: deviceId || null,
      created_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      used_at: null,
      used_by_device: null,
      status: "active",
      notes: notes || "",
    };

    memoryStore.activationCodes.push(activationCode);

    // 记录操作日志
    memoryStore.usageLogs.push({
      id: memoryStore.usageLogs.length + 1,
      activation_code: code,
      device_id: "admin",
      action: "created",
      timestamp: new Date().toISOString(),
      details: "管理员创建激活码",
    });

    // 保存数据到文件
    saveData(memoryStore);

    res.json({
      success: true,
      data: {
        id: activationCode.id,
        code: activationCode.code,
        expiresAt: activationCode.expires_at,
      },
    });
  } catch (error) {
    console.error("生成激活码错误:", error);
    res.status(500).json({ error: "生成激活码失败" });
  }
});

// 获取所有激活码
app.get("/api/activation-codes", authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: memoryStore.activationCodes,
    });
  } catch (error) {
    console.error("获取激活码错误:", error);
    res.status(500).json({ error: "获取激活码失败" });
  }
});

// 验证激活码（客户端调用）
app.post("/api/validate-code", async (req, res) => {
  try {
    const { code, deviceId } = req.body;

    if (!code || !deviceId) {
      return res.status(400).json({ error: "激活码和设备ID不能为空" });
    }

    // 验证激活码
    const validation = validateActivationCode(code, deviceId);

    if (validation.valid) {
      // 更新使用状态
      const activationCode = memoryStore.activationCodes.find(
        (c) => c.code === code
      );
      if (activationCode) {
        activationCode.status = "used";
        activationCode.used_at = new Date().toISOString();
        activationCode.used_by_device = deviceId;
      }

      // 记录使用日志
      memoryStore.usageLogs.push({
        id: memoryStore.usageLogs.length + 1,
        activation_code: code,
        device_id: deviceId,
        action: "activated",
        timestamp: new Date().toISOString(),
        details: "激活码验证成功",
      });

      // 保存数据到文件
      saveData(memoryStore);

      res.json({
        success: true,
        message: "激活成功",
        expiresAt: validation.expiresAt,
      });
    } else {
      // 记录失败日志
      memoryStore.usageLogs.push({
        id: memoryStore.usageLogs.length + 1,
        activation_code: code,
        device_id: deviceId,
        action: "failed",
        timestamp: new Date().toISOString(),
        details: validation.reason,
      });

      // 保存数据到文件
      saveData(memoryStore);

      res.status(400).json({
        success: false,
        error: validation.reason,
      });
    }
  } catch (error) {
    console.error("验证激活码错误:", error);
    res.status(500).json({ error: "验证失败" });
  }
});

// 获取使用记录
app.get("/api/usage-logs", authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: memoryStore.usageLogs.slice(-200), // 最近200条记录
    });
  } catch (error) {
    console.error("获取使用记录错误:", error);
    res.status(500).json({ error: "获取使用记录失败" });
  }
});

// 获取统计信息
app.get("/api/stats", authenticateToken, async (req, res) => {
  try {
    const codes = memoryStore.activationCodes;
    const logs = memoryStore.usageLogs;

    const stats = {
      totalCodes: codes.length,
      activeCodes: codes.filter((c) => c.status === "active").length,
      usedCodes: codes.filter((c) => c.status === "used").length,
      expiredCodes: codes.filter((c) => new Date(c.expires_at) < new Date())
        .length,
      totalUsage: logs.length,
      recentUsage: logs.filter((l) => {
        const logDate = new Date(l.timestamp);
        const dayAgo = new Date();
        dayAgo.setDate(dayAgo.getDate() - 1);
        return logDate > dayAgo;
      }).length,
      connectedClients: connectedClients.size,
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("获取统计信息错误:", error);
    res.status(500).json({ error: "获取统计信息失败" });
  }
});

// 获取连接的客户端列表
app.get("/api/connected-clients", authenticateToken, async (req, res) => {
  try {
    const clients = Array.from(connectedClients.values()).map((client) => ({
      deviceId: client.deviceId,
      connectedAt: client.connectedAt,
      status: client.ws.readyState === 1 ? "connected" : "disconnected",
    }));

    res.json({
      success: true,
      data: clients,
    });
  } catch (error) {
    console.error("获取客户端列表错误:", error);
    res.status(500).json({ error: "获取客户端列表失败" });
  }
});

// 向客户端发送命令
app.post("/api/send-command", authenticateToken, async (req, res) => {
  try {
    const { deviceId, command, data } = req.body;

    if (!command) {
      return res.status(400).json({ error: "命令不能为空" });
    }

    const message = {
      type: "command",
      command: command,
      data: data || {},
      timestamp: new Date().toISOString(),
    };

    if (deviceId) {
      // 发送给特定客户端
      const success = sendToClient(deviceId, message);
      if (success) {
        res.json({
          success: true,
          message: `命令已发送给客户端 ${deviceId}`,
        });
      } else {
        res.status(404).json({
          success: false,
          error: `客户端 ${deviceId} 未连接`,
        });
      }
    } else {
      // 广播给所有客户端
      broadcastToClients(message);
      res.json({
        success: true,
        message: `命令已广播给所有客户端 (${connectedClients.size} 个)`,
      });
    }
  } catch (error) {
    console.error("发送命令错误:", error);
    res.status(500).json({ error: "发送命令失败" });
  }
});

// 向客户端发送通知
app.post("/api/send-notification", authenticateToken, async (req, res) => {
  try {
    const { deviceId, title, message, type = "info" } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: "标题和消息不能为空" });
    }

    const notification = {
      type: "notification",
      title: title,
      message: message,
      notificationType: type,
      timestamp: new Date().toISOString(),
    };

    if (deviceId) {
      // 发送给特定客户端
      const success = sendToClient(deviceId, notification);
      if (success) {
        res.json({
          success: true,
          message: `通知已发送给客户端 ${deviceId}`,
        });
      } else {
        res.status(404).json({
          success: false,
          error: `客户端 ${deviceId} 未连接`,
        });
      }
    } else {
      // 广播给所有客户端
      broadcastToClients(notification);
      res.json({
        success: true,
        message: `通知已广播给所有客户端 (${connectedClients.size} 个)`,
      });
    }
  } catch (error) {
    console.error("发送通知错误:", error);
    res.status(500).json({ error: "发送通知失败" });
  }
});

// 实时验证激活码状态（客户端定期调用）
app.post("/api/verify-activation", async (req, res) => {
  try {
    const { code, deviceId } = req.body;

    if (!code || !deviceId) {
      return res.status(400).json({
        success: false,
        error: "激活码和设备ID不能为空",
        valid: false,
      });
    }

    // 查找激活码
    const activationCode = memoryStore.activationCodes.find(
      (c) => c.code === code
    );

    if (!activationCode) {
      return res.json({
        success: true,
        valid: false,
        reason: "激活码不存在或已被删除",
      });
    }

    // 检查激活码状态
    if (activationCode.status === "revoked") {
      return res.json({
        success: true,
        valid: false,
        reason: "激活码已被撤销",
      });
    }

    if (activationCode.status === "expired") {
      return res.json({
        success: true,
        valid: false,
        reason: "激活码已过期",
      });
    }

    // 检查过期时间
    const now = new Date();
    const expiry = new Date(activationCode.expires_at);
    if (now > expiry) {
      // 自动标记为过期
      activationCode.status = "expired";
      saveData(memoryStore);

      return res.json({
        success: true,
        valid: false,
        reason: "激活码已过期",
      });
    }

    // 检查设备绑定
    if (
      activationCode.used_by_device &&
      activationCode.used_by_device !== deviceId
    ) {
      return res.json({
        success: true,
        valid: false,
        reason: "设备不匹配",
      });
    }

    // 验证通过
    return res.json({
      success: true,
      valid: true,
      expiresAt: activationCode.expires_at,
      status: activationCode.status,
    });
  } catch (error) {
    console.error("验证激活状态错误:", error);
    res.status(500).json({
      success: false,
      error: "验证失败",
      valid: false,
    });
  }
});

// 撤销激活码
app.post("/api/revoke-activation", authenticateToken, async (req, res) => {
  try {
    const { code, reason = "管理员撤销" } = req.body;

    if (!code) {
      return res.status(400).json({ error: "激活码不能为空" });
    }

    const activationCode = memoryStore.activationCodes.find(
      (c) => c.code === code
    );

    if (!activationCode) {
      return res.status(404).json({ error: "激活码不存在" });
    }

    // 更新状态为撤销
    activationCode.status = "revoked";
    activationCode.revoked_at = new Date().toISOString();
    activationCode.revoke_reason = reason;

    // 记录撤销日志
    memoryStore.usageLogs.push({
      id: memoryStore.usageLogs.length + 1,
      activation_code: code,
      device_id: "admin",
      action: "revoked",
      timestamp: new Date().toISOString(),
      details: `管理员撤销激活码: ${reason}`,
    });

    // 保存数据
    saveData(memoryStore);

    // 通知相关客户端
    if (activationCode.used_by_device) {
      const invalidateMessage = {
        type: "activation_revoked",
        code: code,
        reason: reason,
        timestamp: new Date().toISOString(),
      };

      sendToClient(activationCode.used_by_device, invalidateMessage);
    }

    res.json({
      success: true,
      message: "激活码已撤销",
      data: {
        code: code,
        revokedAt: activationCode.revoked_at,
        reason: reason,
      },
    });
  } catch (error) {
    console.error("撤销激活码错误:", error);
    res.status(500).json({ error: "撤销失败" });
  }
});

// 删除激活码
app.delete(
  "/api/activation-codes/:code",
  authenticateToken,
  async (req, res) => {
    try {
      const { code } = req.params;
      const { force = false } = req.query;

      const codeIndex = memoryStore.activationCodes.findIndex(
        (c) => c.code === code
      );

      if (codeIndex === -1) {
        return res.status(404).json({ error: "激活码不存在" });
      }

      const activationCode = memoryStore.activationCodes[codeIndex];

      // 如果激活码正在使用且未强制删除，先撤销
      if (activationCode.status === "used" && !force) {
        return res.status(400).json({
          error: "激活码正在使用中，请先撤销或使用force=true强制删除",
        });
      }

      // 通知客户端激活码被删除
      if (activationCode.used_by_device) {
        const deleteMessage = {
          type: "activation_deleted",
          code: code,
          timestamp: new Date().toISOString(),
        };

        sendToClient(activationCode.used_by_device, deleteMessage);
      }

      // 删除激活码
      memoryStore.activationCodes.splice(codeIndex, 1);

      // 记录删除日志
      memoryStore.usageLogs.push({
        id: memoryStore.usageLogs.length + 1,
        activation_code: code,
        device_id: "admin",
        action: "deleted",
        timestamp: new Date().toISOString(),
        details: `管理员删除激活码${force ? " (强制删除)" : ""}`,
      });

      // 保存数据
      saveData(memoryStore);

      res.json({
        success: true,
        message: "激活码已删除",
      });
    } catch (error) {
      console.error("删除激活码错误:", error);
      res.status(500).json({ error: "删除失败" });
    }
  }
);

// 静态文件路由
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// 创建HTTP服务器
const server = http.createServer(app);

// 创建WebSocket服务器
const wss = new WebSocket.Server({ server, path: "/ws" });

// 存储连接的客户端
const connectedClients = new Map();

// WebSocket连接处理
wss.on("connection", (ws, req) => {
  console.log("客户端WebSocket连接已建立");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === "register") {
        // 客户端注册
        connectedClients.set(data.deviceId, {
          ws: ws,
          deviceId: data.deviceId,
          connectedAt: new Date().toISOString(),
        });
        console.log(`客户端已注册: ${data.deviceId}`);

        ws.send(
          JSON.stringify({
            type: "registered",
            success: true,
            message: "连接已建立",
          })
        );
      }
    } catch (error) {
      console.error("WebSocket消息处理错误:", error);
    }
  });

  ws.on("close", () => {
    // 移除断开连接的客户端
    for (const [deviceId, client] of connectedClients.entries()) {
      if (client.ws === ws) {
        connectedClients.delete(deviceId);
        console.log(`客户端已断开连接: ${deviceId}`);
        break;
      }
    }
  });

  ws.on("error", (error) => {
    console.error("WebSocket错误:", error);
  });
});

// 广播消息给所有连接的客户端
function broadcastToClients(message) {
  connectedClients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  });
}

// 发送消息给特定客户端
function sendToClient(deviceId, message) {
  const client = connectedClients.get(deviceId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(message));
    return true;
  }
  return false;
}

// 启动服务器
server.listen(PORT, () => {
  console.log(`激活码管理后台运行在 http://localhost:${PORT}`);
  console.log(`WebSocket服务运行在 ws://localhost:${PORT}/ws`);
  console.log("默认管理员账户: admin / admin123");
  console.log(`数据存储: ${DATA_FILE}`);
  console.log(
    `已加载 ${memoryStore.activationCodes.length} 个激活码，${memoryStore.usageLogs.length} 条使用记录`
  );
});

// 优雅关闭
process.on("SIGINT", () => {
  console.log("正在关闭服务器...");
  process.exit(0);
});

module.exports = app;
