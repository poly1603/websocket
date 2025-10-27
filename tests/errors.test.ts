/**
 * 错误类单元测试
 * 
 * 测试自定义错误类的功能
 */

import { describe, it, expect } from 'vitest'
import {
  WebSocketError,
  ConnectionError,
  TimeoutError,
  ProtocolError,
  QueueFullError,
  EncryptionError,
  isRetryableError,
  createErrorFromNative,
} from '../src/core/errors'

describe('自定义错误类', () => {
  describe('WebSocketError', () => {
    it('应该创建基础错误', () => {
      const error = new WebSocketError('测试错误')

      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(WebSocketError)
      expect(error.message).toBe('测试错误')
      expect(error.name).toBe('WebSocketError')
      expect(error.retryable).toBe(false)
    })

    it('应该支持自定义选项', () => {
      const originalError = new Error('原始错误')
      const error = new WebSocketError('测试错误', {
        code: 4000,
        retryable: true,
        originalError,
      })

      expect(error.code).toBe(4000)
      expect(error.retryable).toBe(true)
      expect(error.originalError).toBe(originalError)
    })
  })

  describe('ConnectionError', () => {
    it('应该默认可重试', () => {
      const error = new ConnectionError('连接失败')

      expect(error).toBeInstanceOf(ConnectionError)
      expect(error).toBeInstanceOf(WebSocketError)
      expect(error.name).toBe('ConnectionError')
      expect(error.retryable).toBe(true) // 连接错误默认可重试
    })
  })

  describe('TimeoutError', () => {
    it('应该包含超时时间', () => {
      const error = new TimeoutError('操作超时', 5000)

      expect(error).toBeInstanceOf(TimeoutError)
      expect(error.name).toBe('TimeoutError')
      expect(error.timeout).toBe(5000)
      expect(error.retryable).toBe(true)
    })
  })

  describe('ProtocolError', () => {
    it('应该包含接收到的数据', () => {
      const receivedData = { invalid: 'format' }
      const error = new ProtocolError('协议错误', { receivedData })

      expect(error).toBeInstanceOf(ProtocolError)
      expect(error.name).toBe('ProtocolError')
      expect(error.receivedData).toEqual(receivedData)
      expect(error.retryable).toBe(false) // 协议错误不应重试
    })
  })

  describe('QueueFullError', () => {
    it('应该包含队列信息', () => {
      const error = new QueueFullError(1000, 1000)

      expect(error).toBeInstanceOf(QueueFullError)
      expect(error.queueSize).toBe(1000)
      expect(error.maxSize).toBe(1000)
      expect(error.message).toContain('1000/1000')
    })
  })

  describe('EncryptionError', () => {
    it('应该包含操作类型', () => {
      const encryptError = new EncryptionError('加密失败', 'encrypt')
      const decryptError = new EncryptionError('解密失败', 'decrypt')

      expect(encryptError.operation).toBe('encrypt')
      expect(decryptError.operation).toBe('decrypt')
      expect(encryptError.retryable).toBe(false)
    })
  })

  describe('工具函数', () => {
    it('isRetryableError 应该正确判断', () => {
      const retryable = new ConnectionError('连接失败')
      const nonRetryable = new ProtocolError('协议错误')
      const normalError = new Error('普通错误')

      expect(isRetryableError(retryable)).toBe(true)
      expect(isRetryableError(nonRetryable)).toBe(false)
      expect(isRetryableError(normalError)).toBe(false)
    })

    it('createErrorFromNative 应该创建对应的错误类型', () => {
      const timeoutError = new Error('timeout occurred')
      const connectionError = new Error('connection failed')
      const unknownError = new Error('unknown issue')

      expect(createErrorFromNative(timeoutError)).toBeInstanceOf(TimeoutError)
      expect(createErrorFromNative(connectionError)).toBeInstanceOf(ConnectionError)
      expect(createErrorFromNative(unknownError)).toBeInstanceOf(WebSocketError)
    })
  })

  describe('instanceof 检查', () => {
    it('应该正确支持 instanceof', () => {
      const errors = [
        new WebSocketError('test'),
        new ConnectionError('test'),
        new TimeoutError('test', 1000),
        new ProtocolError('test'),
        new QueueFullError(10, 10),
        new EncryptionError('test', 'encrypt'),
      ]

      errors.forEach(error => {
        expect(error instanceof Error).toBe(true)
        expect(error instanceof WebSocketError).toBe(true)
      })
    })
  })
})


