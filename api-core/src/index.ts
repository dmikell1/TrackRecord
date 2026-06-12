/* eslint-disable import/first */
require('dotenv').config()

import 'reflect-metadata'

import { app, startApolloServer } from './server'

import { container } from 'tsyringe'
import { QueueService } from '@packages/services/queue/QueueService'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { env } from '@packages/utils/validateEnvs'

const startApp = async (): Promise<void> => {
	const reportingService = container.resolve(ReportingService)
	const queueService = container.resolve(QueueService)
	try {
		await startApolloServer()
		const serverAdapter = queueService.initQueues()

		if (env.DASHBOARD === 'true') {
			app.use('/admin/queues', serverAdapter.getRouter())
		}
	} catch (e) {
		reportingService.reportError({ error: e as Error })
	}
}
startApp()
