// import { createBullBoard } from '@bull-board/api'
// import { BullAdapter } from '@bull-board/api/bullAdapter'
import { ExpressAdapter } from '@bull-board/express'
// import Bull, { Queue, Job, QueueOptions, JobOptions } from 'bull'
// import { RedisOptions } from 'ioredis'
import { container, injectable, singleton } from 'tsyringe'

// import { redisOptions } from '@packages/services/queue/RedisService'
import { EmailService } from '@packages/services/email/EmailService'
import { ReportingService } from '@packages/services/logging/ReportingService'
// import RedisService from '@packages/services/queue/RedisService'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'

// import { env } from '@packages/utils/validateEnvs'
// import { isDevelopment } from '@packages/utils/isDevelopment'
// import { differenceInMilliseconds, parseISO } from 'date-fns'
import { SendEmailQueueProps } from '@packages/services/queue/types'
// import sendEmailQueueProcessor from '@packages/services/queue/sendEmailQueue'

export const QUEUES = {
	SEND_EMAIL: 'SEND_EMAIL'
} as const

const reportingService = container.resolve(ReportingService)

// Shared Redis clients for all queues
// const sharedClients = {
// 	client: RedisService.client,
// 	subscriber: RedisService.client.duplicate(),
// 	bclient: RedisService.client.duplicate()
// }

// const QUEUE_SPECIFIC_OPTIONS: {
// 	[key: string]: {
// 		concurrency: number
// 		timeout: number
// 		limiter?: {
// 			max: number
// 			duration: number
// 			groupKey?: string
// 		}
// 	}
// } = {}

// const connection: QueueOptions = {
// 	defaultJobOptions: {
// 		timeout: 900000, // 15 minutes
// 		removeOnComplete: !isDevelopment,
// 		attempts: 3,
// 		backoff: {
// 			type: 'exponential',
// 			delay: 2000 // Start with 2 second delay
// 		}
// 	},
// 	redis: {
// 		host: redisOptions.host,
// 		port: redisOptions.port,
// 		password: redisOptions.password,
// 		db: redisOptions.db,
// 		maxRetriesPerRequest: 3,
// 		enableReadyCheck: false,
// 		createClient: (type) => {
// 			switch (type) {
// 				case 'client':
// 					return sharedClients.client
// 				case 'subscriber':
// 					return sharedClients.subscriber
// 				case 'bclient':
// 					return sharedClients.bclient
// 				default:
// 					return sharedClients.client
// 			}
// 		}
// 	} as RedisOptions
// }

@injectable()
@singleton()
@ReportErrors()
export class QueueService {
	// queues: Record<string, Queue> = {}

	// private _createQueueInstance(name: keyof typeof QUEUES): Queue {
	// 	if (!this.queues[name]) {
	// 		this.queues[name] = new Bull(name, {
	// 			...connection,
	// 			...QUEUE_SPECIFIC_OPTIONS[name],
	// 			settings: {
	// 				lockDuration: 30000,
	// 				stalledInterval: 30000,
	// 				maxStalledCount: 1,
	// 				retryProcessDelay: 5000,
	// 				drainDelay: 5
	// 			}
	// 		})
	// 	}
	// 	return this.queues[name]
	// }

	// private createProcessor<T>(
	// 	queueName: keyof typeof QUEUES,
	// 	processor: (job: Job<T>, done: Bull.DoneCallback) => Promise<void>
	// ): void {
	// 	const queue = this._createQueueInstance(queueName)
	// 	reportingService.log({
	// 		message: `Registering processor for queue ${queueName}`
	// 	})
	// 	const concurrency = QUEUE_SPECIFIC_OPTIONS[queueName]?.concurrency || 1
	// 	queue.process(concurrency, processor)
	// }

	public initQueues(): ExpressAdapter {
		// this.createProcessor<SendEmailQueueProps>(
		// 	QUEUES.SEND_EMAIL,
		// 	sendEmailQueueProcessor
		// )

		// this.scheduleCronJobs()

		const serverAdapter = new ExpressAdapter()
		// if (env.DASHBOARD === 'true') {
		// 	serverAdapter.setBasePath('/admin/queues')
		// }

		// const sortedQueueNames = Object.keys(QUEUES).sort()
		// const sortedQueues = sortedQueueNames
		// 	.filter((queueName) => this.queues[queueName as keyof typeof QUEUES])
		// 	.map(
		// 		(queueName) =>
		// 			new BullAdapter(this.queues[queueName as keyof typeof QUEUES])
		// 	)

		// createBullBoard({
		// 	queues: sortedQueues,
		// 	serverAdapter
		// })

		reportingService.log({
			message: 'Bull queues disabled — Redis connection commented out'
		})

		return serverAdapter
	}

	// private scheduleCronJobs(): void {
	// 	const cronJobs: {
	// 		queueName: keyof typeof QUEUES
	// 		data: {}
	// 		options: {
	// 			cron: string
	// 			timezone: string
	// 		}
	// 	}[] = []

	// 	cronJobs.forEach((job) => this.addToQueue(job))
	// }

	// public scheduleEvent<T>({
	// 	scheduleKey,
	// 	queueName,
	// 	data,
	// 	options
	// }: {
	// 	scheduleKey: string | Date
	// 	queueName: keyof typeof QUEUES
	// 	data: T
	// 	options?: {
	// 		jobId?: string
	// 	}
	// }): void {
	// 	const queue = this._createQueueInstance(queueName)
	// 	const scheduleDate =
	// 		typeof scheduleKey === 'string' ? parseISO(scheduleKey) : scheduleKey

	// 	const now = new Date()
	// 	const delay = differenceInMilliseconds(scheduleDate, now)
	// 	const finalDelay = Math.max(0, delay)

	// 	queue.add(
	// 		{
	// 			...data
	// 		},
	// 		{
	// 			delay: finalDelay,
	// 			...(options?.jobId && { jobId: options.jobId })
	// 		}
	// 	)
	// }

	public async addToQueue<T>(_args: {
		queueName: keyof typeof QUEUES
		data: T
		options?: {
			repeatEvery?: number
			timezone?: string
			cron?: string
			jobId?: string
			delay?: number
		}
	}): Promise<void> {}

	// private generateRepeatableJobKey({
	// 	jobId,
	// 	timezone,
	// 	cron
	// }: {
	// 	jobId: string
	// 	timezone: string
	// 	cron: string
	// }): string {
	// 	return `__default__:${jobId}::${timezone}:${cron}`
	// }

	public async removeRepeatableJob(_args: {
		queueName: keyof typeof QUEUES
		cron: string
		jobId: string
		timezone: string
	}): Promise<boolean> {
		return true
	}

	public async removeQueueItems(_args: {
		key: keyof typeof QUEUES
		values: string[]
	}): Promise<number> {
		return 0
	}

	public async getWaitingJobCount(_args: {
		queueName: keyof typeof QUEUES
	}): Promise<number> {
		return 0
	}

	public async getFailedJobCount(_args: {
		queueName: keyof typeof QUEUES
	}): Promise<number> {
		return 0
	}

	public async scheduleSendEmail({
		to,
		subject,
		text,
		html,
		replyTo
	}: SendEmailQueueProps & { jobId?: string }): Promise<void> {
		// await this.addToQueue<SendEmailQueueProps>({
		// 	queueName: 'SEND_EMAIL',
		// 	data: {
		// 		to,
		// 		subject,
		// 		text,
		// 		html,
		// 		...(replyTo !== undefined && { replyTo })
		// 	},
		// 	options: {
		// 		jobId,
		// 		delay: 0
		// 	}
		// })

		const emailService = container.resolve(EmailService)

		await emailService.sendEmail({
			to,
			subject,
			text,
			html,
			replyTo
		})
	}
}

export default new QueueService()

export type { SendEmailQueueProps }
