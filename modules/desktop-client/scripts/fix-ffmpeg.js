#!/usr/bin/env node

/**
 * 修复ffmpeg.dll缺失问题的脚本
 * 手动复制必要的DLL文件到打包输出目录
 */

const fs = require("fs-extra");
const path = require("path");

async function fixFFmpegDLL() {
  try {
    console.log("🔧 开始修复ffmpeg.dll缺失问题...");

    const electronDistPath = path.join(
      __dirname,
      "../node_modules/electron/dist"
    );
    const outputPath = path.join(__dirname, "../dist-final/win-unpacked");

    // 检查源文件是否存在
    const ffmpegSource = path.join(electronDistPath, "ffmpeg.dll");
    if (!(await fs.pathExists(ffmpegSource))) {
      throw new Error("源文件ffmpeg.dll不存在");
    }

    // 检查输出目录是否存在
    if (!(await fs.pathExists(outputPath))) {
      throw new Error("打包输出目录不存在，请先运行打包命令");
    }

    // 复制ffmpeg.dll
    const ffmpegTarget = path.join(outputPath, "ffmpeg.dll");
    await fs.copy(ffmpegSource, ffmpegTarget);
    console.log("✅ 已复制ffmpeg.dll到输出目录");

    // 复制其他可能需要的DLL文件和资源文件
    const requiredDLLs = [
      "d3dcompiler_47.dll",
      "libEGL.dll",
      "libGLESv2.dll",
      "vk_swiftshader.dll",
      "vulkan-1.dll",
    ];

    const requiredFiles = [
      "icudtl.dat",
      "v8_context_snapshot.bin",
      "snapshot_blob.bin",
    ];

    for (const dll of requiredDLLs) {
      const sourcePath = path.join(electronDistPath, dll);
      const targetPath = path.join(outputPath, dll);

      if (
        (await fs.pathExists(sourcePath)) &&
        !(await fs.pathExists(targetPath))
      ) {
        await fs.copy(sourcePath, targetPath);
        console.log(`✅ 已复制${dll}到输出目录`);
      }
    }

    // 复制必要的资源文件
    for (const file of requiredFiles) {
      const sourcePath = path.join(electronDistPath, file);
      const targetPath = path.join(outputPath, file);

      if (
        (await fs.pathExists(sourcePath)) &&
        !(await fs.pathExists(targetPath))
      ) {
        await fs.copy(sourcePath, targetPath);
        console.log(`✅ 已复制${file}到输出目录`);
      }
    }

    console.log("");
    console.log("🎉 修复完成！现在可以尝试运行应用程序了");
    console.log(`📁 输出目录: ${outputPath}`);
  } catch (error) {
    console.error("❌ 修复失败:", error.message);
    process.exit(1);
  }
}

// 运行修复
fixFFmpegDLL().catch(console.error);
