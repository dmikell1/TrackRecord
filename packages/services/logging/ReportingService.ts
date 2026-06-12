import { AsyncLocalStorage } from 'async_hooks'

import * as Sentry from '@sentry/node'
import { nodeProfilingIntegration } from '@sentry/profiling-node'
import pino from 'pino'
import { injectable, singleton } from 'tsyringe'
import uuid from 'uuid4'

import { isDevelopment } from '@packages/utils/isDevelopment'
import { env } from '@packages/utils/validateEnvs'
import { getRequestId } from '@packages/utils/tracing'

@injectable()
@singleton()
export class ReportingService {
	private traceStore: AsyncLocalStorage<{ traceId: string }> =
		new AsyncLocalStorage<{ traceId: string }>()
	private logger: pino.Logger

	constructor() {
		this.logger = isDevelopment
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
			: pino({
					level: env.LOG_LEVEL
				})
	}

	public initTracking = (): void => {
		Sentry.init({
			dsn: env.SENTRY_CONFIG,
			environment: env.ENVIRONMENT,
			release: process.env.npm_package_version,

			// Capture 100% of transactions in production for full visibility
			tracesSampleRate: 1.0,
			// Capture 100% of profiles attached to sampled transactions
			profilesSampleRate: 1.0,

		integrations: [
			nodeProfilingIntegration(),
			// Express integration — enables automatic route tracing
			Sentry.expressIntegration(),
			// HTTP integration — instruments outgoing http/https calls
			Sentry.httpIntegration({ breadcrumbs: true }),
			// Capture unhandled rejections and uncaught exceptions
			Sentry.onUncaughtExceptionIntegration(),
			Sentry.onUnhandledRejectionIntegration(),
			// Capture console.log/error/warn as breadcrumbs
			Sentry.consoleIntegration(),
			// Context lines in stack traces
			Sentry.contextLinesIntegration(),
			// Local variables in stack frames
			Sentry.localVariablesIntegration(),
			// Module metadata
			Sentry.modulesIntegration()
		],

			// Send all errors in any environment
			beforeSend(event) {
				return event
			},

			// Add request data to all events
			attachStacktrace: true,
			sendDefaultPii: true
		})

		this.logger.info(
			{ environment: env.ENVIRONMENT },
			'Sentry tracking initialized'
		)
	}

	public setUser({
		id,
		email,
		username
	}: {
		id: string
		email?: string
		username?: string
	}): void {
		Sentry.setUser({ id, email, username })
		this.logger.info({ id, email, username }, 'User set')
	}

	public captureException({
		exception,
		hint
	}: {
		exception: Error
		hint?: Sentry.EventHint
	}): string {
		const store = this.traceStore.getStore()
		let eventId = ''
		Sentry.withScope((scope) => {
			if (store?.traceId) {
				scope.setTag('traceId', store.traceId)
			}
			eventId = Sentry.captureException(exception, hint)
		})
		this.logger.error(
			{
				err: exception,
				sentryEventId: eventId,
				traceId: store?.traceId
			},
			'Exception captured'
		)
		return eventId
	}

	public captureEvent({ event }: { event: Sentry.Event }): string {
		const store = this.traceStore.getStore()
		const eventId = Sentry.captureEvent(event)
		this.logger.info(
			{
				sentryEventId: eventId,
				event,
				traceId: store?.traceId
			},
			'Event captured'
		)
		return eventId
	}

	public captureMessage({
		message,
		level = 'info'
	}: {
		message: string
		level?: Sentry.SeverityLevel
	}): void {
		Sentry.captureMessage(message, level)
		this.logger[
			level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'info'
		](message)
	}

	public setTag({ key, value }: { key: string; value: string }): void {
		Sentry.setTag(key, value)
		this.logger.info({ key, value }, 'Tag set')
	}

	public setExtra({ key, extra }: { key: string; extra: unknown }): void {
		Sentry.setExtra(key, extra)
		this.logger.info({ key, extra }, 'Extra set')
	}

	public lastEventId(): string | undefined {
		return Sentry.lastEventId()
	}

	public addBreadcrumb({
		breadcrumb
	}: {
		breadcrumb: Sentry.Breadcrumb
	}): void {
		Sentry.addBreadcrumb(breadcrumb)
		this.logger.debug({ breadcrumb }, 'Breadcrumb added')
	}

	public flush({ timeout }: { timeout?: number }): Promise<boolean> {
		this.logger.info({ timeout }, 'Flushing Sentry')
		return Sentry.flush(timeout)
	}

	public close({ timeout }: { timeout?: number }): Promise<boolean> {
		this.logger.info({ timeout }, 'Closing Sentry')
		return Sentry.close(timeout)
	}

	public withScope({
		callback
	}: {
		callback: (scope: Sentry.Scope) => void
	}): void {
		Sentry.withScope(callback)
		this.logger.debug('Executed withScope')
	}

	public startTrace({ op, name }: { op: string; name: string }): void {
		const traceId = uuid()
		this.traceStore.enterWith({ traceId })
		this.logger.info({ traceId, op, name }, `Starting trace: ${op} - ${name}`)
	}

	public endTrace(): void {
		const store = this.traceStore.getStore()
		if (store) {
			this.logger.info({ traceId: store.traceId }, 'Ending trace')
			this.traceStore.exit(() => {
				this.logger.info({ traceId: store.traceId }, 'Ended trace')
			})
		} else {
			this.logger.warn('Attempted to end a trace, but no trace was active')
		}
	}

	public withTrace<T>({
		op,
		name,
		fn
	}: {
		op: string
		name: string
		fn: () => Promise<T>
	}): Promise<T> {
		this.startTrace({ op, name })
		return fn().finally(() => this.endTrace())
	}

	public startSpan({ op, name }: { op: string; name: string }): void {
		this.logger.info({ op, name }, `Starting span: ${op} - ${name}`)
	}

	public endSpan(): void {
		this.logger.info('Ending span')
	}

	public reportError({ error }: { error: Error }): void {
		if (!error) {
			return
		}

		if (isDevelopment) {
			this.logger.error({ err: error, stack: error.stack }, 'Error reported')
		} else {
			this.logger.error({ err: error, stack: error.stack }, error.message)
			this.captureException({ exception: error })
		}
	}

	public info({
		context,
		message
	}: {
		context: string
		message?: Record<string, unknown>
	}): void {
		this.logger.info({ context, ...message }, context)
	}

	public log({
		message,
		...metadata
	}: {
		message: string
		[key: string]: unknown
	}): void {
		const requestId = getRequestId()
		this.logger.info({ ...metadata, ...(requestId && { requestId }) }, message)
	}

	public error({
		message,
		error,
		...metadata
	}: {
		message: string
		error?: Error
		[key: string]: unknown
	}): void {
		const requestId = getRequestId()
		this.logger.error(
			{ err: error, ...metadata, ...(requestId && { requestId }) },
			message
		)
	}

	public warn({
		message,
		...metadata
	}: {
		message: string
		[key: string]: unknown
	}): void {
		const requestId = getRequestId()
		this.logger.warn({ ...metadata, ...(requestId && { requestId }) }, message)
	}

	public debug({
		message,
		...metadata
	}: {
		message: string
		[key: string]: unknown
	}): void {
		const requestId = getRequestId()
		this.logger.debug({ ...metadata, ...(requestId && { requestId }) }, message)
	}

	public getActionableErrorMessage({ error }: { error: Error }): string {
		const message =
			error.message ??
			'An unexpected error occurred. Our team has been notified and is working on it.'
		this.logger.info(
			{
				originalError: error.message,
				actionableMessage: message
			},
			'Actionable error message generated'
		)
		return message
	}
}

export const createReportingService = (): ReportingService => {
	const reportingService = new ReportingService()
	reportingService.initTracking()
	return reportingService
}
