const os = require("os");
const crypto = require("crypto");
const { exec } = require("child_process");
const { promisify } = require("util");

const execAsync = promisify(exec);

/**
 * 设备检测和指纹生成工具
 */
class DeviceDetection {
  constructor() {
    this.platform = os.platform();
    this.cache = new Map();
  }

  /**
   * 生成设备指纹
   * @param {string} ideType - IDE类型 ('cursor', 'vscode', 或 null 为通用)
   */
  async generateFingerprint(ideType = null) {
    const cacheKey = ideType
      ? `device_fingerprint_${ideType}`
      : "device_fingerprint";

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const components = await this.collectDeviceComponents(ideType);
      const fingerprint = this.hashComponents(components);

      this.cache.set(cacheKey, fingerprint);
      return fingerprint;
    } catch (error) {
      console.error("生成设备指纹失败:", error);
      // 使用基础信息作为备用方案
      return this.generateBasicFingerprint(ideType);
    }
  }

  /**
   * 收集设备组件信息
   * @param {string} ideType - IDE类型 ('cursor', 'vscode', 或 null 为通用)
   */
  async collectDeviceComponents(ideType = null) {
    const components = {
      // 基础系统信息
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      totalmem: os.totalmem(),
      // 根据IDE类型添加特定标识符
      ideType: ideType || "generic",
      ideSpecific: ideType ? `${ideType}-fingerprint` : "generic-fingerprint",

      // CPU信息
      cpus: os.cpus().map((cpu) => ({
        model: cpu.model,
        speed: cpu.speed,
      })),

      // 网络接口
      networkInterfaces: this.getNetworkFingerprint(),

      // 用户信息
      userInfo: os.userInfo(),
    };

    // 平台特定信息
    if (this.platform === "win32") {
      components.windows = await this.getWindowsSpecificInfo();
    } else if (this.platform === "darwin") {
      components.macos = await this.getMacOSSpecificInfo();
    } else {
      components.linux = await this.getLinuxSpecificInfo();
    }

    return components;
  }

  /**
   * 获取网络接口指纹
   */
  getNetworkFingerprint() {
    const interfaces = os.networkInterfaces();
    const fingerprint = {};

    for (const [name, addrs] of Object.entries(interfaces)) {
      fingerprint[name] = addrs
        .filter((addr) => !addr.internal)
        .map((addr) => ({
          family: addr.family,
          mac: addr.mac,
        }));
    }

    return fingerprint;
  }

  /**
   * 获取Windows特定信息
   */
  async getWindowsSpecificInfo() {
    const info = {};

    try {
      // 获取系统UUID
      const { stdout: uuid } = await execAsync(
        "wmic csproduct get UUID /value"
      );
      const uuidMatch = uuid.match(/UUID=(.+)/);
      if (uuidMatch) {
        info.systemUUID = uuidMatch[1].trim();
      }

      // 获取主板序列号
      const { stdout: motherboard } = await execAsync(
        "wmic baseboard get SerialNumber /value"
      );
      const mbMatch = motherboard.match(/SerialNumber=(.+)/);
      if (mbMatch) {
        info.motherboardSerial = mbMatch[1].trim();
      }

      // 获取硬盘序列号
      const { stdout: disk } = await execAsync(
        "wmic diskdrive get SerialNumber /value"
      );
      const diskMatch = disk.match(/SerialNumber=(.+)/);
      if (diskMatch) {
        info.diskSerial = diskMatch[1].trim();
      }

      // 获取BIOS信息
      const { stdout: bios } = await execAsync(
        "wmic bios get SerialNumber /value"
      );
      const biosMatch = bios.match(/SerialNumber=(.+)/);
      if (biosMatch) {
        info.biosSerial = biosMatch[1].trim();
      }
    } catch (error) {
      console.warn("获取Windows特定信息失败:", error.message);
    }

    return info;
  }

  /**
   * 获取macOS特定信息
   */
  async getMacOSSpecificInfo() {
    const info = {};

    try {
      // 获取硬件UUID
      const { stdout: uuid } = await execAsync(
        'system_profiler SPHardwareDataType | grep "Hardware UUID"'
      );
      const uuidMatch = uuid.match(/Hardware UUID:\s*(.+)/);
      if (uuidMatch) {
        info.hardwareUUID = uuidMatch[1].trim();
      }

      // 获取序列号
      const { stdout: serial } = await execAsync(
        'system_profiler SPHardwareDataType | grep "Serial Number"'
      );
      const serialMatch = serial.match(/Serial Number \(system\):\s*(.+)/);
      if (serialMatch) {
        info.serialNumber = serialMatch[1].trim();
      }

      // 获取型号标识符
      const { stdout: model } = await execAsync(
        'system_profiler SPHardwareDataType | grep "Model Identifier"'
      );
      const modelMatch = model.match(/Model Identifier:\s*(.+)/);
      if (modelMatch) {
        info.modelIdentifier = modelMatch[1].trim();
      }
    } catch (error) {
      console.warn("获取macOS特定信息失败:", error.message);
    }

    return info;
  }

  /**
   * 获取Linux特定信息
   */
  async getLinuxSpecificInfo() {
    const info = {};

    try {
      // 获取机器ID
      const { stdout: machineId } = await execAsync(
        'cat /etc/machine-id 2>/dev/null || cat /var/lib/dbus/machine-id 2>/dev/null || echo ""'
      );
      if (machineId.trim()) {
        info.machineId = machineId.trim();
      }

      // 获取产品UUID
      const { stdout: uuid } = await execAsync(
        'cat /sys/class/dmi/id/product_uuid 2>/dev/null || echo ""'
      );
      if (uuid.trim()) {
        info.productUUID = uuid.trim();
      }

      // 获取主板序列号
      const { stdout: boardSerial } = await execAsync(
        'cat /sys/class/dmi/id/board_serial 2>/dev/null || echo ""'
      );
      if (boardSerial.trim()) {
        info.boardSerial = boardSerial.trim();
      }

      // 获取系统序列号
      const { stdout: systemSerial } = await execAsync(
        'cat /sys/class/dmi/id/product_serial 2>/dev/null || echo ""'
      );
      if (systemSerial.trim()) {
        info.systemSerial = systemSerial.trim();
      }
    } catch (error) {
      console.warn("获取Linux特定信息失败:", error.message);
    }

    return info;
  }

  /**
   * 对组件信息进行哈希
   */
  hashComponents(components) {
    const jsonString = JSON.stringify(
      components,
      Object.keys(components).sort()
    );
    return crypto.createHash("sha256").update(jsonString).digest("hex");
  }

  /**
   * 生成基础指纹（备用方案）
   * @param {string} ideType - IDE类型 ('cursor', 'vscode', 或 null 为通用)
   */
  generateBasicFingerprint(ideType = null) {
    const basicInfo = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      totalmem: os.totalmem(),
      cpuModel: os.cpus()[0]?.model || "unknown",
      username: os.userInfo().username,
      // 根据IDE类型添加特定标识符
      ideType: ideType || "generic",
      ideSpecific: ideType
        ? `${ideType}-basic-fingerprint`
        : "generic-basic-fingerprint",
    };

    return this.hashComponents(basicInfo);
  }

  /**
   * 检测虚拟机环境
   */
  async detectVirtualMachine() {
    try {
      if (this.platform === "win32") {
        return await this.detectWindowsVM();
      } else if (this.platform === "darwin") {
        return await this.detectMacOSVM();
      } else {
        return await this.detectLinuxVM();
      }
    } catch (error) {
      console.warn("虚拟机检测失败:", error.message);
      return { isVM: false, type: "unknown" };
    }
  }

  /**
   * 检测Windows虚拟机
   */
  async detectWindowsVM() {
    try {
      const { stdout } = await execAsync(
        "wmic computersystem get Model /value"
      );
      const model = stdout.toLowerCase();

      const vmIndicators = [
        "virtualbox",
        "vmware",
        "virtual",
        "qemu",
        "kvm",
        "xen",
      ];
      const isVM = vmIndicators.some((indicator) => model.includes(indicator));

      return {
        isVM,
        type: isVM ? this.identifyVMType(model) : "physical",
        details: model,
      };
    } catch (error) {
      return { isVM: false, type: "unknown" };
    }
  }

  /**
   * 检测macOS虚拟机
   */
  async detectMacOSVM() {
    try {
      const { stdout } = await execAsync(
        'system_profiler SPHardwareDataType | grep "Model Name"'
      );
      const model = stdout.toLowerCase();

      const vmIndicators = ["virtualbox", "vmware", "parallels", "qemu"];
      const isVM = vmIndicators.some((indicator) => model.includes(indicator));

      return {
        isVM,
        type: isVM ? this.identifyVMType(model) : "physical",
        details: model,
      };
    } catch (error) {
      return { isVM: false, type: "unknown" };
    }
  }

  /**
   * 检测Linux虚拟机
   */
  async detectLinuxVM() {
    try {
      const { stdout } = await execAsync(
        'dmidecode -s system-product-name 2>/dev/null || echo "unknown"'
      );
      const model = stdout.toLowerCase();

      const vmIndicators = [
        "virtualbox",
        "vmware",
        "qemu",
        "kvm",
        "xen",
        "bochs",
      ];
      const isVM = vmIndicators.some((indicator) => model.includes(indicator));

      return {
        isVM,
        type: isVM ? this.identifyVMType(model) : "physical",
        details: model,
      };
    } catch (error) {
      return { isVM: false, type: "unknown" };
    }
  }

  /**
   * 识别虚拟机类型
   */
  identifyVMType(model) {
    if (model.includes("virtualbox")) return "VirtualBox";
    if (model.includes("vmware")) return "VMware";
    if (model.includes("parallels")) return "Parallels";
    if (model.includes("qemu")) return "QEMU";
    if (model.includes("kvm")) return "KVM";
    if (model.includes("xen")) return "Xen";
    if (model.includes("bochs")) return "Bochs";
    return "Unknown VM";
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = DeviceDetection;
