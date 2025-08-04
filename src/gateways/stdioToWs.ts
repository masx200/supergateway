import express from 'express'
import cors, { type CorsOptions } from 'cors'
import { IncomingMessage, createServer } from 'http'
import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import { Logger } from '../types.js'
import { getVersion } from '../lib/getVersion.js'
import { WebSocketServerTransport } from '../server/websocket.js'
import { onSignals } from '../lib/onSignals.js'
import { serializeCorsOrigin } from '../lib/serializeCorsOrigin.js'
import type { VerifyClientCallbackAsync, VerifyClientCallbackSync } from 'ws'

export interface StdioToWsArgs {
  stdioCmd: string
  port: number
  messagePath: string
  logger: Logger
  corsOrigin: CorsOptions['origin']
  healthEndpoints: string[]
}

export async function stdioToWs(args: StdioToWsArgs) {
  const { stdioCmd, port, messagePath, logger, healthEndpoints, corsOrigin } =
    args
  logger.info(`  - port: ${port}`)
  logger.info(`  - stdio: ${stdioCmd}`)
  logger.info(`  - messagePath: ${messagePath}`)
  logger.info(
    `  - CORS: ${
      corsOrigin
        ? `enabled (${serializeCorsOrigin({ corsOrigin })})`
        : 'disabled'
    }`,
  )
  logger.info(
    `  - Health endpoints: ${
      healthEndpoints.length ? healthEndpoints.join(', ') : '(none)'
    }`,
  )

  let wsTransport: WebSocketServerTransport | null = null
  let child: ChildProcessWithoutNullStreams | null = null
  let isReady = false

  const cleanup = () => {
    if (wsTransport) {
      wsTransport.close().catch((err) => {
        logger.error(`Error stopping WebSocket server: ${err.message}`)
      })
    }
    if (child) {
      child.kill()
    }
  }

  onSignals({
    logger,
    cleanup,
  })

  try {
    child = spawn(stdioCmd, { shell: true, env: process.env })
    child.on('exit', (code, signal) => {
      logger.error(`Child exited: code=${code}, signal=${signal}`)
      cleanup()
      process.exit(code ?? 1)
    })

    const server = new Server(
      { name: 'supergateway', version: getVersion() },
      { capabilities: {} },
    )

    // Handle child process output
    let buffer = ''
    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8')
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''
      lines.forEach((line) => {
        if (!line.trim()) return
        try {
          const jsonMsg = JSON.parse(line)
          logger.info(`Child → WebSocket: ${JSON.stringify(jsonMsg)}`)
          // Broadcast to all connected clients
          wsTransport?.send(jsonMsg, jsonMsg.id).catch((err) => {
            logger.error('Failed to broadcast message:', err)
          })
        } catch {
          logger.error(`Child non-JSON: ${line}`)
        }
      })
    })

    child.stderr.on('data', (chunk: Buffer) => {
      logger.info(`Child stderr: ${chunk.toString('utf8')}`)
    })

    const app = express()

    if (corsOrigin) {
      app.use(cors({ origin: corsOrigin }))
    }

    for (const ep of healthEndpoints) {
      app.get(ep, (_req, res) => {
        if (child?.killed) {
          res.status(500).send('Child process has been killed')
        }

        if (!isReady) {
          res.status(500).send('Server is not ready')
        }

        res.send('ok')
      })
    }

    const httpServer = createServer(app)
    const verifyClient:
      | VerifyClientCallbackAsync
      | VerifyClientCallbackSync
      | undefined = process.env.HTTP_API_TOKEN
      ? async function (info, callback) {
          const request = info.req as IncomingMessage
          const authHeader = request.headers['authorization']
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            callback(false)
            return
          }
          const token = authHeader.slice(7)
          callback(validateBearerToken(token))
        }
      : undefined
    wsTransport = new WebSocketServerTransport({
      path: messagePath,
      server: httpServer,
      verifyClient,
    })

    await server.connect(wsTransport)

    wsTransport.onmessage = (msg: JSONRPCMessage) => {
      const line = JSON.stringify(msg)
      logger.info(`WebSocket → Child: ${line}`)
      child!.stdin.write(line + '\n')
    }

    wsTransport.onconnection = (clientId: string) => {
      logger.info(`New WebSocket connection: ${clientId}`)
    }

    wsTransport.ondisconnection = (clientId: string) => {
      logger.info(`WebSocket connection closed: ${clientId}`)
    }

    wsTransport.onerror = (err: Error) => {
      logger.error(`WebSocket error: ${err.message}`)
    }

    isReady = true
    httpServer.on('error', (err) => {
      logger.error(`Error starting server: ${err.message}`)
      cleanup()
      process.exit(1)
    })

    // 模拟验证函数（可替换为 JWT 验证逻辑）
    function validateBearerToken(token: string) {
      // 示例：简单对比
      return token === process.env.HTTP_API_TOKEN
    }
    httpServer.on('upgrade', (request, socket, head) => {
      if (process.env.HTTP_API_TOKEN) {
        const authHeader = request.headers['authorization']
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
          socket.destroy()
          return
        }

        const token = authHeader.slice(7) // 去掉 "Bearer "

        if (!validateBearerToken(token)) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
          socket.destroy()
          return
        }
      }
      if (!wsTransport) {
        throw new Error('wsTransport is not defined')
      }
      const wss = wsTransport.wss
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request)
      })
    })
    httpServer.listen(port, () => {
      logger.info(`Listening on port ${port}`)
      logger.info(`WebSocket endpoint: ws://localhost:${port}${messagePath}`)

      const token = process.env.HTTP_API_TOKEN
      if (token) {
        console.log('HTTP API token authentication enabled,token:', token)
      } else {
        console.log(
          'HTTP API token authentication disabled (anonymous access allowed)',
        )
      }
    })
  } catch (err: any) {
    logger.error(`Failed to start: ${err.message}`)
    cleanup()
    process.exit(1)
  }
}
