import { type Request, type Response } from 'express'

/**
 * HTTP Bearer Token 身份验证中间件
 *
 * 此中间件为所有 HTTP 端点（SSE、WebSocket 和 Streamable HTTP）提供基于 Token 的身份验证
 * 使用 HTTP_API_TOKEN 环境变量进行配置。
 *
 * 身份验证流程：
 * 1. 如果未设置 HTTP_API_TOKEN，身份验证被禁用（允许匿名访问）
 * 2. 如果设置了 HTTP_API_TOKEN，所有请求必须包含有效的 Bearer Token
 * 3. Token 必须在 Authorization 头中提供："Authorization: Bearer <token>"
 * 4. 提供的 Token 必须与 HTTP_API_TOKEN 环境变量完全匹配
 *
 * 环境变量：
 * HTTP_API_TOKEN - 用于身份验证的密钥令牌
 * 示例：export HTTP_API_TOKEN="your-secret-token"
 *
 * 使用示例：
 * - 使用身份验证：curl -H "Authorization: Bearer your-secret-token" http://localhost:8000/sse
 * - 不使用身份验证：curl http://localhost:8000/sse（当未设置 HTTP_API_TOKEN 时）
 *
 * 支持的模式：
 * - stdio → SSE 模式
 * - stdio → WebSocket 模式
 * - stdio → Streamable HTTP 模式（有状态和无状态）
 * - SSE → stdio 模式（客户端模式不受影响）
 * - Streamable HTTP → stdio 模式（客户端模式不受影响）
 */
async function authenticateToken(
  req: Request,
  res: Response,
  next: () => void,
) {
  const token = process.env.HTTP_API_TOKEN
  if (!token) {
    return next() // 未设置token，允许匿名访问
  }

  const authHeader = req.headers['authorization']
  const bearerToken = authHeader && authHeader.split(' ')[1]

  if (
    !authHeader?.startsWith('Bearer ') ||
    !bearerToken ||
    bearerToken !== token
  ) {
    return res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Unauthorized: Invalid or missing token',
      },
      id: null,
    })
  }

  next()
}
export { authenticateToken }
