/**
 * MessageQueue 单元测试
 * 
 * 测试消息队列的核心功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MessageQueue } from '../src/core/message-queue'

describe('MessageQueue', () => {
  let queue: MessageQueue

  beforeEach(() => {
    queue = new MessageQueue({ persistent: false }) // 测试时不使用持久化
  })

  afterEach(() => {
    queue.clear()
  })

  describe('基础功能', () => {
    it('应该能够入队和出队', () => {
      const message = { type: 'test', data: 'hello' }
      const id = queue.enqueue(message)

      expect(id).toBeTruthy()
      expect(queue.size).toBe(1)

      const item = queue.dequeue()
      expect(item).toBeTruthy()
      expect(item?.data).toEqual(message)
      expect(queue.size).toBe(0)
    })

    it('应该支持优先级队列', () => {
      queue.enqueue({ data: 'low' }, 'low')
      queue.enqueue({ data: 'high' }, 'high')
      queue.enqueue({ data: 'normal' }, 'normal')

      // 应该按优先级顺序出队：high -> normal -> low
      expect(queue.dequeue()?.data).toEqual({ data: 'high' })
      expect(queue.dequeue()?.data).toEqual({ data: 'normal' })
      expect(queue.dequeue()?.data).toEqual({ data: 'low' })
    })

    it('相同优先级应该按 FIFO 顺序', () => {
      queue.enqueue({ order: 1 }, 'normal')
      queue.enqueue({ order: 2 }, 'normal')
      queue.enqueue({ order: 3 }, 'normal')

      expect(queue.dequeue()?.data).toEqual({ order: 1 })
      expect(queue.dequeue()?.data).toEqual({ order: 2 })
      expect(queue.dequeue()?.data).toEqual({ order: 3 })
    })

    it('队列满时应该移除最低优先级的消息', () => {
      const smallQueue = new MessageQueue({
        enabled: true,
        maxSize: 3,
        persistent: false,
      })

      smallQueue.enqueue({ data: 'high' }, 'high')
      smallQueue.enqueue({ data: 'normal' }, 'normal')
      smallQueue.enqueue({ data: 'low' }, 'low')

      // 队列已满，添加新消息应该移除低优先级的
      smallQueue.enqueue({ data: 'new-high' }, 'high')

      expect(smallQueue.size).toBe(3)
      // low 优先级的应该被移除
      const messages = smallQueue.getAll()
      expect(messages.find(m => (m.data as any).data === 'low')).toBeUndefined()
    })
  })

  describe('队列操作', () => {
    it('peek 应该不移除元素', () => {
      queue.enqueue({ data: 'test' })

      const item1 = queue.peek()
      expect(item1?.data).toEqual({ data: 'test' })
      expect(queue.size).toBe(1)

      const item2 = queue.peek()
      expect(item2?.data).toEqual({ data: 'test' })
      expect(queue.size).toBe(1) // 大小没变
    })

    it('clear 应该清空队列', () => {
      queue.enqueue({ data: '1' })
      queue.enqueue({ data: '2' })
      queue.enqueue({ data: '3' })

      expect(queue.size).toBe(3)

      queue.clear()
      expect(queue.size).toBe(0)
      expect(queue.isEmpty).toBe(true)
    })

    it('应该能够批量出队', () => {
      for (let i = 0; i < 10; i++) {
        queue.enqueue({ index: i })
      }

      const items = queue.dequeueBatch(5)
      expect(items).toHaveLength(5)
      expect(queue.size).toBe(5)
    })
  })

  describe('查找和删除', () => {
    it('应该能够根据 ID 查找消息', () => {
      const id = queue.enqueue({ data: 'test' })

      const found = queue.findById(id)
      expect(found).toBeTruthy()
      expect(found?.id).toBe(id)
    })

    it('应该能够根据 ID 删除消息', () => {
      const id = queue.enqueue({ data: 'test' })
      expect(queue.size).toBe(1)

      const removed = queue.removeById(id)
      expect(removed).toBe(true)
      expect(queue.size).toBe(0)
    })

    it('删除不存在的 ID 应该返回 false', () => {
      const removed = queue.removeById('non-existent-id')
      expect(removed).toBe(false)
    })
  })

  describe('统计信息', () => {
    it('应该提供准确的统计信息', () => {
      queue.enqueue({ data: '1' }, 'high')
      queue.enqueue({ data: '2' }, 'high')
      queue.enqueue({ data: '3' }, 'normal')
      queue.enqueue({ data: '4' }, 'low')

      const stats = queue.getStats()
      expect(stats.total).toBe(4)
      expect(stats.high).toBe(2)
      expect(stats.normal).toBe(1)
      expect(stats.low).toBe(1)
      expect(stats.oldestTimestamp).toBeGreaterThan(0)
      expect(stats.newestTimestamp).toBeGreaterThan(0)
    })
  })

  describe('边界条件', () => {
    it('空队列出队应该返回 null', () => {
      expect(queue.dequeue()).toBeNull()
    })

    it('空队列 peek 应该返回 null', () => {
      expect(queue.peek()).toBeNull()
    })

    it('isEmpty 应该正确反映队列状态', () => {
      expect(queue.isEmpty).toBe(true)

      queue.enqueue({ data: 'test' })
      expect(queue.isEmpty).toBe(false)

      queue.clear()
      expect(queue.isEmpty).toBe(true)
    })
  })

  describe('配置管理', () => {
    it('应该能够获取配置', () => {
      const config = queue.getConfig()
      expect(config.enabled).toBe(true)
      expect(config.maxSize).toBe(1000)
    })

    it('应该能够更新配置', () => {
      queue.updateConfig({ maxSize: 500 })
      const config = queue.getConfig()
      expect(config.maxSize).toBe(500)
    })
  })

  describe('性能测试', () => {
    it('应该能够处理大量消息', () => {
      const count = 1000

      const startTime = performance.now()
      for (let i = 0; i < count; i++) {
        queue.enqueue({ index: i }, i % 3 === 0 ? 'high' : i % 2 === 0 ? 'normal' : 'low')
      }
      const endTime = performance.now()

      expect(queue.size).toBe(count)
      expect(endTime - startTime).toBeLessThan(100) // 应该在 100ms 内完成
    })
  })
})


