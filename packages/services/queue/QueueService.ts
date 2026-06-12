import { createBullBoard } from '@bull-board/api'
import { BullAdapter } from '@bull-board/api/bullAdapter'
import { ExpressAdapter } from '@bull-board/express'
import Bull, { Queue, Job, QueueOptions, JobOptions } from 'bull'
import { RedisOptions } from 'ioredis'
import { container, injectable, singleton } from 'tsyringe'

import { redisOptions } from '@packages/services/queue/RedisService'
import { ReportingService } from '@packages/services/logging/ReportingService'
import RedisService from '@packages/services/queue/RedisService'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'

import { env } from '@packages/utils/validateEnvs'
import { isDevelopment } from '@packages/utils/isDevelopment'
import { differenceInMilliseconds, parseISO } from 'date-fns'
import { SendEmailQueueProps } from '@packages/services/queue/types'
import sendEmailQueueProcessor from '@packages/services/queue/sendEmailQueue'

// Define the structure for domain setup queue properties

// Extend QUEUES with campaign orchestration types
export const QUEUES = {
	SEND_EMAIL: 'SEND_EMAIL'
} as const

const reportingService = container.resolve(ReportingService)

// Shared Redis clients for all queues
const sharedClients = {
	client: RedisService.client,
	subscriber: RedisService.client.duplicate(),
	bclient: RedisService.client.duplicate()
}

const QUEUE_SPECIFIC_OPTIONS: {
	[key: string]: {
		concurrency: number
		timeout: number
		limiter?: {
			max: number
			duration: number
			groupKey?: string
		}
	}
} = {}

const connection: QueueOptions = {
	defaultJobOptions: {
		timeout: 900000, // 15 minutes
		removeOnComplete: !isDevelopment,
		attempts: 3,
		backoff: {
			type: 'exponential',
			delay: 2000 // Start with 2 second delay
		}
	},
	redis: {
		host: redisOptions.host,
		port: redisOptions.port,
		password: redisOptions.password,
		db: redisOptions.db,
		maxRetriesPerRequest: 3,
		enableReadyCheck: false,
		createClient: (type) => {
			switch (type) {
				case 'client':
					return sharedClients.client
				case 'subscriber':
					return sharedClients.subscriber
				case 'bclient':
					return sharedClients.bclient
				default:
					return sharedClients.client
			}
		}
	} as RedisOptions
}

@injectable()
@singleton()
@ReportErrors()
export class QueueService {
	queues: Record<string, Queue> = {}
	// Rate limiting for connection errors

	private _createQueueInstance(name: keyof typeof QUEUES): Queue {
		if (!this.queues[name]) {
			this.queues[name] = new Bull(name, {
				...connection,
				...QUEUE_SPECIFIC_OPTIONS[name],
				settings: {
					lockDuration: 30000,
					stalledInterval: 30000,
					maxStalledCount: 1,
					retryProcessDelay: 5000,
					drainDelay: 5
				}
			})
		}
		return this.queues[name]
	}

	private createProcessor<T>(
		queueName: keyof typeof QUEUES,
		processor: (job: Job<T>, done: Bull.DoneCallback) => Promise<void>
	): void {
		const queue = this._createQueueInstance(queueName)
		reportingService.log({
			message: `Registering processor for queue ${queueName}`
		})
		const concurrency = QUEUE_SPECIFIC_OPTIONS[queueName]?.concurrency || 1
		queue.process(concurrency, processor)
	}

	public initQueues(): ExpressAdapter {
		this.createProcessor<SendEmailQueueProps>(
			QUEUES.SEND_EMAIL,
			sendEmailQueueProcessor
		)

		this.scheduleCronJobs()

		const serverAdapter = new ExpressAdapter()
		if (env.DASHBOARD === 'true') {
			serverAdapter.setBasePath('/admin/queues')
		}

		// Sort queues alphabetically by name for Bull dashboard
		const sortedQueueNames = Object.keys(QUEUES).sort()
		const sortedQueues = sortedQueueNames
			.filter((queueName) => this.queues[queueName as keyof typeof QUEUES])
			.map(
				(queueName) =>
					new BullAdapter(this.queues[queueName as keyof typeof QUEUES])
			)

		createBullBoard({
			queues: sortedQueues,
			serverAdapter
		})

		return serverAdapter
	}

	private scheduleCronJobs(): void {
		const cronJobs: {
			queueName: keyof typeof QUEUES
			data: {}
			options: {
				cron: string
				timezone: string
			}
		}[] = []

		cronJobs.forEach((job) => this.addToQueue(job))
	}

	public scheduleEvent<T>({
		scheduleKey,
		queueName,
		data,
		options
	}: {
		scheduleKey: string | Date
		queueName: keyof typeof QUEUES
		data: T
		options?: {
			jobId?: string
		}
	}): void {
		const queue = this._createQueueInstance(queueName)
		const scheduleDate =
			typeof scheduleKey === 'string' ? parseISO(scheduleKey) : scheduleKey

		const now = new Date()
		const delay = differenceInMilliseconds(scheduleDate, now)

		// Log scheduling details for debugging
		// reportingService.log('Scheduling event with timing details', {
		// 	scheduleKey: scheduleKey,
		// 	scheduleKeyType: typeof scheduleKey,
		// 	scheduleDate: scheduleDate.toISOString(),
		// 	scheduleDateValid: !isNaN(scheduleDate.getTime()),
		// 	currentTime: now.toISOString(),
		// 	delayMs: delay,
		// 	delayMinutes: Math.floor(delay / 60000),
		// 	delayHours: Math.floor(delay / 3600000),
		// 	queueName,
		// 	jobId: options?.jobId,
		// 	isPastTime: delay < 0,
		// 	timeDifference: scheduleDate.getTime() - now.getTime()
		// })

		// Handle past scheduled times - if the scheduled time is in the past,
		// schedule for immediate execution (delay: 0) instead of negative delay
		const finalDelay = Math.max(0, delay)

		// if (delay < 0) {
		// 	reportingService.log(
		// 		'Scheduled time is in the past - executing immediately',
		// 		{
		// 			scheduleDate: scheduleDate.toISOString(),
		// 			currentTime: now.toISOString(),
		// 			originalDelayMs: delay,
		// 			finalDelayMs: finalDelay,
		// 			queueName,
		// 			jobId: options?.jobId
		// 		}
		// 	)
		// }

		queue.add(
			{
				...data
			},
			{
				delay: finalDelay,
				...(options?.jobId && { jobId: options.jobId })
			}
		)
	}

	public async addToQueue<T>({
		queueName,
		data,
		options
	}: {
		queueName: keyof typeof QUEUES
		data: T
		options?: {
			repeatEvery?: number
			timezone?: string
			cron?: string
			jobId?: string
			delay?: number
		}
	}): Promise<void> {
		const opts: JobOptions = {
			...(options?.jobId && { jobId: options.jobId }),
			...(options?.delay !== undefined && { delay: options.delay })
		}
		if (options?.repeatEvery) {
			opts.repeat = { every: options.repeatEvery, key: options.jobId }
			if (options.timezone) {
				opts.repeat.tz = options.timezone
			}
		}
		if (options?.cron) {
			opts.repeat = { cron: options.cron, key: options.jobId }
			if (options.timezone) {
				opts.repeat.tz = options.timezone
			}
		}
		const queue = this._createQueueInstance(queueName)

		await queue.add(
			{
				...data
			},
			opts
		)
	}

	private generateRepeatableJobKey({
		jobId,
		timezone,
		cron
	}: {
		jobId: string
		timezone: string
		cron: string
	}): string {
		return `__default__:${jobId}::${timezone}:${cron}`
	}

	public async removeRepeatableJob({
		queueName,
		cron,
		jobId,
		timezone
	}: {
		queueName: keyof typeof QUEUES
		cron: string
		jobId: string
		timezone: string
	}): Promise<boolean> {
		const queue = this._createQueueInstance(queueName)
		await queue.removeRepeatableByKey(
			this.generateRepeatableJobKey({ jobId, timezone, cron })
		)
		return true
	}

	public async removeQueueItems({
		key,
		values
	}: {
		key: keyof typeof QUEUES
		values: string[]
	}): Promise<number> {
		const queue = this._createQueueInstance(key)
		const jobs = await Promise.all(values.map((value) => queue.getJob(value)))
		const existingJobs = jobs.filter((job) => job !== null)

		const concurrency = 5
		const batches: Promise<PromiseSettledResult<boolean>[]>[] = []

		for (let i = 0; i < existingJobs.length; i += concurrency) {
			const jobSlice = existingJobs.slice(i, i + concurrency)
			const batch: Promise<boolean>[] = jobSlice.map(async (job) => {
				try {
					await job?.remove()
					return true // Indicate success
				} catch (error) {
					reportingService.log({
						message: `Failed to remove job ${job?.id}:`,
						error: error as Error
					})
					return false // Indicate failure
				}
			})
			batches.push(Promise.allSettled(batch))
		}

		const results = await Promise.all(batches)
		const removedJobs = results
			.flat()
			.filter((result) => result.status === 'fulfilled' && result.value).length

		return removedJobs
	}

	public async getWaitingJobCount({
		queueName
	}: {
		queueName: keyof typeof QUEUES
	}): Promise<number> {
		const queue = this._createQueueInstance(queueName)
		const waitingJobs = await queue.getJobs(['waiting', 'delayed'])
		return waitingJobs.length
	}

	public async getFailedJobCount({
		queueName
	}: {
		queueName: keyof typeof QUEUES
	}): Promise<number> {
		const queue = this._createQueueInstance(queueName)
		const failedJobs = await queue.getJobs(['failed'])
		return failedJobs.length
	}

	public async scheduleSendEmail({
		to,
		subject,
		text,
		html,
		replyTo,
		jobId
	}: SendEmailQueueProps & { jobId?: string }): Promise<void> {
		await this.addToQueue<SendEmailQueueProps>({
			queueName: 'SEND_EMAIL',
			data: {
				to,
				subject,
				text,
				html,
				...(replyTo !== undefined && { replyTo })
			},
			options: {
				jobId,
				delay: 0
			}
		})
	}
}

export default new QueueService()

export type { SendEmailQueueProps }
