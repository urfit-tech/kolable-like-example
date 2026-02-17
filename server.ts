import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createKnex } from 'lodestar-sdk/src/db'
import { createAppRepo } from 'lodestar-sdk/src/repositories/AppRepo'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const publicDir = path.join(__dirname, 'public')

dotenv.config({ path: path.join(__dirname, '.env') })

const postgresUrl = process.env.POSTGRES_URL
const port = Number(process.env.PORT || 3000)

if (!postgresUrl) {
  throw new Error('Missing POSTGRES_URL in environment variables')
}

const db = createKnex({ connection: postgresUrl })
const appRepo = createAppRepo(db)

async function bootstrap() {
  const app = express()
  app.use(express.json())
  app.use(express.static(publicDir))

  app.get('/api/member-count', async (req, res) => {
    const appId = String(req.query.appId || '').trim()
    if (!appId) {
      return res.status(400).json({ message: '請提供 appId' })
    }

    try {
      const appData = await appRepo.getById(appId)
      if (!appData) {
        return res.status(404).json({ message: `找不到 app：${appId}` })
      }

      const countRow = await db('member')
        .where('app_id', appId)
        .count<{ count: string }>({ count: '*' })
        .first()

      const memberCount = Number(countRow?.count || 0)
      return res.json({ appId, memberCount })
    } catch (error) {
      console.error('get member count failed', error)
      return res.status(500).json({ message: '查詢失敗，請稍後再試' })
    }
  })

  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'))
  })

  const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`)
  })

  const gracefulShutdown = async () => {
    server.close(async () => {
      await db.destroy()
      process.exit(0)
    })
  }

  process.on('SIGINT', gracefulShutdown)
  process.on('SIGTERM', gracefulShutdown)
}

bootstrap().catch(async (error) => {
  console.error('Server bootstrap failed', error)
  await db.destroy()
  process.exit(1)
})
