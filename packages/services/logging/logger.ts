import { AsyncLocalStorage } from 'node:async_hooks'

import * as Sentry from '@sentry/node'
import pino from 'pino'
import uuid from 'uuid4'

import { isDevelopment } from '@packages/utils/isDevelopment'
import { env } from '@packages/utils/validateEnvs'

const traceAsyncLocalStorage = new AsyncLocalStorage<{
	traceId: string
	contextId?: string
}>()

const baseLogger = isDevelopment
	? pino({
			transport: {
				target: 'pino-pretty',
				options: {
					colorize: true,
					translateTime: 'HH:MM:ss Z',
					ignore: 'pid,hostname'
				}
			}
		})
	: pino({ level: env.LOG_LEVEL })

const getTraceBindings = (): Record<string, string> => {
	const store = traceAsyncLocalStorage.getStore()
	if (!store) return {}
	return {
		traceId: store.traceId,
		...(store.contextId ? { contextId: store.contextId } : {})
	}
}

const logger = {
	info: (message: string, metadata?: Record<string, unknown>): void => {
		baseLogger.info({ ...getTraceBindings(), ...metadata }, message)
	},

	debug: (message: string, metadata?: Record<string, unknown>): void => {
		baseLogger.debug({ ...getTraceBindings(), ...metadata }, message)
	},

	warn: (message: string, metadata?: Record<string, unknown>): void => {
		baseLogger.warn({ ...getTraceBindings(), ...metadata }, message)
	},

	error: (error: Error | string, metadata?: Record<string, unknown>): void => {
		const errorObject = error instanceof Error ? error : new Error(error)
		const errorInfo = {
			err: errorObject,
			stack: errorObject.stack,
			...getTraceBindings(),
			...metadata
		}

		if (!isDevelopment) {
			Sentry.captureException(errorObject, { extra: metadata })
		}

		baseLogger.error(errorInfo, errorObject.message)
	},

	trace: (contextId: string): string => {
		const traceId = uuid()
		traceAsyncLocalStorage.enterWith({ traceId, contextId })
		baseLogger.info({ traceId, contextId, ...getTraceBindings() }, 'Started trace')
		return traceId
	},

	endTrace: (traceId: string): void => {
		traceAsyncLocalStorage.exit(() => {
			baseLogger.info({ traceId }, 'Ended trace')
		})
	}
}

export default logger
