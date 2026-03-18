import pc from 'picocolors'

export const log = {
  success: (msg) => console.log(pc.green('✅ ') + msg),
  error: (msg) => console.error(pc.red('❌ ') + msg),
  warn: (msg) => console.log(pc.yellow('⚠️  ') + msg),
  info: (msg) => console.log(pc.blue('ℹ️  ') + msg),
  step: (msg) => console.log(pc.cyan('→ ') + msg),
  dim: (msg) => console.log(pc.dim(msg)),
}
