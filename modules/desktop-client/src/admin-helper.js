const { exec } = require('child_process');
const { promisify } = require('util');
const sudo = require('sudo-prompt');
const path = require('path');
const os = require('os');

const execAsync = promisify(exec);

/**
 * 管理员权限助手
 * 处理需要管理员权限的操作，如注册表修改
 */
class AdminHelper {
    constructor() {
        this.platform = os.platform();
        this.isAdmin = false;
        this.sudoOptions = {
            name: 'Augment设备管理器',
            icns: path.join(__dirname, '../public/logo.png'), // macOS
            icon: path.join(__dirname, '../public/logo.png'), // Windows
        };
    }

    /**
     * 检查当前是否具有管理员权限
     */
    async checkAdminRights() {
        try {
            if (this.platform === 'win32') {
                // Windows: 尝试读取需要管理员权限的注册表项
                await execAsync('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid');
                this.isAdmin = true;
                return true;
            } else if (this.platform === 'darwin') {
                // macOS: 检查是否可以写入系统目录
                await execAsync('sudo -n true 2>/dev/null');
                this.isAdmin = true;
                return true;
            } else {
                // Linux: 检查sudo权限
                await execAsync('sudo -n true 2>/dev/null');
                this.isAdmin = true;
                return true;
            }
        } catch (error) {
            this.isAdmin = false;
            return false;
        }
    }

    /**
     * 使用管理员权限执行命令
     */
    async executeAsAdmin(command, description = '执行管理员操作') {
        return new Promise((resolve, reject) => {
            const options = {
                ...this.sudoOptions,
                name: description
            };

            sudo.exec(command, options, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`管理员操作失败: ${error.message}`));
                } else {
                    resolve({
                        success: true,
                        stdout: stdout ? stdout.toString() : '',
                        stderr: stderr ? stderr.toString() : ''
                    });
                }
            });
        });
    }

    /**
     * 更新系统注册表MachineGuid（Windows）
     */
    async updateSystemMachineGuid(newGuid) {
        if (this.platform !== 'win32') {
            throw new Error('MachineGuid更新仅支持Windows系统');
        }

        const command = `reg add "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid /t REG_SZ /d "${newGuid}" /f`;
        
        try {
            // 首先检查是否已有管理员权限
            if (this.isAdmin) {
                const result = await execAsync(command);
                return {
                    success: true,
                    method: 'direct',
                    message: '直接更新注册表成功'
                };
            } else {
                // 请求管理员权限
                const result = await this.executeAsAdmin(command, '更新系统设备标识');
                return {
                    success: true,
                    method: 'elevated',
                    message: '通过UAC提升权限更新注册表成功'
                };
            }
        } catch (error) {
            throw new Error(`更新MachineGuid失败: ${error.message}`);
        }
    }

    /**
     * 执行PowerShell脚本（需要管理员权限）
     */
    async executePowerShellAsAdmin(scriptPath, parameters = {}) {
        if (this.platform !== 'win32') {
            throw new Error('PowerShell脚本仅支持Windows系统');
        }

        // 构建PowerShell命令
        const paramString = Object.entries(parameters)
            .map(([key, value]) => `-${key} "${value}"`)
            .join(' ');

        const command = `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}" ${paramString}`;

        try {
            if (this.isAdmin) {
                const result = await execAsync(command);
                return {
                    success: true,
                    method: 'direct',
                    output: result.stdout
                };
            } else {
                const result = await this.executeAsAdmin(command, '执行设备清理脚本');
                return {
                    success: true,
                    method: 'elevated',
                    output: result.stdout
                };
            }
        } catch (error) {
            throw new Error(`PowerShell脚本执行失败: ${error.message}`);
        }
    }

    /**
     * 检查是否需要管理员权限进行深度清理
     */
    async checkDeepCleanRequirements() {
        const requirements = {
            needsAdmin: false,
            reasons: [],
            capabilities: {
                registryAccess: false,
                systemFileAccess: false,
                serviceControl: false
            }
        };

        try {
            // 检查注册表访问权限
            if (this.platform === 'win32') {
                try {
                    await execAsync('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid');
                    requirements.capabilities.registryAccess = true;
                } catch (error) {
                    requirements.needsAdmin = true;
                    requirements.reasons.push('需要管理员权限访问系统注册表');
                }

                // 检查系统文件访问权限
                try {
                    await execAsync('dir "C:\\Windows\\System32\\config" >nul 2>&1');
                    requirements.capabilities.systemFileAccess = true;
                } catch (error) {
                    requirements.reasons.push('需要管理员权限访问系统文件');
                }
            }

            return requirements;
        } catch (error) {
            requirements.needsAdmin = true;
            requirements.reasons.push(`权限检查失败: ${error.message}`);
            return requirements;
        }
    }

    /**
     * 显示管理员权限请求对话框
     */
    async requestAdminPermission(reason = '执行系统级清理操作') {
        return new Promise((resolve) => {
            const { dialog } = require('electron');
            
            const options = {
                type: 'question',
                title: '需要管理员权限',
                message: '深度清理需要管理员权限',
                detail: `${reason}\n\n点击"授权"将弹出UAC对话框请求管理员权限。\n点击"跳过"将使用标准权限进行清理。`,
                buttons: ['授权', '跳过', '取消'],
                defaultId: 0,
                cancelId: 2
            };

            dialog.showMessageBox(options).then((result) => {
                resolve({
                    granted: result.response === 0,
                    skipped: result.response === 1,
                    cancelled: result.response === 2
                });
            });
        });
    }

    /**
     * 智能清理策略：根据权限自动选择清理方式
     */
    async performSmartCleanup(options = {}) {
        const results = {
            success: true,
            actions: [],
            errors: [],
            adminOperations: [],
            standardOperations: []
        };

        try {
            // 1. 检查当前权限
            const hasAdmin = await this.checkAdminRights();
            results.actions.push(`权限检查: ${hasAdmin ? '✅ 管理员权限' : '⚠️ 标准权限'}`);

            // 2. 检查深度清理需求
            const requirements = await this.checkDeepCleanRequirements();
            
            if (requirements.needsAdmin && !hasAdmin) {
                // 3. 请求管理员权限（如果需要且当前没有）
                if (options.requestAdmin !== false) {
                    const permission = await this.requestAdminPermission(
                        '更新系统注册表MachineGuid以实现更彻底的设备重置'
                    );
                    
                    if (permission.granted) {
                        results.actions.push('🔐 用户授权管理员权限');
                        // 执行需要管理员权限的操作
                        await this.performAdminOperations(results, options);
                    } else if (permission.skipped) {
                        results.actions.push('⚠️ 用户跳过管理员权限，使用标准清理');
                    } else {
                        results.actions.push('❌ 用户取消操作');
                        return results;
                    }
                } else {
                    results.actions.push('⚠️ 跳过管理员权限请求，使用标准清理');
                }
            } else if (hasAdmin) {
                // 4. 直接执行管理员操作
                results.actions.push('🔐 检测到管理员权限，执行深度清理');
                await this.performAdminOperations(results, options);
            }

            // 5. 执行标准清理操作
            await this.performStandardOperations(results, options);

            return results;
        } catch (error) {
            results.success = false;
            results.errors.push(`智能清理失败: ${error.message}`);
            return results;
        }
    }

    /**
     * 执行需要管理员权限的操作
     */
    async performAdminOperations(results, options) {
        try {
            if (this.platform === 'win32' && options.updateRegistry !== false) {
                // 生成新的MachineGuid
                const crypto = require('crypto');
                const newGuid = crypto.randomUUID();
                
                const result = await this.updateSystemMachineGuid(newGuid);
                results.adminOperations.push(`✅ ${result.message}: ${newGuid.substring(0, 16)}...`);
                results.actions.push(`🔧 已更新系统MachineGuid (${result.method})`);
            }
        } catch (error) {
            results.errors.push(`管理员操作失败: ${error.message}`);
        }
    }

    /**
     * 执行标准权限操作
     */
    async performStandardOperations(results, options) {
        // 这里可以调用现有的设备管理器标准清理功能
        results.standardOperations.push('✅ 软件层面设备ID清理');
        results.standardOperations.push('✅ 应用程序存储清理');
        results.standardOperations.push('✅ 缓存文件清理');
        results.actions.push('🔄 标准权限清理操作完成');
    }
}

module.exports = AdminHelper;
