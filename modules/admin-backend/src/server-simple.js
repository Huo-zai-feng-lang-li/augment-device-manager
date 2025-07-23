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
const { exec } = require("child_process");
const os = require("os");

const ServerBeijingTimeAPI = require("./beijing-time-api");
const {
  generateActivationCode,
  validateActivationCode,
  generateDeviceFingerprint,
} = require("../../../shared/crypto/encryption-simple");

// 全局时间API实例
const globalTimeAPI = new ServerBeijingTimeAPI();

// 辅助函数：获取在线时间戳（允许回退到本地时间）
async function getTimestamp() {
  try {
    const onlineTime = await globalTimeAPI.getBeijingTime();
    return onlineTime.toISOString();
  } catch (error) {
    console.warn("⚠️ 获取在线时间失败，使用本地时间:", error.message);
    return new Date().toISOString();
  }
}

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
  broadcastHistory: [], // 广播消息历史
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
        broadcastHistory: loadedData.broadcastHistory || [],
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

// 客户端激活验证中间件
const authenticateActivation = async (req, res, next) => {
  try {
    const { code, deviceId } = req.body;

    if (!code || !deviceId) {
      return res.status(400).json({
        success: false,
        error: "激活码和设备ID不能为空",
        requireActivation: true,
      });
    }

    // 查找激活码
    const activationCode = memoryStore.activationCodes.find(
      (c) => c.code === code
    );

    if (!activationCode) {
      return res.status(403).json({
        success: false,
        error: "激活码不存在",
        requireActivation: true,
      });
    }

    // 检查激活码状态
    if (activationCode.status === "revoked") {
      return res.status(403).json({
        success: false,
        error: "激活码已被撤销",
        requireActivation: true,
      });
    }

    if (activationCode.status === "inactive") {
      return res.status(403).json({
        success: false,
        error: "激活码已被禁用",
        requireActivation: true,
      });
    }

    // 使用在线时间检查过期状态
    const serverTimeAPI = new ServerBeijingTimeAPI();
    try {
      const expirationCheck = await serverTimeAPI.validateExpiration(
        activationCode.expires_at
      );

      if (!expirationCheck.valid) {
        if (expirationCheck.expired) {
          // 激活码已过期
          activationCode.status = "expired";
          saveData(memoryStore);
          return res.status(403).json({
            success: false,
            error: "激活码已过期",
            requireActivation: true,
          });
        } else if (expirationCheck.serverSecurityBlock) {
          // 服务端网络时间验证失败
          return res.status(503).json({
            success: false,
            error: "服务端时间验证失败，请稍后重试",
            networkError: true,
          });
        }
      }

      console.log("✅ 服务端激活码验证通过 - 基于在线北京时间");
    } catch (error) {
      console.error("服务端时间验证异常:", error.message);
      return res.status(503).json({
        success: false,
        error: "服务端时间验证异常，请稍后重试",
        networkError: true,
      });
    }

    // 检查设备绑定
    if (
      activationCode.used_by_device &&
      activationCode.used_by_device !== deviceId
    ) {
      return res.status(403).json({
        success: false,
        error: "激活码已绑定其他设备",
        requireActivation: true,
      });
    }

    // 进行格式验证
    const formatValidation = validateActivationCode(code, deviceId);
    if (!formatValidation.valid) {
      return res.status(403).json({
        success: false,
        error: formatValidation.reason,
        requireActivation: true,
      });
    }

    // 将激活信息添加到请求对象
    req.activation = {
      code: activationCode,
      deviceId: deviceId,
      permissions: await getActivationPermissions(activationCode),
    };

    next();
  } catch (error) {
    console.error("激活验证失败:", error);
    res.status(500).json({
      success: false,
      error: "验证失败",
      requireActivation: true,
    });
  }
};

// 健康检查接口
app.get("/api/health", async (req, res) => {
  const timestamp = await getTimestamp();
  res.json({ status: "ok", timestamp });
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

    // 使用在线时间计算过期时间
    const serverTimeAPI = new ServerBeijingTimeAPI();
    const currentTime = await serverTimeAPI.getBeijingTime();
    const expiresAt = new Date(
      currentTime.getTime() + (expiryDays || 30) * 24 * 60 * 60 * 1000
    );

    // 保存到内存
    const activationCode = {
      id: memoryStore.activationCodes.length + 1,
      code: code,
      device_id: deviceId || null,
      created_at: currentTime.toISOString(),
      expires_at: expiresAt.toISOString(),
      used_at: null,
      used_by_device: null,
      status: "active",
      notes: notes || "",
    };

    memoryStore.activationCodes.push(activationCode);

    // 记录操作日志（使用在线时间）
    memoryStore.usageLogs.push({
      id: memoryStore.usageLogs.length + 1,
      activation_code: code,
      device_id: "admin",
      action: "created",
      timestamp: currentTime.toISOString(),
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

// 删除激活码
app.delete("/api/activation-codes/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const codeIndex = memoryStore.activationCodes.findIndex((c) => c.id == id);

    if (codeIndex === -1) {
      return res.status(404).json({ error: "激活码不存在" });
    }

    const deletedCode = memoryStore.activationCodes.splice(codeIndex, 1)[0];

    // 记录删除日志
    memoryStore.usageLogs.push({
      id: memoryStore.usageLogs.length + 1,
      activation_code: deletedCode.code,
      device_id: "admin",
      action: "deleted",
      timestamp: new Date().toISOString(),
      details: "管理员删除激活码",
    });

    // 通知相关客户端激活已被删除
    if (deletedCode.used_by_device) {
      const message = {
        type: "activation_deleted",
        code: deletedCode.code,
        reason: "激活码已被管理员删除",
        timestamp: new Date().toISOString(),
      };
      sendToClient(deletedCode.used_by_device, message);
    }

    saveData(memoryStore);

    res.json({
      success: true,
      message: "激活码删除成功",
    });
  } catch (error) {
    console.error("删除激活码错误:", error);
    res.status(500).json({ error: "删除激活码失败" });
  }
});

// 撤销激活码
app.post(
  "/api/activation-codes/:id/revoke",
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const code = memoryStore.activationCodes.find((c) => c.id == id);

      if (!code) {
        return res.status(404).json({ error: "激活码不存在" });
      }

      if (code.status === "revoked") {
        return res.status(400).json({ error: "激活码已被撤销" });
      }

      // 更新状态
      code.status = "revoked";
      code.revoked_at = new Date().toISOString();
      code.revoke_reason = reason || "管理员撤销";

      // 记录撤销日志
      memoryStore.usageLogs.push({
        id: memoryStore.usageLogs.length + 1,
        activation_code: code.code,
        device_id: "admin",
        action: "revoked",
        timestamp: new Date().toISOString(),
        details: `管理员撤销激活码: ${reason || "无原因"}`,
      });

      // 通知相关客户端激活已被撤销
      if (code.used_by_device) {
        const message = {
          type: "activation_revoked",
          code: code.code,
          reason: reason || "激活码已被管理员撤销",
          timestamp: new Date().toISOString(),
        };
        sendToClient(code.used_by_device, message);
      }

      saveData(memoryStore);

      res.json({
        success: true,
        message: "激活码撤销成功",
      });
    } catch (error) {
      console.error("撤销激活码错误:", error);
      res.status(500).json({ error: "撤销激活码失败" });
    }
  }
);

// 更新激活码
app.put("/api/activation-codes/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const code = memoryStore.activationCodes.find((c) => c.id == id);

    if (!code) {
      return res.status(404).json({ error: "激活码不存在" });
    }

    if (notes !== undefined) {
      code.notes = notes;
    }

    saveData(memoryStore);

    res.json({
      success: true,
      message: "激活码更新成功",
    });
  } catch (error) {
    console.error("更新激活码错误:", error);
    res.status(500).json({ error: "更新激活码失败" });
  }
});

// 验证激活码（客户端调用）
app.post("/api/validate-code", async (req, res) => {
  try {
    const { code, deviceId } = req.body;

    if (!code || !deviceId) {
      return res.status(400).json({ error: "激活码和设备ID不能为空" });
    }

    // 先进行格式验证
    const formatValidation = validateActivationCode(code, deviceId);
    if (!formatValidation.valid) {
      // 记录失败日志
      memoryStore.usageLogs.push({
        id: memoryStore.usageLogs.length + 1,
        activation_code: code,
        device_id: deviceId,
        action: "failed",
        timestamp: new Date().toISOString(),
        details: formatValidation.reason,
      });
      saveData(memoryStore);

      return res.status(400).json({
        success: false,
        error: formatValidation.reason,
      });
    }

    // 从内存存储查询激活码状态
    const activationCode = memoryStore.activationCodes.find(
      (c) => c.code === code
    );

    if (!activationCode) {
      // 记录失败日志
      memoryStore.usageLogs.push({
        id: memoryStore.usageLogs.length + 1,
        activation_code: code,
        device_id: deviceId,
        action: "failed",
        timestamp: new Date().toISOString(),
        details: "激活码不存在",
      });
      saveData(memoryStore);

      return res.status(400).json({
        success: false,
        error: "激活码不存在",
      });
    }

    // 检查激活码状态
    if (activationCode.status === "revoked") {
      // 记录失败日志
      memoryStore.usageLogs.push({
        id: memoryStore.usageLogs.length + 1,
        activation_code: code,
        device_id: deviceId,
        action: "failed",
        timestamp: new Date().toISOString(),
        details: "激活码已被撤销",
      });
      saveData(memoryStore);

      return res.status(400).json({
        success: false,
        error: "激活码已被撤销",
      });
    }

    if (activationCode.status === "inactive") {
      // 记录失败日志
      memoryStore.usageLogs.push({
        id: memoryStore.usageLogs.length + 1,
        activation_code: code,
        device_id: deviceId,
        action: "failed",
        timestamp: new Date().toISOString(),
        details: "激活码已被禁用",
      });
      saveData(memoryStore);

      return res.status(400).json({
        success: false,
        error: "激活码已被禁用",
      });
    }

    // 使用在线时间检查过期状态
    const serverTimeAPI = new ServerBeijingTimeAPI();
    try {
      const expirationCheck = await serverTimeAPI.validateExpiration(
        activationCode.expires_at
      );

      if (!expirationCheck.valid) {
        if (expirationCheck.expired) {
          // 激活码已过期
          activationCode.status = "expired";

          // 记录失败日志
          memoryStore.usageLogs.push({
            id: memoryStore.usageLogs.length + 1,
            activation_code: code,
            device_id: deviceId,
            action: "failed",
            timestamp: new Date().toISOString(),
            details: "激活码已过期（基于在线时间）",
          });
          saveData(memoryStore);

          return res.status(400).json({
            success: false,
            error: "激活码已过期",
          });
        } else if (expirationCheck.serverSecurityBlock) {
          // 服务端网络时间验证失败
          memoryStore.usageLogs.push({
            id: memoryStore.usageLogs.length + 1,
            activation_code: code,
            device_id: deviceId,
            action: "failed",
            timestamp: new Date().toISOString(),
            details: "服务端时间验证失败",
          });
          saveData(memoryStore);

          return res.status(503).json({
            success: false,
            error: "服务端时间验证失败，请稍后重试",
            networkError: true,
          });
        }
      }

      console.log("✅ 服务端激活码验证通过 - 基于在线北京时间");
    } catch (error) {
      console.error("服务端时间验证异常:", error.message);

      // 记录异常日志
      memoryStore.usageLogs.push({
        id: memoryStore.usageLogs.length + 1,
        activation_code: code,
        device_id: deviceId,
        action: "failed",
        timestamp: new Date().toISOString(),
        details: "服务端时间验证异常: " + error.message,
      });
      saveData(memoryStore);

      return res.status(503).json({
        success: false,
        error: "服务端时间验证异常，请稍后重试",
        networkError: true,
      });
    }

    // 检查设备绑定（如果已被其他设备使用）
    if (
      activationCode.used_by_device &&
      activationCode.used_by_device !== deviceId
    ) {
      // 检查是否是设备清理后的重新绑定情况
      // 如果激活码状态是 "used" 且最近验证过，允许更新设备绑定
      const lastVerified = activationCode.last_verified_at
        ? new Date(activationCode.last_verified_at)
        : null;
      const now = new Date();
      const timeSinceLastVerified = lastVerified
        ? (now - lastVerified) / 1000 / 60
        : Infinity; // 分钟

      if (activationCode.status === "used" && timeSinceLastVerified < 1440) {
        // 24小时内验证过的激活码，允许更新设备绑定（设备清理场景）
        console.log(
          `允许设备ID更新: ${activationCode.used_by_device} -> ${deviceId}`
        );

        // 记录设备更新日志
        memoryStore.usageLogs.push({
          id: memoryStore.usageLogs.length + 1,
          activation_code: code,
          device_id: deviceId,
          action: "device_updated",
          timestamp: new Date().toISOString(),
          details: `设备ID从 ${activationCode.used_by_device} 更新为 ${deviceId}`,
        });

        // 更新设备绑定
        activationCode.used_by_device = deviceId;
        activationCode.last_verified_at = new Date().toISOString();
        saveData(memoryStore);

        // 记录成功日志
        memoryStore.usageLogs.push({
          id: memoryStore.usageLogs.length + 1,
          activation_code: code,
          device_id: deviceId,
          action: "reactivated",
          timestamp: new Date().toISOString(),
          details: "设备清理后重新激活成功",
        });
        saveData(memoryStore);

        return res.json({
          success: true,
          message: "设备清理后重新激活成功",
          expiresAt: activationCode.expires_at,
        });
      } else {
        // 记录失败日志
        memoryStore.usageLogs.push({
          id: memoryStore.usageLogs.length + 1,
          activation_code: code,
          device_id: deviceId,
          action: "failed",
          timestamp: new Date().toISOString(),
          details: "激活码已绑定其他设备",
        });
        saveData(memoryStore);

        return res.status(400).json({
          success: false,
          error: "激活码已绑定其他设备",
        });
      }
    }

    // 验证通过，更新使用状态
    activationCode.status = "used";
    activationCode.used_at = new Date().toISOString();
    activationCode.used_by_device = deviceId;

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
      expiresAt: activationCode.expires_at,
    });
  } catch (error) {
    console.error("验证激活码错误:", error);
    res.status(500).json({ error: "验证失败" });
  }
});

// 验证激活状态（客户端实时验证调用）
app.post("/api/verify-activation", async (req, res) => {
  try {
    const { code, deviceId } = req.body;

    if (!code || !deviceId) {
      return res.status(400).json({
        success: false,
        valid: false,
        reason: "激活码和设备ID不能为空",
      });
    }

    // 查找激活码
    const activationCode = memoryStore.activationCodes.find(
      (c) => c.code === code
    );

    if (!activationCode) {
      return res.json({
        success: false,
        valid: false,
        reason: "激活码不存在",
      });
    }

    // 检查激活码状态
    if (activationCode.status === "revoked") {
      return res.json({
        success: false,
        valid: false,
        reason: "激活码已被撤销",
      });
    }

    if (activationCode.status === "inactive") {
      return res.json({
        success: false,
        valid: false,
        reason: "激活码已被禁用",
      });
    }

    // 使用在线时间检查过期状态
    const serverTimeAPI = new ServerBeijingTimeAPI();
    try {
      const expirationCheck = await serverTimeAPI.validateExpiration(
        activationCode.expires_at
      );

      if (!expirationCheck.valid) {
        if (expirationCheck.expired) {
          // 激活码已过期
          activationCode.status = "expired";
          saveData(memoryStore);

          return res.json({
            success: false,
            valid: false,
            reason: "激活码已过期",
          });
        } else if (expirationCheck.serverSecurityBlock) {
          // 服务端网络时间验证失败
          return res.json({
            success: false,
            valid: false,
            reason: "服务端时间验证失败，请稍后重试",
            networkError: true,
          });
        }
      }

      console.log("✅ 服务端激活码验证通过 - 基于在线北京时间");
    } catch (error) {
      console.error("服务端时间验证异常:", error.message);
      return res.json({
        success: false,
        valid: false,
        reason: "服务端时间验证异常，请稍后重试",
        networkError: true,
      });
    }

    // 检查设备绑定
    if (
      activationCode.used_by_device &&
      activationCode.used_by_device !== deviceId
    ) {
      // 检查是否允许设备ID更新（24小时内验证过的激活码）
      const lastVerified = activationCode.last_verified_at
        ? new Date(activationCode.last_verified_at)
        : null;
      const now = new Date();
      const timeSinceLastVerified = lastVerified
        ? (now - lastVerified) / 1000 / 60
        : Infinity; // 分钟

      if (timeSinceLastVerified < 1440) {
        // 24小时内验证过，允许设备ID更新
        console.log(
          `验证时允许设备ID更新: ${activationCode.used_by_device} -> ${deviceId}`
        );

        // 记录设备更新日志
        memoryStore.usageLogs.push({
          id: memoryStore.usageLogs.length + 1,
          activation_code: code,
          device_id: deviceId,
          action: "device_updated_on_verify",
          timestamp: new Date().toISOString(),
          details: `验证时设备ID从 ${activationCode.used_by_device} 更新为 ${deviceId}`,
        });

        // 更新设备绑定
        activationCode.used_by_device = deviceId;
      } else {
        return res.json({
          success: false,
          valid: false,
          reason: "激活码已绑定其他设备",
        });
      }
    }

    // 更新最后验证时间
    activationCode.last_verified_at = new Date().toISOString();
    saveData(memoryStore);

    // 验证通过
    res.json({
      success: true,
      valid: true,
      expiresAt: activationCode.expires_at,
      status: activationCode.status,
      permissions: await getActivationPermissions(activationCode),
    });
  } catch (error) {
    console.error("验证激活状态错误:", error);
    res.status(500).json({
      success: false,
      valid: false,
      reason: "服务器错误",
    });
  }
});

// 获取激活码权限
async function getActivationPermissions(activationCode) {
  const permissions = {
    canCleanup: false,
    canUpdate: false,
    canExport: false,
  };

  // 只有状态为 "used" 且未过期的激活码才有权限
  if (activationCode.status === "used") {
    try {
      const serverTimeAPI = new ServerBeijingTimeAPI();
      const expirationCheck = await serverTimeAPI.validateExpiration(
        activationCode.expires_at
      );

      if (expirationCheck.valid && !expirationCheck.expired) {
        permissions.canCleanup = true;
        permissions.canUpdate = true;
        permissions.canExport = true;
      }
    } catch (error) {
      console.warn("权限检查时间验证失败:", error.message);
      // 网络失败时不给予权限，确保安全
    }
  }

  return permissions;
}

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

// 获取连接的客户端
app.get("/api/connected-clients", authenticateToken, async (req, res) => {
  try {
    const clients = Array.from(connectedClients.values()).map((client) => {
      // 查找对应的激活码信息
      const activationCode = memoryStore.activationCodes.find(
        (code) => code.used_by_device === client.deviceId
      );

      return {
        id: client.deviceId,
        connectedAt: client.connectedAt,
        activated: activationCode ? activationCode.status === "used" : false,
        deviceInfo: client.deviceInfo || null,
        lastActivity: client.lastActivity || client.connectedAt,
        activationCode: activationCode ? activationCode.code : null,
        status: client.ws.readyState === 1 ? "connected" : "disconnected",
      };
    });

    res.json({
      success: true,
      data: clients,
    });
  } catch (error) {
    console.error("获取连接客户端错误:", error);
    res.status(500).json({ error: "获取连接客户端失败" });
  }
});

// 控制客户端
app.post("/api/control-client", authenticateToken, async (req, res) => {
  try {
    const { clientId, action } = req.body;

    if (!clientId || !action) {
      return res.status(400).json({ error: "客户端ID和操作不能为空" });
    }

    const client = connectedClients.get(clientId);
    if (!client) {
      return res.status(404).json({ error: "客户端不存在或已断开" });
    }

    // 发送控制消息
    const message = {
      type: "control",
      action: action, // enable, disable
      timestamp: new Date().toISOString(),
    };

    if (client.ws && client.ws.readyState === 1) {
      client.ws.send(JSON.stringify(message));

      // 记录控制日志
      memoryStore.usageLogs.push({
        id: memoryStore.usageLogs.length + 1,
        activation_code: "system",
        device_id: clientId,
        action: `control_${action}`,
        timestamp: new Date().toISOString(),
        details: `管理员${action === "enable" ? "启用" : "禁用"}客户端`,
      });

      saveData(memoryStore);

      res.json({
        success: true,
        message: `客户端${action === "enable" ? "启用" : "禁用"}成功`,
      });
    } else {
      res.status(400).json({ error: "客户端连接已断开" });
    }
  } catch (error) {
    console.error("控制客户端错误:", error);
    res.status(500).json({ error: "控制客户端失败" });
  }
});

// 断开客户端连接
app.post("/api/disconnect-client", authenticateToken, async (req, res) => {
  try {
    const { clientId } = req.body;

    if (!clientId) {
      return res.status(400).json({ error: "客户端ID不能为空" });
    }

    const client = connectedClients.get(clientId);
    if (!client) {
      return res.status(404).json({ error: "客户端不存在或已断开" });
    }

    // 关闭WebSocket连接
    if (client.ws && client.ws.readyState === 1) {
      client.ws.close();
    }

    // 从连接列表中移除
    connectedClients.delete(clientId);

    // 记录断开日志
    memoryStore.usageLogs.push({
      id: memoryStore.usageLogs.length + 1,
      activation_code: "system",
      device_id: clientId,
      action: "disconnected",
      timestamp: new Date().toISOString(),
      details: "管理员断开客户端连接",
    });

    saveData(memoryStore);

    res.json({
      success: true,
      message: "客户端连接已断开",
    });
  } catch (error) {
    console.error("断开客户端错误:", error);
    res.status(500).json({ error: "断开客户端失败" });
  }
});

// 广播消息
app.post("/api/broadcast", authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "消息内容不能为空" });
    }

    const broadcastData = {
      id: Date.now(), // 添加唯一ID
      type: "broadcast",
      message: message,
      timestamp: new Date().toISOString(),
      from: "admin",
    };

    // 保存到广播历史（保留最近50条）
    memoryStore.broadcastHistory.push(broadcastData);
    if (memoryStore.broadcastHistory.length > 50) {
      memoryStore.broadcastHistory = memoryStore.broadcastHistory.slice(-50);
    }

    // 向所有连接的客户端广播消息
    let sentCount = 0;
    connectedClients.forEach((client) => {
      if (client.ws && client.ws.readyState === 1) {
        client.ws.send(JSON.stringify(broadcastData));
        sentCount++;
      }
    });

    // 记录广播日志
    memoryStore.usageLogs.push({
      id: memoryStore.usageLogs.length + 1,
      activation_code: "system",
      device_id: "admin",
      action: "broadcast",
      timestamp: new Date().toISOString(),
      details: `管理员广播消息给${sentCount}个客户端: ${message}`,
    });

    saveData(memoryStore);

    res.json({
      success: true,
      message: `消息已发送给${sentCount}个在线客户端`,
      sentCount: sentCount,
    });
  } catch (error) {
    console.error("广播消息错误:", error);
    res.status(500).json({ error: "广播消息失败" });
  }
});

// 获取统计信息
app.get("/api/stats", authenticateToken, async (req, res) => {
  try {
    const codes = memoryStore.activationCodes;
    const logs = memoryStore.usageLogs;

    // 使用在线时间进行统计计算
    let now, dayAgo, weekAgo;
    try {
      now = await globalTimeAPI.getBeijingTime();
      dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } catch (error) {
      console.warn("⚠️ 统计时间获取失败，使用本地时间:", error.message);
      now = new Date();
      dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // 计算服务器运行时间
    const uptime = process.uptime();
    const uptimeHours = Math.floor(uptime / 3600);
    const uptimeMinutes = Math.floor((uptime % 3600) / 60);

    // 内存使用情况
    const memUsage = process.memoryUsage();
    const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);

    const stats = {
      totalCodes: codes.length,
      activeCodes: codes.filter((c) => c.status === "active").length,
      usedCodes: codes.filter((c) => c.status === "used").length,
      expiredCodes: codes.filter((c) => new Date(c.expires_at) < now).length,
      totalUsage: logs.length,
      recentUsage: logs.filter((l) => {
        const logDate = new Date(l.timestamp);
        return logDate > dayAgo;
      }).length,
      weeklyUsage: logs.filter((l) => {
        const logDate = new Date(l.timestamp);
        return logDate > weekAgo;
      }).length,
      connectedClients: connectedClients.size,
      serverInfo: {
        uptime: `${uptimeHours}小时${uptimeMinutes}分钟`,
        uptimeSeconds: Math.floor(uptime),
        memoryUsage: `${memUsedMB}MB / ${memTotalMB}MB`,
        memoryPercent: Math.round((memUsedMB / memTotalMB) * 100),
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid,
      },
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

// 健康检查端点（无需认证）
app.get("/api/health", async (req, res) => {
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();
  const timestamp = await getTimestamp();

  const health = {
    status: "healthy",
    timestamp: timestamp,
    uptime: Math.floor(uptime),
    memory: {
      used: Math.round(memUsage.heapUsed / 1024 / 1024),
      total: Math.round(memUsage.heapTotal / 1024 / 1024),
      percent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
    },
    connections: {
      websocket: connectedClients.size,
      total: connectedClients.size,
    },
    version: "1.0.0",
  };

  res.json(health);
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

// 获取用户列表（基于激活记录）
app.get("/api/users", authenticateToken, async (req, res) => {
  try {
    // 从激活码和使用记录中提取用户信息
    const users = [];
    const userMap = new Map();

    // 遍历激活码，收集用户信息
    memoryStore.activationCodes.forEach((code) => {
      if (code.used_by_device) {
        const deviceId = code.used_by_device;
        if (!userMap.has(deviceId)) {
          userMap.set(deviceId, {
            deviceId: deviceId,
            activationCode: code.code,
            activatedAt: code.used_at,
            expiresAt: code.expires_at,
            status: code.status,
            notes: code.notes || "",
            isOnline: connectedClients.has(deviceId),
            lastActivity: null,
          });
        }
      }
    });

    // 添加在线状态和最后活动时间
    connectedClients.forEach((client, deviceId) => {
      if (userMap.has(deviceId)) {
        userMap.get(deviceId).isOnline = true;
        userMap.get(deviceId).lastActivity = client.connectedAt;
      }
    });

    // 转换为数组
    users.push(...userMap.values());

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("获取用户列表错误:", error);
    res.status(500).json({ error: "获取用户列表失败" });
  }
});

// 客户端请求执行操作（需要激活验证）
app.post(
  "/api/client/execute-operation",
  authenticateActivation,
  async (req, res) => {
    try {
      const { operation, parameters } = req.body;
      const { activation } = req;

      // 检查操作权限
      switch (operation) {
        case "cleanup":
          if (!activation.permissions.canCleanup) {
            return res.status(403).json({
              success: false,
              error: "没有设备清理权限",
              requireActivation: true,
            });
          }
          break;

        case "export":
          if (!activation.permissions.canExport) {
            return res.status(403).json({
              success: false,
              error: "没有数据导出权限",
              requireActivation: true,
            });
          }
          break;

        default:
          return res.status(400).json({
            success: false,
            error: "未知操作类型",
          });
      }

      // 记录操作日志
      memoryStore.usageLogs.push({
        id: memoryStore.usageLogs.length + 1,
        activation_code: activation.code.code,
        device_id: activation.deviceId,
        action: `operation_${operation}`,
        timestamp: new Date().toISOString(),
        details: `客户端执行操作: ${operation}`,
      });

      saveData(memoryStore);

      res.json({
        success: true,
        message: `操作 ${operation} 执行成功`,
        permissions: activation.permissions,
      });
    } catch (error) {
      console.error("执行操作错误:", error);
      res.status(500).json({
        success: false,
        error: "操作执行失败",
      });
    }
  }
);

// 禁用/启用用户
app.post("/api/users/:deviceId/toggle", authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { action } = req.body; // 'disable' 或 'enable'

    if (!action || !["disable", "enable"].includes(action)) {
      return res.status(400).json({ error: "操作类型无效" });
    }

    // 查找用户的激活码
    const userCode = memoryStore.activationCodes.find(
      (c) => c.used_by_device === deviceId
    );

    if (!userCode) {
      return res.status(404).json({ error: "用户不存在" });
    }

    // 更新状态
    const newStatus = action === "disable" ? "inactive" : "used";
    userCode.status = newStatus;

    // 记录操作日志
    memoryStore.usageLogs.push({
      id: memoryStore.usageLogs.length + 1,
      activation_code: userCode.code,
      device_id: "admin",
      action: `user_${action}`,
      timestamp: new Date().toISOString(),
      details: `管理员${
        action === "disable" ? "禁用" : "启用"
      }用户 ${deviceId}`,
    });

    // 通知客户端状态变更
    if (connectedClients.has(deviceId)) {
      const message = {
        type:
          action === "disable" ? "activation_disabled" : "activation_enabled",
        reason: `管理员${action === "disable" ? "禁用" : "启用"}了您的账户`,
        timestamp: new Date().toISOString(),
      };
      sendToClient(deviceId, message);
    }

    saveData(memoryStore);

    res.json({
      success: true,
      message: `用户${action === "disable" ? "禁用" : "启用"}成功`,
    });
  } catch (error) {
    console.error("切换用户状态错误:", error);
    res.status(500).json({ error: "操作失败" });
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
      console.log("收到WebSocket消息:", data);

      if (data.type === "register") {
        // 客户端注册
        console.log("处理客户端注册，设备ID:", data.deviceId);

        connectedClients.set(data.deviceId, {
          ws: ws,
          deviceId: data.deviceId,
          connectedAt: new Date().toISOString(),
        });
        console.log(`客户端已注册: ${data.deviceId}`);
        console.log("当前连接的客户端数量:", connectedClients.size);

        // 发送注册确认
        ws.send(
          JSON.stringify({
            type: "registered",
            success: true,
            message: "连接已建立",
          })
        );

        // 发送最近的广播消息（最近5条）
        const recentBroadcasts = memoryStore.broadcastHistory.slice(-5);
        if (recentBroadcasts.length > 0) {
          console.log(
            `向新连接的客户端发送${recentBroadcasts.length}条历史广播消息`
          );
          recentBroadcasts.forEach((broadcast) => {
            ws.send(
              JSON.stringify({
                ...broadcast,
                isHistorical: true, // 标记为历史消息
              })
            );
          });
        }
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
server.listen(PORT, "0.0.0.0", () => {
  // console.log(`激活码管理后台运行在 http://0.0.0.0:${PORT}`);
  console.log(`激活码管理后台运行在 http://localhost:${PORT}`);
  console.log(`WebSocket服务运行在 ws://0.0.0.0:${PORT}/ws`);
  console.log("默认管理员账户: admin / admin123");
  console.log(`数据存储: ${DATA_FILE}`);
  console.log(
    `已加载 ${memoryStore.activationCodes.length} 个激活码，${memoryStore.usageLogs.length} 条使用记录`
  );
  console.log("🌐 服务器已配置为支持远程访问");
  console.log("📱 客户端可从任何网络位置连接");
});

// 优雅关闭
process.on("SIGINT", () => {
  console.log("正在关闭服务器...");
  process.exit(0);
});

module.exports = app;
