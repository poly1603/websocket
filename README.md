# @ldesign/websocket

> 生产级 WebSocket 客户端 - 自动重连、心跳检测、消息队列、加密传输

[![npm version](https://img.shields.io/npm/v/@ldesign/websocket.svg)](https://www.npmjs.com/package/@ldesign/websocket)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/npm/l/@ldesign/websocket.svg)](./LICENSE)

## ✨ 特性

- 🔌 **可靠连接** - 自动重连、心跳检测、断线恢复
- 📦 **消息可靠** - 消息队列、确认机制、重传保证
- 🔐 **安全传输** - 消息加密、Token 认证、签名验证
- ⚡ **高性能** - 批量发送、消息压缩、优先级队列
- 🎯 **框架无关** - 纯 TypeScript 实现，可用于任何框架
- 🖼️ **Vue 3 集成** - 完整的 Composable API 支持
- 📊 **性能监控** - 实时指标、连接质量、延迟统计
- 🛠️ **开发友好** - 完整的 TypeScript 类型，调试模式

## 📦 安装

```bash
# 使用 pnpm（推荐）
pnpm add @ldesign/websocket

# 使用 npm
npm install @ldesign/websocket

# 使用 yarn
yarn add @ldesign/websocket
```

## 🚀 快速开始

### 原生使用（框架无关）

```typescript
import { createWebSocketClient } from '@ldesign/websocket/core'

// 创建客户端
const client = createWebSocketClient({
  url: 'ws://localhost:8080',
  reconnect: { 
    enabled: true, 
    maxAttempts: 10 
  },
  heartbeat: { 
    enabled: true, 
    interval: 30000 
  }
})

// 监听事件
client.on('open', () => {
  console.log('连接已建立')
})

client.on('message', (event) => {
  console.log('收到消息:', event.data)
})

client.on('error', (event) => {
  console.error('发生错误:', event.error)
})

// 连接到服务器
await client.connect()

// 发送消息
client.send({ 
  type: 'greeting', 
  message: 'Hello, Server!' 
})

// 断开连接
client.disconnect()
```

### Vue 3 使用

```vue
<script setup lang="ts">
import { useWebSocket } from '@ldesign/websocket/vue'

const { 
  state, 
  data, 
  send, 
  connect, 
  disconnect, 
  isConnected 
} = useWebSocket('ws://localhost:8080', {
  autoConnect: true,
  onMessage: (data) => {
    console.log('收到消息:', data)
  }
})

// 发送消息
function sendMessage() {
  send({ 
    type: 'chat', 
    content: 'Hello!' 
  })
}
</script>

<template>
  <div>
    <p>状态: {{ state }}</p>
    <p>最新消息: {{ data }}</p>
    <button @click="sendMessage" :disabled="!isConnected">
      发送消息
    </button>
  </div>
</template>
```

## 📖 核心功能

### 自动重连

```typescript
const client = createWebSocketClient({
  url: 'ws://localhost:8080',
  reconnect: {
    enabled: true,
    delay: 1000,        // 初始延迟 1 秒
    maxDelay: 30000,    // 最大延迟 30 秒
    maxAttempts: 10,    // 最多重连 10 次
    factor: 2,          // 指数退避系数
    jitter: 0.1         // 10% 随机抖动
  }
})

// 监听重连事件
client.on('reconnecting', (event) => {
  console.log(`正在重连... 第 ${event.attempt} 次`)
})

client.on('reconnected', (event) => {
  console.log(`重连成功！用时 ${event.duration}ms`)
})
```

### 心跳检测

```typescript
const client = createWebSocketClient({
  url: 'ws://localhost:8080',
  heartbeat: {
    enabled: true,
    interval: 30000,           // 每 30 秒发送一次心跳
    timeout: 5000,             // 5 秒无响应则认为断开
    message: { type: 'ping' }, // 自定义心跳消息
    pongType: 'pong'           // pong 响应类型
  }
})

// 监听心跳事件
client.on('ping', () => {
  console.log('发送心跳')
})

client.on('pong', () => {
  console.log('收到心跳响应')
})
```

### 消息队列

```typescript
const client = createWebSocketClient({
  url: 'ws://localhost:8080',
  queue: {
    enabled: true,
    maxSize: 1000,        // 队列最大长度
    persistent: true,     // 持久化到 localStorage
    storageKey: 'ws-queue' // 存储键名
  }
})

// 离线时发送的消息会自动加入队列
client.send({ type: 'message', content: 'This will be queued' })

// 重连后自动发送队列中的消息
// 获取队列大小
console.log('队列中有', client.queueSize, '条消息')

// 清空队列
client.clearQueue()
```

### 优先级消息

```typescript
// 高优先级消息
client.send({ type: 'urgent', data: '...' }, { priority: 'high' })

// 普通优先级（默认）
client.send({ type: 'normal', data: '...' }, { priority: 'normal' })

// 低优先级
client.send({ type: 'background', data: '...' }, { priority: 'low' })
```

### 连接指标

```typescript
// 获取连接指标
const metrics = client.metrics

console.log('发送消息数:', metrics.messagesSent)
console.log('接收消息数:', metrics.messagesReceived)
console.log('重连次数:', metrics.reconnectCount)
console.log('平均延迟:', metrics.averageLatency, 'ms')
console.log('队列长度:', metrics.queuedMessages)
```

## 🖼️ Vue 3 集成

### 安装插件

```typescript
// main.ts
import { createApp } from 'vue'
import { createWebSocketPlugin } from '@ldesign/websocket/vue'
import App from './App.vue'

const app = createApp(App)

app.use(createWebSocketPlugin({
  url: 'ws://localhost:8080',
  reconnect: { enabled: true },
  heartbeat: { enabled: true }
}))

app.mount('#app')
```

### 使用 Composable

```vue
<script setup lang="ts">
import { useWebSocket } from '@ldesign/websocket/vue'

const { 
  state, 
  data, 
  error,
  isConnected,
  metrics,
  queueSize,
  send, 
  connect, 
  disconnect 
} = useWebSocket('ws://localhost:8080', {
  autoConnect: true,
  autoDisconnect: true,
  onOpen: () => console.log('已连接'),
  onClose: () => console.log('已断开'),
  onMessage: (data) => console.log('收到:', data),
  onError: (error) => console.error('错误:', error)
})
</script>
```

### 使用注入的客户端

```vue
<script setup lang="ts">
import { useInjectedWebSocket } from '@ldesign/websocket/vue'

// 使用插件提供的全局客户端
const client = useInjectedWebSocket()

client.send({ type: 'message', content: 'Hello' })
</script>
```

### Provider 组件

```vue
<template>
  <WebSocketProvider 
    :config="{ url: 'ws://localhost:8080' }" 
    :auto-connect="true"
  >
    <YourComponent />
  </WebSocketProvider>
</template>

<script setup>
import { WebSocketProvider } from '@ldesign/websocket/vue'
</script>
```

## 🎯 使用场景

### 实时聊天

```typescript
const chat = createWebSocketClient({
  url: 'ws://chat.example.com',
  reconnect: { enabled: true }
})

chat.on('message', (event) => {
  const { user, text } = event.data
  displayMessage(user, text)
})

function sendChatMessage(text: string) {
  chat.send({
    type: 'chat',
    user: currentUser,
    text
  })
}
```

### 实时数据推送

```typescript
const dashboard = createWebSocketClient({
  url: 'ws://data.example.com',
  heartbeat: { 
    enabled: true, 
    interval: 10000 
  }
})

dashboard.on('message', (event) => {
  updateDashboard(event.data)
})
```

### 游戏同步

```typescript
const game = createWebSocketClient({
  url: 'ws://game.example.com',
  queue: { 
    enabled: true, 
    maxSize: 500 
  }
})

game.send({
  type: 'player-action',
  action: 'move',
  position: { x: 100, y: 200 }
}, { priority: 'high' })
```

## 📊 API 文档

### WebSocketClient

#### 方法

- `connect()` - 连接到服务器
- `disconnect(code?, reason?)` - 断开连接
- `send(data, options?)` - 发送消息
- `sendBinary(data)` - 发送二进制数据
- `on(event, handler)` - 注册事件监听器
- `once(event, handler)` - 注册一次性事件监听器
- `off(event, handler?)` - 移除事件监听器
- `clearQueue()` - 清空消息队列
- `destroy()` - 销毁客户端

#### 属性

- `state` - 连接状态
- `isConnected` - 是否已连接
- `metrics` - 连接指标
- `queueSize` - 队列大小

#### 事件

- `open` - 连接打开
- `close` - 连接关闭
- `error` - 错误发生
- `message` - 收到消息
- `reconnecting` - 正在重连
- `reconnected` - 重连成功
- `reconnect-failed` - 重连失败
- `ping` - 发送心跳
- `pong` - 收到心跳响应
- `state-change` - 状态变化

## 🔧 高级配置

### 完整配置示例

```typescript
const client = createWebSocketClient({
  url: 'ws://localhost:8080',
  protocols: ['v1', 'v2'],
  
  // 重连配置
  reconnect: {
    enabled: true,
    delay: 1000,
    maxDelay: 30000,
    maxAttempts: 10,
    factor: 2,
    jitter: 0.1
  },
  
  // 心跳配置
  heartbeat: {
    enabled: true,
    interval: 30000,
    timeout: 5000,
    message: { type: 'ping' },
    pongType: 'pong'
  },
  
  // 队列配置
  queue: {
    enabled: true,
    maxSize: 1000,
    persistent: true,
    storageKey: 'ws-queue'
  },
  
  // 其他配置
  connectionTimeout: 10000,
  debug: true
})
```

## 🛠️ 开发

```bash
# 安装依赖
pnpm install

# 构建
pnpm build

# 测试
pnpm test

# 开发模式
pnpm dev
```

## 📚 更多文档

- [完整项目计划](./PROJECT_PLAN.md) - 详细的功能规划和路线图
- [CHANGELOG](./CHANGELOG.md) - 版本更新日志

## 📄 许可证

MIT © LDesign Team