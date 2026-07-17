import express, { Response } from 'express'
import { container } from 'tsyringe'

import { SubscriptionService } from '@packages/services/billing/SubscriptionService'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { isDevelopment } from '@packages/utils/isDevelopment'
import { env } from '@packages/utils/validateEnvs'

export const revenueCatRouter = express.Router()

type RevenueCatEventBody = {
	api_version?: string
	event?: {
		type?: string
		app_user_id?: string
		product_id?: string
		expiration_at_ms?: number | null
		entitlement_ids?: string[]
		period_type?: string | null
	}
}

revenueCatRouter.post('/webhook', async (req, res: Response) => {
	const reportingService = container.resolve(ReportingService)
	const subscriptionService = container.resolve(SubscriptionService)

	const authHeader = req.headers.authorization
	const expected = env.REVENUECAT_WEBHOOK_SECRET

	if (!expected) {
		// Local/testing may omit the secret; never accept unauthenticated webhooks in prod.
		if (!isDevelopment) {
			reportingService.log({
				message: 'RevenueCat webhook rejected — REVENUECAT_WEBHOOK_SECRET is not set'
			})
			return res.status(503).json({ ok: false, error: 'webhook_secret_unconfigured' })
		}
	} else if (authHeader !== `Bearer ${expected}`) {
		return res.status(401).json({ ok: false })
	}

	const body = req.body as RevenueCatEventBody
	const event = body.event

	reportingService.log({
		message: 'RevenueCat webhook received',
		type: event?.type,
		appUserId: event?.app_user_id,
		periodType: event?.period_type
	})

	if (!event?.app_user_id) {
		return res.status(200).json({ ok: true, skipped: true })
	}

	const inactiveTypes = new Set([
		'EXPIRATION',
		'CANCELLATION',
		'SUBSCRIPTION_PAUSED'
	])
	const activeTypes = new Set([
		'INITIAL_PURCHASE',
		'RENEWAL',
		'UNCANCELLATION',
		'PRODUCT_CHANGE',
		'NON_RENEWING_PURCHASE'
	])

	const eventType = event.type ?? ''
	const isActive = activeTypes.has(eventType)
		? true
		: inactiveTypes.has(eventType)
			? false
			: true

	try {
		await subscriptionService.handleRevenueCatWebhook({
			appUserId: event.app_user_id,
			productId: event.product_id ?? event.entitlement_ids?.[0] ?? null,
			isActive: isActive && !inactiveTypes.has(eventType),
			expirationAt:
				event.expiration_at_ms != null
					? new Date(event.expiration_at_ms)
					: null,
			periodType: event.period_type ?? null
		})
		return res.status(200).json({ ok: true })
	} catch (error) {
		reportingService.reportError({ error: error as Error })
		return res.status(500).json({ ok: false })
	}
})
