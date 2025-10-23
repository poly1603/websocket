/**
 * @ldesign/websocket - 完整导出
 * 
 * 包含核心功能和所有扩展功能
 */

// ============ 核心功能 ============
export * from './index.core'

// ============ Vue 集成 ============
export * from './vue'

// ============ Socket.IO 适配器（动态加载） ============
// Socket.IO 适配器通过 AdapterFactory 动态加载
// 如需使用，请安装 socket.io-client: npm install socket.io-client
