import * as Sentry from '@sentry/node'
import { nodeProfilingIntegration } from '@sentry/profiling-node'

import { env } from '@packages/utils/validateEnvs'
import { isDevelopment } from '@packages/utils/isDevelopment'

export const initSentry = (): void => {
	Sentry.init({
		dsn: env.SENTRY_CONFIG,
		environment: env.ENVIRONMENT,
		release: process.env.npm_package_version,
		tracesSampleRate: 1.0,
		profilesSampleRate: 1.0,
		integrations: [
			nodeProfilingIntegration(),
			Sentry.httpIntegration({ breadcrumbs: true }),
			Sentry.onUncaughtExceptionIntegration(),
			Sentry.onUnhandledRejectionIntegration(),
			Sentry.consoleIntegration(),
			Sentry.contextLinesIntegration(),
			Sentry.modulesIntegration()
		],
		attachStacktrace: true,
		sendDefaultPii: true,
		beforeSend(event) {
			if (isDevelopment) {
				// eslint-disable-next-line no-console
				console.error('[Sentry dev] event captured:', event.event_id)
			}
			return event
		}
	})
}

export const captureException = ({
	error,
	context
}: {
	error: Error
	context?: Record<string, unknown>
}): string => {
	return Sentry.captureException(error, {
		extra: context
	})
}

export const captureMessage = ({
	message,
	level,
	context
}: {
	message: string
	level?: 'info' | 'warning' | 'error'
	context?: Record<string, unknown>
}): string => {
	return Sentry.captureMessage(message, {
		level: level ?? 'error',
		extra: context
	})
}

export const setUser = ({
	id,
	email,
	username
}: {
	id: string
	email?: string
	username?: string
}): void => {
	Sentry.setUser({ id, email, username })
}

export const setContext = ({
	key,
	context
}: {
	key: string
	context: Record<string, unknown>
}): void => {
	Sentry.setContext(key, context)
}
