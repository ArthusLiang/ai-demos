const { execSync } = require('child_process');

// 定义要清理的端口号
const port = 32555;

try {
  // 执行清理命令并获取输出
  const output = execSync(`lsof -i:${port}`).toString();

  // 提取进程ID
  const pid = output.match(/\d+/)[0];

  // 终止占用端口的进程
  execSync(`kill ${pid}`);
  
  console.log(`已成功清理端口 ${port}`);
} catch (error) {
  console.error(`执行命令时出错： ${error.message}`);
}