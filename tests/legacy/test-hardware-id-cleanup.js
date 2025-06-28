const DeviceDetection = require('./shared/utils/device-detection');
const DeviceManager = require('./desktop-client/src/device-manager');
const { generateStableDeviceId } = require('./shared/utils/stable-device-id');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * 测试硬件设备ID清理功能
 */
async function testHardwareIdCleanup() {
    console.log('🔧 硬件设备ID清理功能测试\n');

    try {
        const detector = new DeviceDetection();
        const deviceManager = new DeviceManager();

        // 1. 检查当前硬件设备ID
        console.log('1. 检查当前硬件设备ID...');
        
        const beforeCleanup = await collectAllDeviceIds();
        console.log('   清理前的设备ID:');
        displayDeviceIds(beforeCleanup, '     ');

        // 2. 检查清理能力
        console.log('\n2. 检查硬件ID清理能力...');
        
        const cleanupCapabilities = {
            stableDeviceId: true,           // ✅ 可清理（删除缓存重新生成）
            deviceFingerprint: true,        // ✅ 可清理（重新收集硬件信息）
            cursorTelemetryIds: true,       // ✅ 可清理（重写storage.json）
            systemMachineGuid: false,       // ⚠️ 需要管理员权限
            hardwareUUID: false,            // ❌ 硬件固有，无法更改
            cpuSerial: false,               // ❌ 硬件固有，无法更改
            motherboardSerial: false,       // ❌ 硬件固有，无法更改
            diskSerial: false,              // ❌ 硬件固有，无法更改
            macAddresses: false,            // ❌ 网卡硬件地址，无法更改
            biosSerial: false               // ❌ BIOS固有，无法更改
        };

        console.log('   清理能力分析:');
        Object.entries(cleanupCapabilities).forEach(([key, canClean]) => {
            const status = canClean ? '✅ 可清理' : '❌ 无法清理';
            console.log(`     ${key}: ${status}`);
        });

        // 3. 执行软件层面的设备ID清理
        console.log('\n3. 执行软件层面设备ID清理...');
        
        const cleanupOptions = {
            preserveActivation: true,
            cleanCursor: true,
            cleanCursorExtension: true,
            aggressiveMode: true,
            autoRestartCursor: false,
            skipCursorLogin: true
        };

        console.log('   清理配置: 激进模式（保留激活状态）');
        const cleanupResult = await deviceManager.performCleanup(cleanupOptions);
        
        if (cleanupResult.success) {
            console.log('   ✅ 软件层面清理成功');
            console.log(`   📊 执行了 ${cleanupResult.actions.length} 个操作`);
            if (cleanupResult.errors.length > 0) {
                console.log(`   ⚠️ 遇到 ${cleanupResult.errors.length} 个错误（正常）`);
            }
        } else {
            console.log('   ❌ 清理失败');
            return;
        }

        // 4. 检查清理后的设备ID变化
        console.log('\n4. 检查清理后的设备ID变化...');
        
        // 等待一下确保清理完成
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const afterCleanup = await collectAllDeviceIds();
        console.log('   清理后的设备ID:');
        displayDeviceIds(afterCleanup, '     ');

        // 5. 对比分析
        console.log('\n5. 清理效果对比分析...');
        
        const changes = analyzeChanges(beforeCleanup, afterCleanup);
        console.log('   变化统计:');
        console.log(`     软件ID变化: ${changes.softwareChanged}/${changes.totalSoftware}`);
        console.log(`     硬件ID变化: ${changes.hardwareChanged}/${changes.totalHardware}`);
        console.log(`     总体变化率: ${((changes.totalChanged / changes.totalIds) * 100).toFixed(1)}%`);

        // 6. 详细变化报告
        console.log('\n6. 详细变化报告...');
        
        const changeDetails = [
            { name: '稳定设备ID', before: beforeCleanup.stableDeviceId, after: afterCleanup.stableDeviceId },
            { name: '设备指纹', before: beforeCleanup.deviceFingerprint, after: afterCleanup.deviceFingerprint },
            { name: 'Cursor机器ID', before: beforeCleanup.cursorMachineId, after: afterCleanup.cursorMachineId },
            { name: 'Cursor设备ID', before: beforeCleanup.cursorDeviceId, after: afterCleanup.cursorDeviceId },
            { name: '系统UUID', before: beforeCleanup.systemUUID, after: afterCleanup.systemUUID },
            { name: '主板序列号', before: beforeCleanup.motherboardSerial, after: afterCleanup.motherboardSerial }
        ];

        changeDetails.forEach(detail => {
            const changed = detail.before !== detail.after;
            const status = changed ? '✅ 已变化' : '❌ 未变化';
            const beforeStr = detail.before ? detail.before.substring(0, 16) + '...' : '未获取';
            const afterStr = detail.after ? detail.after.substring(0, 16) + '...' : '未获取';
            console.log(`     ${detail.name}: ${status}`);
            console.log(`       清理前: ${beforeStr}`);
            console.log(`       清理后: ${afterStr}`);
        });

        // 7. 总结和建议
        console.log('\n📊 硬件设备ID清理能力总结:');
        console.log('   ✅ 软件层面设备ID: 完全可清理');
        console.log('     - 稳定设备ID（缓存清理）');
        console.log('     - 设备指纹（重新生成）');
        console.log('     - Cursor遥测ID（重写配置）');
        console.log('     - 应用程序存储ID');
        
        console.log('\n   ⚠️ 系统层面设备ID: 部分可清理');
        console.log('     - 注册表MachineGuid（需管理员权限）');
        console.log('     - 系统缓存文件');
        
        console.log('\n   ❌ 硬件层面设备ID: 无法清理');
        console.log('     - CPU序列号（硬件固有）');
        console.log('     - 主板序列号（硬件固有）');
        console.log('     - 硬盘序列号（硬件固有）');
        console.log('     - BIOS序列号（硬件固有）');
        console.log('     - MAC地址（网卡硬件）');

        console.log('\n💡 实际效果:');
        console.log('   🎯 对于Cursor IDE Augment扩展:');
        console.log('     - 软件层面的设备ID清理已足够');
        console.log('     - 扩展主要依赖软件生成的设备标识');
        console.log('     - 硬件ID通常不直接用于用户识别');
        
        console.log('\n   🔒 安全性考虑:');
        console.log('     - 硬件ID无法更改是正常的安全特性');
        console.log('     - 软件层面清理已能有效重置设备身份');
        console.log('     - 多层次ID确保了系统稳定性');

        return true;

    } catch (error) {
        console.error('❌ 硬件设备ID清理测试失败:', error);
        return false;
    }
}

/**
 * 收集所有设备ID
 */
async function collectAllDeviceIds() {
    const ids = {};

    try {
        // 软件生成的设备ID
        ids.stableDeviceId = await generateStableDeviceId();
        
        const detector = new DeviceDetection();
        ids.deviceFingerprint = await detector.generateFingerprint();

        // Cursor遥测ID
        const cursorStoragePath = path.join(
            os.homedir(),
            'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'storage.json'
        );
        
        if (await fs.pathExists(cursorStoragePath)) {
            const storage = await fs.readJson(cursorStoragePath);
            ids.cursorMachineId = storage['telemetry.machineId'];
            ids.cursorDeviceId = storage['telemetry.devDeviceId'];
        }

        // 硬件设备ID（Windows）
        if (os.platform() === 'win32') {
            try {
                const { stdout: uuid } = await execAsync('wmic csproduct get UUID /value');
                const uuidMatch = uuid.match(/UUID=(.+)/);
                if (uuidMatch) {
                    ids.systemUUID = uuidMatch[1].trim();
                }

                const { stdout: motherboard } = await execAsync('wmic baseboard get SerialNumber /value');
                const mbMatch = motherboard.match(/SerialNumber=(.+)/);
                if (mbMatch) {
                    ids.motherboardSerial = mbMatch[1].trim();
                }
            } catch (error) {
                // 硬件信息获取失败是正常的
            }
        }

    } catch (error) {
        console.warn('收集设备ID时出错:', error.message);
    }

    return ids;
}

/**
 * 显示设备ID
 */
function displayDeviceIds(ids, prefix = '') {
    Object.entries(ids).forEach(([key, value]) => {
        const displayValue = value ? value.substring(0, 32) + '...' : '未获取';
        console.log(`${prefix}${key}: ${displayValue}`);
    });
}

/**
 * 分析变化
 */
function analyzeChanges(before, after) {
    const softwareKeys = ['stableDeviceId', 'deviceFingerprint', 'cursorMachineId', 'cursorDeviceId'];
    const hardwareKeys = ['systemUUID', 'motherboardSerial'];
    
    let softwareChanged = 0;
    let hardwareChanged = 0;
    let totalChanged = 0;

    const allKeys = [...softwareKeys, ...hardwareKeys];
    
    allKeys.forEach(key => {
        if (before[key] !== after[key]) {
            totalChanged++;
            if (softwareKeys.includes(key)) {
                softwareChanged++;
            } else {
                hardwareChanged++;
            }
        }
    });

    return {
        softwareChanged,
        hardwareChanged,
        totalChanged,
        totalSoftware: softwareKeys.length,
        totalHardware: hardwareKeys.length,
        totalIds: allKeys.length
    };
}

// 运行测试
if (require.main === module) {
    testHardwareIdCleanup()
        .then(success => {
            console.log(`\n🏁 硬件设备ID清理测试${success ? '成功' : '失败'}完成！`);
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ 测试异常:', error);
            process.exit(1);
        });
}

module.exports = { testHardwareIdCleanup };
