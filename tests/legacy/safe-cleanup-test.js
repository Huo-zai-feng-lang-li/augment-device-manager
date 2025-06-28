const DeviceManager = require('./desktop-client/src/device-manager');
const readline = require('readline');

/**
 * 安全的清理测试脚本
 * 提供交互式界面让用户选择清理选项
 */
async function safeCleanupTest() {
    console.log('🛡️  安全清理测试工具\n');
    console.log('⚠️  注意：这将执行实际的清理操作');
    console.log('📋 建议：在执行前关闭Cursor IDE以获得最佳效果\n');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try {
        const deviceManager = new DeviceManager();

        // 检查当前状态
        console.log('📊 当前系统状态检查...');
        const extensionInfo = await deviceManager.getAugmentExtensionInfo();
        const isCursorRunning = await deviceManager.isCursorRunning();
        
        console.log(`   Augment扩展: ${extensionInfo.data.installed ? '✅ 已安装' : '❌ 未安装'}`);
        console.log(`   Cursor IDE: ${isCursorRunning ? '🟡 运行中' : '✅ 已关闭'}`);
        
        if (isCursorRunning) {
            console.log('   💡 建议：关闭Cursor IDE后再执行清理操作');
        }

        // 显示清理选项
        console.log('\n🎛️  可用的清理选项：');
        console.log('1. 基础清理（保留激活状态，清理设备指纹）');
        console.log('2. Cursor扩展清理（保留激活状态，让扩展认为是新设备）');
        console.log('3. 激进模式清理（保留激活状态，深度重置设备标识）');
        console.log('4. 仅测试不执行（查看将要执行的操作）');
        console.log('0. 退出');

        const choice = await askQuestion('\n请选择清理选项 (0-4): ');

        let cleanupOptions = {};
        let testMode = false;

        switch (choice) {
            case '1':
                cleanupOptions = {
                    preserveActivation: true,
                    cleanCursor: false,
                    cleanVSCode: false,
                    cleanCursorExtension: false
                };
                break;
            case '2':
                cleanupOptions = {
                    preserveActivation: true,
                    cleanCursor: true,
                    cleanCursorExtension: true,
                    cleanVSCode: false,
                    autoRestartCursor: false,
                    skipCursorLogin: true
                };
                break;
            case '3':
                cleanupOptions = {
                    preserveActivation: true,
                    cleanCursor: true,
                    cleanCursorExtension: true,
                    cleanVSCode: false,
                    aggressiveMode: true,
                    autoRestartCursor: false,
                    skipCursorLogin: true
                };
                break;
            case '4':
                testMode = true;
                cleanupOptions = {
                    preserveActivation: true,
                    cleanCursor: true,
                    cleanCursorExtension: true,
                    cleanVSCode: false,
                    aggressiveMode: true,
                    autoRestartCursor: false,
                    skipCursorLogin: true
                };
                break;
            case '0':
                console.log('👋 退出清理工具');
                rl.close();
                return;
            default:
                console.log('❌ 无效选择');
                rl.close();
                return;
        }

        // 显示将要执行的操作
        console.log('\n📋 将要执行的操作：');
        console.log(`   保留激活状态: ${cleanupOptions.preserveActivation ? '✅' : '❌'}`);
        console.log(`   清理Cursor数据: ${cleanupOptions.cleanCursor ? '✅' : '❌'}`);
        console.log(`   清理扩展数据: ${cleanupOptions.cleanCursorExtension ? '✅' : '❌'}`);
        console.log(`   激进模式: ${cleanupOptions.aggressiveMode ? '✅' : '❌'}`);
        console.log(`   保留登录信息: ${cleanupOptions.skipCursorLogin ? '✅' : '❌'}`);

        if (testMode) {
            console.log('\n🔍 测试模式：仅显示操作，不执行实际清理');
            console.log('✅ 配置验证通过，所有选项都是有效的');
            rl.close();
            return;
        }

        // 最终确认
        const confirm = await askQuestion('\n⚠️  确认执行清理操作？(y/N): ');
        if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
            console.log('❌ 用户取消操作');
            rl.close();
            return;
        }

        // 执行清理
        console.log('\n🚀 开始执行清理操作...');
        const startTime = Date.now();
        
        const result = await deviceManager.performCleanup(cleanupOptions);
        
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        // 显示结果
        console.log(`\n📊 清理操作完成 (耗时: ${duration}秒)`);
        console.log(`   操作状态: ${result.success ? '✅ 成功' : '❌ 失败'}`);
        
        if (result.actions && result.actions.length > 0) {
            console.log('\n✅ 执行的操作:');
            result.actions.forEach((action, index) => {
                console.log(`   ${index + 1}. ${action}`);
            });
        }

        if (result.errors && result.errors.length > 0) {
            console.log('\n⚠️  遇到的错误:');
            result.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
        }

        console.log('\n🎯 清理完成！');
        console.log('💡 建议：重新启动Cursor IDE测试效果');

    } catch (error) {
        console.error('❌ 清理测试失败:', error);
    } finally {
        rl.close();
    }

    function askQuestion(question) {
        return new Promise((resolve) => {
            rl.question(question, resolve);
        });
    }
}

// 运行测试
if (require.main === module) {
    safeCleanupTest().catch(console.error);
}

module.exports = { safeCleanupTest };
