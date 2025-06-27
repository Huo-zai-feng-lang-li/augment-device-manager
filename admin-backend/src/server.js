const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Database = require("./database");
const {
  generateActivationCode,
  validateActivationCode,
  generateDeviceFingerprint,
} = require("../../shared/crypto/encryption");

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = "augment-admin-jwt-secret-2024";

// 初始化数据库
const db = new Database();

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

// 登录接口
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const admin = await db.getAdminByUsername(username);
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

    // 保存到数据库
    const result = await db.createActivationCode(
      code,
      deviceId || null,
      expiresAt.toISOString(),
      notes || ""
    );

    // 记录操作日志
    await db.logUsage(code, "admin", "created", `管理员创建激活码`);

    res.json({
      success: true,
      data: {
        id: result.id,
        code: result.code,
        expiresAt: expiresAt.toISOString(),
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
    const codes = await db.getAllActivationCodes();
    res.json({
      success: true,
      data: codes,
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

    // 先进行格式验证
    const formatValidation = validateActivationCode(code, deviceId);
    if (!formatValidation.valid) {
      await db.logUsage(code, deviceId, "failed", formatValidation.reason);
      return res.status(400).json({
        success: false,
        error: formatValidation.reason,
      });
    }

    // 从数据库查询激活码状态
    const activationCodes = await db.getAllActivationCodes();
    const activationCode = activationCodes.find((c) => c.code === code);

    if (!activationCode) {
      await db.logUsage(code, deviceId, "failed", "激活码不存在");
      return res.status(400).json({
        success: false,
        error: "激活码不存在",
      });
    }

    // 检查激活码状态
    if (activationCode.status === "revoked") {
      await db.logUsage(code, deviceId, "failed", "激活码已被撤销");
      return res.status(400).json({
        success: false,
        error: "激活码已被撤销",
      });
    }

    if (activationCode.status === "inactive") {
      await db.logUsage(code, deviceId, "failed", "激活码已被禁用");
      return res.status(400).json({
        success: false,
        error: "激活码已被禁用",
      });
    }

    // 检查过期时间
    const now = new Date();
    const expiry = new Date(activationCode.expires_at);
    if (now > expiry) {
      // 自动标记为过期
      await db.updateActivationCodeStatus(code, "expired");
      await db.logUsage(code, deviceId, "failed", "激活码已过期");
      return res.status(400).json({
        success: false,
        error: "激活码已过期",
      });
    }

    // 检查设备绑定（如果已被其他设备使用）
    if (
      activationCode.used_by_device &&
      activationCode.used_by_device !== deviceId
    ) {
      await db.logUsage(code, deviceId, "failed", "激活码已绑定其他设备");
      return res.status(400).json({
        success: false,
        error: "激活码已绑定其他设备",
      });
    }

    // 验证通过，更新使用状态
    await db.updateActivationCodeStatus(code, "used", deviceId);

    // 记录使用日志
    await db.logUsage(code, deviceId, "activated", "激活码验证成功");

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

// 获取使用记录
app.get("/api/usage-logs", authenticateToken, async (req, res) => {
  try {
    const logs = await db.getUsageLogs(200);
    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error("获取使用记录错误:", error);
    res.status(500).json({ error: "获取使用记录失败" });
  }
});

// 撤销激活码
app.post("/api/revoke-activation", authenticateToken, async (req, res) => {
  try {
    const { code, reason = "管理员撤销" } = req.body;

    if (!code) {
      return res.status(400).json({ error: "激活码不能为空" });
    }

    // 检查激活码是否存在
    const activationCodes = await db.getAllActivationCodes();
    const activationCode = activationCodes.find((c) => c.code === code);

    if (!activationCode) {
      return res.status(404).json({ error: "激活码不存在" });
    }

    if (activationCode.status === "revoked") {
      return res.status(400).json({ error: "激活码已被撤销" });
    }

    // 撤销激活码
    await db.revokeActivationCode(code, reason);

    // 记录撤销日志
    await db.logUsage(code, "admin", "revoked", `管理员撤销激活码: ${reason}`);

    res.json({
      success: true,
      message: "激活码撤销成功",
    });
  } catch (error) {
    console.error("撤销激活码错误:", error);
    res.status(500).json({ error: "撤销激活码失败" });
  }
});

// 获取统计信息
app.get("/api/stats", authenticateToken, async (req, res) => {
  try {
    const codes = await db.getAllActivationCodes();
    const logs = await db.getUsageLogs(1000);

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

// 静态文件路由
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`激活码管理后台运行在 http://localhost:${PORT}`);
  console.log("默认管理员账户: admin / admin123");
});

// 优雅关闭
process.on("SIGINT", () => {
  console.log("正在关闭服务器...");
  db.close();
  process.exit(0);
});
