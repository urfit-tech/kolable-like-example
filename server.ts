import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { AppRepository, Member, createLodestarDataSource } from 'lodestar-sdk'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const publicDir = path.join(__dirname, 'public')

dotenv.config({ path: path.join(__dirname, '.env') })

const postgresUrl = process.env.POSTGRES_URL
const port = Number(process.env.PORT || 3000)

if (!postgresUrl) {
  throw new Error('Missing POSTGRES_URL in environment variables')
}

const dataSource = createLodestarDataSource({ url: postgresUrl })
const appRepo = new AppRepository(dataSource)

async function listenWithFallback(app: express.Express, startPort: number, maxAttempts = 10) {
  let currentPort = startPort
  let attempts = 0

  while (attempts < maxAttempts) {
    attempts += 1
    try {
      const server = await new Promise<ReturnType<express.Express['listen']>>((resolve, reject) => {
        const nextServer = app.listen(currentPort, () => resolve(nextServer))
        nextServer.once('error', reject)
      })
      return { server, boundPort: currentPort }
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException
      if (nodeError.code !== 'EADDRINUSE' || attempts >= maxAttempts) {
        throw error
      }
      currentPort += 1
    }
  }

  throw new Error(`Unable to start server after ${maxAttempts} attempts`)
}

async function bootstrap() {
  await dataSource.initialize()

  const app = express()
  app.use(express.json())
  app.use(express.static(publicDir))

  app.get('/api/member-count', async (req, res) => {
    const appId = String(req.query.appId || '').trim()
    if (!appId) {
      return res.status(400).json({ message: '請提供 appId' })
    }

    try {
      const appData = await appRepo.getAppById(appId)
      if (!appData) {
        return res.status(404).json({ message: `找不到 app：${appId}` })
      }

      const memberCount = await dataSource.getRepository(Member).count({ where: { appId } })
      return res.json({ appId, memberCount })
    } catch (error) {
      console.error('get member count failed', error)
      return res.status(500).json({ message: '查詢失敗，請稍後再試' })
    }
  })

  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'))
  })

  const { server, boundPort } = await listenWithFallback(app, port)
  console.log(`Server running at http://localhost:${boundPort}`)

  const gracefulShutdown = async () => {
    server.close(async () => {
      if (dataSource.isInitialized) {
        await dataSource.destroy()
      }
      process.exit(0)
    })
  }

  process.on('SIGINT', gracefulShutdown)
  process.on('SIGTERM', gracefulShutdown)
}

bootstrap().catch(async (error) => {
  console.error('Server bootstrap failed', error)
  if (dataSource.isInitialized) {
    await dataSource.destroy()
  }
  process.exit(1)
})
