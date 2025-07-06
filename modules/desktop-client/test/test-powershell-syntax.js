const { spawn } = require('child_process');
const path = require('path');

// 测试PowerShell脚本语法
async function testPowerShellSyntax() {
  console.log("🔍 测试PowerShell脚本语法...\n");

  const scripts = [
    'scripts/powershell/ide-reset-simple.ps1',
    'scripts/powershell/ide-reset-ultimate.ps1',
    'scripts/powershell/ps-assist.ps1'
  ];

  let allScriptsValid = true;

  for (const scriptPath of scripts) {
    console.log(`🧪 测试脚本: ${path.basename(scriptPath)}`);
    
    try {
      const result = await testScriptSyntax(scriptPath);
      
      if (result.success) {
        console.log(`   结果: ✅ 语法正确`);
      } else {
        console.log(`   结果: ❌ 语法错误`);
        console.log(`   错误: ${result.error}`);
        allScriptsValid = false;
      }
    } catch (error) {
      console.log(`   结果: ❌ 测试失败`);
      console.log(`   错误: ${error.message}`);
      allScriptsValid = false;
    }
  }

  console.log(`\n🎯 PowerShell脚本测试总结:`);
  console.log(`   总体结果: ${allScriptsValid ? "✅ 所有脚本语法正确" : "❌ 发现语法问题"}`);
  
  return allScriptsValid;
}

function testScriptSyntax(scriptPath) {
  return new Promise((resolve) => {
    // 使用PowerShell的语法检查功能
    const powershell = spawn('powershell', [
      '-NoProfile',
      '-Command',
      `try { $null = [System.Management.Automation.PSParser]::Tokenize((Get-Content '${scriptPath}' -Raw), [ref]$null); Write-Output 'SYNTAX_OK' } catch { Write-Output "SYNTAX_ERROR: $($_.Exception.Message)" }`
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });

    let output = '';
    let error = '';

    powershell.stdout.on('data', (data) => {
      output += data.toString();
    });

    powershell.stderr.on('data', (data) => {
      error += data.toString();
    });

    powershell.on('close', (code) => {
      if (output.includes('SYNTAX_OK')) {
        resolve({ success: true });
      } else if (output.includes('SYNTAX_ERROR:')) {
        resolve({ 
          success: false, 
          error: output.replace('SYNTAX_ERROR:', '').trim() 
        });
      } else {
        resolve({ 
          success: false, 
          error: error || `Exit code: ${code}` 
        });
      }
    });

    powershell.on('error', (err) => {
      resolve({ 
        success: false, 
        error: `Failed to start PowerShell: ${err.message}` 
      });
    });

    // 设置超时
    setTimeout(() => {
      powershell.kill();
      resolve({ 
        success: false, 
        error: 'Timeout' 
      });
    }, 10000);
  });
}

// 运行测试
if (require.main === module) {
  testPowerShellSyntax().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(console.error);
}

module.exports = { testPowerShellSyntax };
