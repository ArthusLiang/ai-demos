const fs = require('fs');
const path = require('path');

function copyFolderSync(source, target) {
  // 创建目标文件夹
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target);
  }

  // 获取源文件夹中的所有文件和子文件夹
  const files = fs.readdirSync(source);

  // 遍历源文件夹中的所有文件和子文件夹
  files.forEach(file => {
    const sourcePath = path.join(source, file);
    const targetPath = path.join(target, file);

    // 判断当前项是否为文件夹
    if (fs.lstatSync(sourcePath).isDirectory()) {
      // 是文件夹，递归复制子文件夹
      copyFolderSync(sourcePath, targetPath);
    } else {
      // 是文件，直接复制文件
      fs.copyFileSync(sourcePath, targetPath);
    }
  });
}

// 调用函数进行文件夹复制
const sourceFolder = path.resolve(__dirname, '../models');
const targetFolder = path.resolve(__dirname, '../dist');

copyFolderSync(sourceFolder, targetFolder);