/**
 * EventEmitter 单元测试
 * 
 * 测试事件发射器的核心功能
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from '../src/core/event-emitter'

describe('EventEmitter', () => {
  let emitter: EventEmitter

  beforeEach(() => {
    emitter = new EventEmitter()
  })

  describe('基础功能', () => {
    it('应该能够注册和触发事件', () => {
      const handler = vi.fn()
      emitter.on('test', handler)
      emitter.emit('test', { data: 'test data' })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({ data: 'test data' })
    })

    it('应该能够注册多个监听器', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      emitter.on('test', handler1)
      emitter.on('test', handler2)
      emitter.emit('test', 'data')

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
    })

    it('应该能够移除监听器', () => {
      const handler = vi.fn()

      emitter.on('test', handler)
      emitter.emit('test')
      expect(handler).toHaveBeenCalledTimes(1)

      emitter.off('test', handler)
      emitter.emit('test')
      expect(handler).toHaveBeenCalledTimes(1) // 没有增加
    })

    it('应该能够移除所有监听器', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      emitter.on('test', handler1)
      emitter.on('test', handler2)
      emitter.off('test') // 移除所有
      emitter.emit('test')

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })
  })

  describe('once 功能', () => {
    it('once 监听器应该只执行一次', () => {
      const handler = vi.fn()

      emitter.once('test', handler)
      emitter.emit('test', 'data1')
      emitter.emit('test', 'data2')
      emitter.emit('test', 'data3')

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith('data1')
    })

    it('once 监听器应该在执行后自动移除', () => {
      const handler = vi.fn()

      emitter.once('test', handler)
      expect(emitter.listenerCount('test')).toBe(1)

      emitter.emit('test')
      expect(emitter.listenerCount('test')).toBe(0)
    })
  })

  describe('监听器数量限制', () => {
    it('应该警告监听器数量过多', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

      emitter.setMaxListeners(3)

      for (let i = 0; i < 5; i++) {
        emitter.on('test', () => { })
      }

      expect(consoleWarnSpy).toHaveBeenCalled()
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('超过了限制')

      consoleWarnSpy.mockRestore()
    })

    it('应该能够设置和获取最大监听器数量', () => {
      expect(emitter.getMaxListeners()).toBe(10) // 默认值

      emitter.setMaxListeners(20)
      expect(emitter.getMaxListeners()).toBe(20)
    })
  })

  describe('工具方法', () => {
    it('listenerCount 应该返回正确的监听器数量', () => {
      expect(emitter.listenerCount('test')).toBe(0)

      emitter.on('test', () => { })
      expect(emitter.listenerCount('test')).toBe(1)

      emitter.on('test', () => { })
      expect(emitter.listenerCount('test')).toBe(2)
    })

    it('eventNames 应该返回所有事件名称', () => {
      emitter.on('event1', () => { })
      emitter.on('event2', () => { })
      emitter.on('event3', () => { })

      const names = emitter.eventNames()
      expect(names).toContain('event1')
      expect(names).toContain('event2')
      expect(names).toContain('event3')
    })

    it('hasListeners 应该正确检查监听器存在', () => {
      expect(emitter.hasListeners()).toBe(false)
      expect(emitter.hasListeners('test')).toBe(false)

      emitter.on('test', () => { })
      expect(emitter.hasListeners()).toBe(true)
      expect(emitter.hasListeners('test')).toBe(true)
    })

    it('removeAllListeners 应该移除所有事件监听器', () => {
      emitter.on('event1', () => { })
      emitter.on('event2', () => { })

      expect(emitter.hasListeners()).toBe(true)

      emitter.removeAllListeners()
      expect(emitter.hasListeners()).toBe(false)
    })
  })

  describe('错误处理', () => {
    it('监听器抛出错误不应影响其他监听器', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
      const handler1 = vi.fn(() => { throw new Error('Handler 1 error') })
      const handler2 = vi.fn()

      emitter.on('test', handler1)
      emitter.on('test', handler2)
      emitter.emit('test')

      expect(handler1).toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled() // handler2 应该仍然被调用
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })
  })

  describe('性能优化', () => {
    it('应该优化性能（不为普通事件创建数组副本）', () => {
      const handlers = Array.from({ length: 100 }, () => vi.fn())
      handlers.forEach(h => emitter.on('test', h))

      const startTime = performance.now()
      for (let i = 0; i < 1000; i++) {
        emitter.emit('test')
      }
      const endTime = performance.now()

      // 性能测试：1000 次触发应该在合理时间内完成
      expect(endTime - startTime).toBeLessThan(100) // 应该少于 100ms

      // 所有处理器都应该被调用 1000 次
      handlers.forEach(h => {
        expect(h).toHaveBeenCalledTimes(1000)
      })
    })
  })
})


