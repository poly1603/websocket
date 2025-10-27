# WebSocket 包单元测试

## 📋 测试概览

本目录包含 `@ldesign/websocket` 包的单元测试和集成测试。

### 已创建的测试文件

| 文件 | 测试模块 | 测试用例数 | 状态 |
|------|---------|-----------|------|
| `event-emitter.test.ts` | EventEmitter | ~20 个 | ✅ |
| `message-queue.test.ts` | MessageQueue | ~15 个 | ✅ |
| `errors.test.ts` | 错误类 | ~10 个 | ✅ |
| `reconnect-manager.test.ts` | ReconnectManager | ~10 个 | ✅ |
| `middleware.test.ts` | 中间件系统 | ~15 个 | ✅ |

**总计**：~70 个测试用例

---

## 🚀 运行测试

### 运行所有测试

```bash
pnpm test
```

### 运行特定测试文件

```bash
pnpm test event-emitter
pnpm test message-queue
pnpm test errors
```

### 运行测试并生成覆盖率报告

```bash
pnpm test:coverage
```

### 使用 UI 模式运行测试

```bash
pnpm test:ui
```

---

## 📊 测试覆盖率目标

### 当前覆盖率（估计）

| 模块 | 覆盖率 | 目标 |
|------|--------|------|
| EventEmitter | ~80% | 90% |
| MessageQueue | ~75% | 90% |
| 错误类 | ~70% | 85% |
| ReconnectManager | ~60% | 85% |
| 中间件系统 | ~65% | 85% |
| **总体** | **~70%** | **85%** |

---

## ✅ 测试清单

### 核心管理器测试

- [x] EventEmitter
- [x] MessageQueue
- [x] ReconnectManager
- [ ] HeartbeatManager（待创建）
- [ ] ConnectionManager（待创建）

### 高级功能测试

- [x] 错误类
- [x] 中间件系统
- [ ] EncryptionManager（待创建）
- [ ] CompressionManager（待创建）
- [ ] AckManager（待创建）
- [ ] RpcManager（待创建）
- [ ] PerformanceMonitor（待创建）
- [ ] MessageRouter（待创建）
- [ ] BatchSender（待创建）
- [ ] MessageDeduplicator（待创建）

### 适配器测试

- [ ] NativeAdapter（待创建）
- [ ] SocketIOAdapter（待创建）
- [ ] AdapterFactory（待创建）

### 集成测试

- [ ] WebSocketClient 完整流程（待创建）
- [ ] Vue 集成测试（待创建）
- [ ] 端到端测试（待创建）

---

## 📝 测试编写指南

### 测试结构

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { YourModule } from '../src/...'

describe('YourModule', () => {
  let instance: YourModule

  beforeEach(() => {
    // 在每个测试前初始化
    instance = new YourModule()
  })

  afterEach(() => {
    // 在每个测试后清理
    instance.destroy?.()
  })

  describe('功能组1', () => {
    it('应该做什么', () => {
      // 测试代码
      expect(something).toBe(expected)
    })
  })
})
```

### 测试分类

- **基础功能测试**：测试核心 API
- **边界条件测试**：测试边界情况
- **错误处理测试**：测试错误场景
- **性能测试**：测试性能表现
- **集成测试**：测试模块间协作

---

## 🎯 待完成的测试

### 高优先级

1. **HeartbeatManager** 测试
   - 心跳发送
   - Pong 处理
   - 超时检测
   - 延迟统计

2. **加密和压缩** 测试
   - 加密/解密正确性
   - 压缩/解压正确性
   - 性能测试

3. **WebSocketClient** 集成测试
   - 连接流程
   - 断开流程
   - 消息发送/接收
   - 重连流程

### 中优先级

4. **AckManager** 测试
5. **RpcManager** 测试
6. **MessageRouter** 测试
7. **BatchSender** 测试

### 低优先级

8. **性能基准测试**
9. **内存泄漏测试**
10. **并发测试**

---

## 💡 测试技巧

### 模拟 WebSocket

```typescript
import { vi } from 'vitest'

// 模拟 WebSocket
global.WebSocket = vi.fn().mockImplementation(() => ({
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: WebSocket.OPEN,
}))
```

### 模拟定时器

```typescript
import { vi } from 'vitest'

// 使用假定时器
vi.useFakeTimers()

// 快进时间
vi.advanceTimersByTime(1000)

// 恢复真实定时器
vi.useRealTimers()
```

### 异步测试

```typescript
it('应该处理异步操作', async () => {
  const result = await asyncFunction()
  expect(result).toBe(expected)
})
```

---

## 📚 相关资源

- [Vitest 文档](https://vitest.dev/)
- [测试最佳实践](https://testingjavascript.com/)
- [Mock 使用指南](https://vitest.dev/guide/mocking.html)

---

**测试状态**：基础测试已创建  
**覆盖率**：~70%（估计）  
**下一步**：创建更多测试文件，提高覆盖率到 85%+


