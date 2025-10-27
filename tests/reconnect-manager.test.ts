/**
 * ReconnectManager 单元测试
 * 
 * 测试重连管理器的核心功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ReconnectManager } from '../src/core/reconnect-manager'

describe('ReconnectManager', () => {
  let manager: ReconnectManager

  beforeEach(() => {
    manager = new ReconnectManager({
      enabled: true,
      delay: 100,
      maxDelay: 1000,
      maxAttempts: 3,
      factor: 2,
      jitter: 0,
    })
  })

  describe('基础功能', () => {
    it('应该正确初始化', () => {
      expect(manager.isEnabled).toBe(true)
      expect(manager.currentAttempt).toBe(0)
      expect(manager.maxAttempts).toBe(3)
    })

    it('应该正确检查最大重连次数', () => {
      expect(manager.isMaxAttemptsReached).toBe(false)

      // 模拟达到最大次数
      for (let i = 0; i < 3; i++) {
        manager['attempts']++
      }

      expect(manager.isMaxAttemptsReached).toBe(true)
    })
  })

  describe('延迟计算', () => {
    it('应该使用指数退避计算延迟', () => {
      // 第一次：100ms
      expect(manager.getNextDelay()).toBe(100)
      manager['attempts'] = 1

      // 第二次：200ms
      expect(manager.getNextDelay()).toBe(200)
      manager['attempts'] = 2

      // 第三次：400ms
      expect(manager.getNextDelay()).toBe(400)
    })

    it('延迟不应超过最大值', () => {
      manager['attempts'] = 10 // 很大的尝试次数

      const delay = manager.getNextDelay()
      expect(delay).toBeLessThanOrEqual(1000) // maxDelay
    })

    it('应该添加随机抖动', () => {
      const managerWithJitter = new ReconnectManager({
        enabled: true,
        delay: 1000,
        maxDelay: 5000,
        factor: 2,
        jitter: 0.1,
      })

      const delays: number[] = []
      for (let i = 0; i < 10; i++) {
        delays.push(managerWithJitter.getNextDelay())
      }

      // 应该有不同的延迟值（因为有随机抖动）
      const uniqueDelays = new Set(delays)
      expect(uniqueDelays.size).toBeGreaterThan(1)
    })
  })

  describe('重连流程', () => {
    it('应该成功重连', async () => {
      const connectFn = vi.fn().mockResolvedValue(undefined)
      const onReconnecting = vi.fn()
      const onReconnected = vi.fn()

      const success = await manager.reconnect(
        connectFn,
        onReconnecting,
        onReconnected
      )

      expect(success).toBe(true)
      expect(connectFn).toHaveBeenCalled()
      expect(onReconnecting).toHaveBeenCalled()
      expect(onReconnected).toHaveBeenCalled()
      expect(manager.currentAttempt).toBe(0) // 成功后重置
    })

    it('应该在达到最大次数后停止重连', async () => {
      const connectFn = vi.fn().mockRejectedValue(new Error('连接失败'))
      const onFailed = vi.fn()

      const success = await manager.reconnect(
        connectFn,
        undefined,
        undefined,
        onFailed
      )

      expect(success).toBe(false)
      expect(connectFn).toHaveBeenCalledTimes(3) // maxAttempts
      expect(onFailed).toHaveBeenCalled()
    })

    it('应该能够取消重连', () => {
      manager.cancel()
      expect(manager['reconnectTimer']).toBeNull()
    })

    it('应该能够重置状态', () => {
      manager['attempts'] = 5
      manager.reset()

      expect(manager.currentAttempt).toBe(0)
      expect(manager['reconnectTimer']).toBeNull()
    })
  })

  describe('配置管理', () => {
    it('应该能够更新配置', () => {
      manager.updateConfig({ maxAttempts: 5, delay: 200 })

      const config = manager.getConfig()
      expect(config.maxAttempts).toBe(5)
      expect(config.delay).toBe(200)
    })

    it('应该能够禁用重连', () => {
      manager.updateConfig({ enabled: false })
      expect(manager.isEnabled).toBe(false)
    })
  })
})


