/* eslint-disable no-return-assign */
// import { Redis } from '@upstash/redis'

import url from 'url'

import { RedisPubSub } from 'graphql-redis-subscriptions'
import IORedis, { RedisOptions } from 'ioredis'
import { injectable, singleton, container } from 'tsyringe'

import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { env } from '@packages/utils/validateEnvs'

/** Correctly deserializes dates from the RedisPubSub instance.  @see https://github.com/davidyaha/graphql-redis-subscriptions#using-a-custom-reviver */
export const dateReviver = (_key: unknown, value: unknown): unknown => {
	const isISO8601Z =
		/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/
	if (typeof value === 'string' && isISO8601Z.test(value)) {
		const tempDateNumber = Date.parse(value)
		if (!Number.isNaN(tempDateNumber)) {
			return new Date(tempDateNumber)
		}
	}
	return value
}

export type PubSubChannel = 'notifications' | 'chat'

type IteratorType = unknown
const redisUrl = url.parse(env.REDIS_URL)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const redisOptions: RedisOptions = {
	host: redisUrl.hostname as string,
	port: Number(redisUrl.port),
	password: redisUrl.auth?.split(':')[1],
	connectTimeout: 20000 // Increase timeout to 20 seconds
}

const reportingService = container.resolve(ReportingService)

@ReportErrors()
@singleton()
@injectable()
export class RedisService {
	private _client: IORedis | undefined

	private _pubsub: RedisPubSub | undefined

	private _reportingService = reportingService

	public get client(): IORedis {
		if (!this._client) {
			this._client = new IORedis(redisOptions)
			this._client.on('error', (err) => {
				this._reportingService.log({
					message: 'Redis connection error',
					error: err
				})
				// Implement additional error handling logic here
			})
		}
		return this._client
	}

	public get pubsub(): RedisPubSub {
		return (this._pubsub ||= new RedisPubSub({
			publisher: new IORedis(redisOptions),
			subscriber: new IORedis(redisOptions),
			reviver: dateReviver
		}))
	}

	// public async publishMessage<T>({
	// 	channel,
	// 	key,
	// 	message
	// }: {
	// 	channel: PubSubChannel
	// 	key: string
	// 	message: T
	// }): Promise<void> {
	// 	const publishKey = `${channel}:${key}`

	// 	this.publishPusher({ channel, key, message })

	// 	this._reportingService.log('publishing message', publishKey, message)

	// 	return this.pubsub?.publish(publishKey, message)
	// }

	// public async publishPusher<T>({
	// 	channel,
	// 	key,
	// 	message
	// }: {
	// 	channel: PubSubChannel
	// 	key: string
	// 	message: T
	// }): Promise<void> {
	// 	const publishKey = `${channel}:${key}`
	// 	pusher.trigger(channel, publishKey, {
	// 		message
	// 	})
	// }

	public asyncIterator = ({
		channel,
		key
	}: {
		channel: PubSubChannel
		key?: string
	}): AsyncIterator<IteratorType, unknown, undefined> | undefined => {
		const publishKey = key ? `${channel}:${key}` : `${channel}`

		return this.pubsub?.asyncIterator(publishKey)
	}

	public async getItem({ id }: { id: string }): Promise<string | null> {
		const value = await this.client.get(id)
		return value
	}

	public setItem = async ({
		key,
		value,
		ttl
	}: {
		key: string
		value: string | number
		ttl?: number
	}): Promise<void> => {
		await this.client?.set(key, value)

		if (ttl) {
			await this.client?.expire(key, ttl)
		}
	}

	public incrementItem = async ({
		key,
		incrementValue = 1, // default is 1, same as `incr`
		ttl
	}: {
		key: string
		incrementValue?: number
		ttl?: number
	}): Promise<number> => {
		const count = await this.client?.incrby(key, incrementValue)

		if (ttl) {
			await this.client?.expire(key, ttl)
		}

		return count
	}

	public deleteItem = async ({ key }: { key: string }): Promise<void> => {
		await this.client?.del(key)
	}

	public addToSet = async ({
		key,
		value,
		hashNumber,
		ttl
	}: {
		key: string
		value: string | number
		ttl: number
		hashNumber: string
	}): Promise<void> => {
		await this.client.hset(key, hashNumber, value)

		if (ttl) {
			await this.client?.expire(key, ttl)
		}
	}

	public getFilePathsFromRedis = async ({
		key,
		totalChunks
	}: {
		key: string
		totalChunks: number
	}): Promise<string[]> => {
		const chunkNumbers = Array.from({ length: totalChunks }, (_, i) => i + 1) // Create an array of chunk numbers
		const pathPromises = await Promise.all(
			chunkNumbers.map((chunkNumber) =>
				this.client?.hget(key, chunkNumber.toString())
			)
		)

		const paths = pathPromises.filter((value) => value !== null) as string[]

		const filePaths = await Promise.all(paths)
		return filePaths
	}

	public getTTL = async ({ key }: { key: string }): Promise<number> => {
		const ttl = await this.client.ttl(key)
		return ttl
	}
}

export default new RedisService()
