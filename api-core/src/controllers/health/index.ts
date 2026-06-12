import express, { type Request, type Response } from 'express'
import Redis from 'ioredis'
import { sql } from 'drizzle-orm'

import { getDb } from '@packages/database/createPostgresConnection'
import { redisOptions } from '@packages/services/queue/RedisService'

const healthRouter = express.Router()

healthRouter.get('/health', async (_req: Request, res: Response) => {
	try {
		let postgresStatus = false
		try {
			await getDb().execute(sql`select 1`)
			postgresStatus = true
		} catch {
			postgresStatus = false
		}

		let redisStatus = false
		try {
			const redisClient = new Redis(redisOptions)
			await redisClient.ping()
			redisStatus = true
		} catch {
			redisStatus = false
		}

		if (postgresStatus && redisStatus) {
			res.status(200).json({
				ok: true,
				postgres: 'connected',
				redis: 'connected'
			})
		} else {
			res.status(503).json({
				ok: false,
				postgres: postgresStatus ? 'connected' : 'disconnected',
				redis: redisStatus ? 'connected' : 'disconnected'
			})
		}
	} catch {
		res.status(500).json({ ok: false, error: 'Internal server error' })
	}
})

export default healthRouter
