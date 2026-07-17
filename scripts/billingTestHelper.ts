/**
 * Local billing / entitlement test helper.
 *
 * Usage (from trackrecord-api):
 *   pnpm billing:test status --email=you@example.com
 *   pnpm billing:test set --state=trial --email=you@example.com
 *   pnpm billing:test set --state=trial-ended --email=you@example.com
 *   pnpm billing:test set --state=active --plan=core --email=you@example.com
 *   pnpm billing:test webhook --event=purchase --plan=pro --email=you@example.com
 *   pnpm billing:test webhook --event=expire --email=you@example.com
 *   pnpm billing:test verify --email=you@example.com
 *   pnpm billing:test fill-athletes --plan=core --email=you@example.com
 *
 * Defaults --email to SEED_COACH_EMAIL or devyn.mikell@gmail.com (same as db:seed).
 */

import 'reflect-metadata'

import { addDays, subDays } from 'date-fns'
import { and, eq, isNull, like } from 'drizzle-orm'
import { container } from 'tsyringe'

import {
	closePostgresConnection,
	connectToPostgresDatabase,
	getDb,
	POSTGRES_URL
} from '@packages/database/createPostgresConnection'
import { athletes } from '@packages/database/schema'
import {
	PLAN_LIMITS,
	SubscriptionPlan,
	SubscriptionStatus,
	TRIAL_DAYS
} from '@packages/enums'
import { AthleteRepository } from '@packages/repositories/athlete/AthleteRepository'
import { CompanyRepository } from '@packages/repositories/company/CompanyRepository'
import {
	ATHLETE_LIMIT_ERROR,
	EntitlementService,
	SUBSCRIPTION_REQUIRED_ERROR
} from '@packages/services/billing/EntitlementService'
import { UserService } from '@packages/services/user/UserService'
import type { CompanyInterface } from '@packages/types/company'
import { env } from '@packages/utils/validateEnvs'

type Command =
	| 'status'
	| 'set'
	| 'webhook'
	| 'verify'
	| 'fill-athletes'
	| 'clear-limit-athletes'
	| 'help'

const LIMIT_TEST_EMAIL_SUFFIX = '@billing-test.local'

type State = 'trial' | 'trial-ended' | 'active' | 'expired'

type ParsedArgs = {
	command: Command
	email: string
	companyId?: string
	state?: State
	plan: SubscriptionPlan
	event?: 'purchase' | 'expire' | 'renewal' | 'cancellation'
	apiBase: string
}

const DEFAULT_EMAIL = 'devyn.mikell@gmail.com'

const printUsage = (): void => {
	console.log(`
Billing test helper — flip subscription state + fake RevenueCat webhooks

Commands:
  status              Show company subscription + entitlements
  set                 Set DB state (no webhook)
  webhook             POST a fake RevenueCat event to the local API
  verify              Run write + athlete-limit checks against current state
  fill-athletes       Create dummy athletes up to a plan's max (bypasses gates)
  clear-limit-athletes Soft-delete dummy athletes created by fill-athletes
  help                Show this help

Flags:
  --email=...         Coach email (default: SEED_COACH_EMAIL or ${DEFAULT_EMAIL})
  --company-id=...    Use company id directly (skips email lookup)
  --state=...         trial | trial-ended | active | expired
  --plan=...          core | pro | elite (default: core)
  --event=...         purchase | expire | renewal | cancellation
  --api-base=...      Default http://localhost:\${PORT} (4010)

Examples:
  pnpm billing:test status --email=you@example.com
  pnpm billing:test set --state=trial-ended --email=you@example.com
  pnpm billing:test set --state=active --plan=core --email=you@example.com
  pnpm billing:test fill-athletes --plan=core --email=you@example.com
  pnpm billing:test clear-limit-athletes --email=you@example.com
  pnpm billing:test verify --email=you@example.com
  pnpm billing:test webhook --event=purchase --plan=pro --email=you@example.com
  pnpm billing:test webhook --event=expire --email=you@example.com
`)
}

const parseArgs = ({ argv }: { argv: string[] }): ParsedArgs => {
	const positional = argv.filter(arg => !arg.startsWith('--'))
	const flags = new Map<string, string>()

	for (const arg of argv) {
		if (!arg.startsWith('--')) {
			continue
		}
		const eq = arg.indexOf('=')
		if (eq === -1) {
			flags.set(arg.slice(2), 'true')
			continue
		}
		flags.set(arg.slice(2, eq), arg.slice(eq + 1))
	}

	const commandRaw = positional[0] ?? 'help'
	const allowed: Command[] = [
		'status',
		'set',
		'webhook',
		'verify',
		'fill-athletes',
		'clear-limit-athletes',
		'help'
	]
	if (!allowed.includes(commandRaw as Command)) {
		throw new Error(`Unknown command: ${commandRaw}. Run: pnpm billing:test help`)
	}

	const planRaw = (flags.get('plan') ?? 'core').toLowerCase()
	if (
		planRaw !== SubscriptionPlan.Core &&
		planRaw !== SubscriptionPlan.Pro &&
		planRaw !== SubscriptionPlan.Elite
	) {
		throw new Error(`Invalid --plan=${planRaw}. Use core | pro | elite`)
	}

	const stateRaw = flags.get('state')
	if (
		stateRaw !== undefined &&
		stateRaw !== 'trial' &&
		stateRaw !== 'trial-ended' &&
		stateRaw !== 'active' &&
		stateRaw !== 'expired'
	) {
		throw new Error(
			`Invalid --state=${stateRaw}. Use trial | trial-ended | active | expired`
		)
	}

	const eventRaw = flags.get('event')
	if (
		eventRaw !== undefined &&
		eventRaw !== 'purchase' &&
		eventRaw !== 'expire' &&
		eventRaw !== 'renewal' &&
		eventRaw !== 'cancellation'
	) {
		throw new Error(
			`Invalid --event=${eventRaw}. Use purchase | expire | renewal | cancellation`
		)
	}

	return {
		command: commandRaw as Command,
		email:
			flags.get('email') ??
			process.env.SEED_COACH_EMAIL ??
			DEFAULT_EMAIL,
		companyId: flags.get('company-id'),
		state: stateRaw as State | undefined,
		plan: planRaw as SubscriptionPlan,
		event: eventRaw as ParsedArgs['event'],
		apiBase:
			flags.get('api-base') ?? `http://localhost:${env.PORT}`
	}
}

const resolveCompany = async ({
	email,
	companyId
}: {
	email: string
	companyId?: string
}): Promise<{
	company: CompanyInterface
	teamId: string
	coachEmail: string
	clerkId: string | null
}> => {
	const companyRepository = container.resolve(CompanyRepository)
	const userService = container.resolve(UserService)

	if (companyId) {
		const company = await companyRepository.findOneOrFail({
			filter: { id: companyId }
		})
		const owner = await userService.findUser({
			filter: { id: company.ownerId },
			relations: { loadTeams: true }
		})
		const teamId = owner?.teams?.[0]?.id
		if (!teamId) {
			throw new Error(
				`Company ${companyId} owner has no team — sign in once or run db:seed`
			)
		}
		return {
			company,
			teamId,
			coachEmail: owner?.email ?? email,
			clerkId: owner?.clerkId ?? null
		}
	}

	const coach = await userService.findUser({
		filter: { email },
		relations: { loadTeams: true, loadCompanies: true }
	})

	if (!coach) {
		throw new Error(
			`No user found for ${email}. Sign in to the app once, then retry.`
		)
	}

	const company = coach.companies?.[0]
	const team = coach.teams?.[0]
	if (!company || !team) {
		throw new Error(
			`User ${email} has no company/team. Sign in once or run db:seed.`
		)
	}

	return {
		company,
		teamId: team.id,
		coachEmail: coach.email,
		clerkId: coach.clerkId ?? null
	}
}

const printEntitlements = async ({
	companyId,
	label
}: {
	companyId: string
	label: string
}): Promise<void> => {
	const companyRepository = container.resolve(CompanyRepository)
	const entitlementService = container.resolve(EntitlementService)

	const company = await companyRepository.findOneOrFail({
		filter: { id: companyId }
	})
	const entitlements = await entitlementService.getEntitlements({ companyId })

	console.log(`\n=== ${label} ===`)
	console.log(`Company:              ${company.id} (${company.name})`)
	console.log(`DB status:            ${company.subscriptionStatus}`)
	console.log(`DB plan:              ${company.subscriptionPlan ?? '(null)'}`)
	console.log(
		`DB trialEndsAt:       ${
			company.trialEndsAt ? company.trialEndsAt.toISOString() : '(null)'
		}`
	)
	console.log(
		`DB expiresAt:         ${
			company.subscriptionExpiresAt
				? company.subscriptionExpiresAt.toISOString()
				: '(null)'
		}`
	)
	console.log(
		`RC app user id:       ${company.revenueCatAppUserId ?? '(null)'}`
	)
	console.log('--- entitlements ---')
	console.log(`effective plan:       ${entitlements.plan ?? '(none)'}`)
	console.log(`status:               ${entitlements.status}`)
	console.log(`canWrite:             ${entitlements.canWrite}`)
	console.log(
		`athletes:             ${entitlements.athleteCount} / ${
			entitlements.maxAthletes === null ? '∞' : entitlements.maxAthletes
		}`
	)
	console.log(
		`recorders:            ${entitlements.recorderSeatCount} / ${entitlements.maxRecorderSeats}`
	)
	console.log('')
}

/** Unique per company so fake webhooks never hit the wrong account. */
const rcAppUserIdForCompany = ({
	companyId,
	clerkId
}: {
	companyId: string
	clerkId: string | null
}): string => clerkId ?? `billing-test-${companyId}`

const ensureRcAppUserId = async ({
	companyId,
	clerkId
}: {
	companyId: string
	clerkId: string | null
}): Promise<string> => {
	const companyRepository = container.resolve(CompanyRepository)
	const company = await companyRepository.findOneOrFail({
		filter: { id: companyId }
	})
	const preferredId = rcAppUserIdForCompany({ companyId, clerkId })

	// Always overwrite shared/legacy test ids so webhooks target this company only.
	if (company.revenueCatAppUserId === preferredId) {
		return preferredId
	}

	await companyRepository.updateSubscription({
		companyId,
		subscriptionStatus: company.subscriptionStatus,
		subscriptionPlan: company.subscriptionPlan,
		revenueCatAppUserId: preferredId
	})

	return preferredId
}

const setState = async ({
	companyId,
	state,
	plan,
	clerkId
}: {
	companyId: string
	state: State
	plan: SubscriptionPlan
	clerkId: string | null
}): Promise<void> => {
	const companyRepository = container.resolve(CompanyRepository)
	const revenueCatAppUserId = rcAppUserIdForCompany({ companyId, clerkId })

	switch (state) {
		case 'trial':
			await companyRepository.updateSubscription({
				companyId,
				subscriptionStatus: SubscriptionStatus.Trial,
				subscriptionPlan: plan,
				trialEndsAt: addDays(new Date(), TRIAL_DAYS),
				subscriptionExpiresAt: addDays(new Date(), TRIAL_DAYS),
				revenueCatAppUserId
			})
			break
		case 'trial-ended':
			await companyRepository.updateSubscription({
				companyId,
				subscriptionStatus: SubscriptionStatus.Trial,
				subscriptionPlan: plan,
				trialEndsAt: subDays(new Date(), 1),
				subscriptionExpiresAt: subDays(new Date(), 1),
				revenueCatAppUserId
			})
			break
		case 'active':
			await companyRepository.updateSubscription({
				companyId,
				subscriptionStatus: SubscriptionStatus.Active,
				subscriptionPlan: plan,
				trialEndsAt: null,
				subscriptionExpiresAt: addDays(new Date(), 30),
				revenueCatAppUserId
			})
			break
		case 'expired':
			await companyRepository.updateSubscription({
				companyId,
				subscriptionStatus: SubscriptionStatus.Expired,
				subscriptionPlan: null,
				trialEndsAt: subDays(new Date(), 1),
				subscriptionExpiresAt: subDays(new Date(), 1),
				revenueCatAppUserId
			})
			break
		default:
			throw new Error(`Unhandled state: ${state as string}`)
	}
}

const mapWebhookEventType = ({
	event
}: {
	event: NonNullable<ParsedArgs['event']>
}): string => {
	switch (event) {
		case 'purchase':
			return 'INITIAL_PURCHASE'
		case 'renewal':
			return 'RENEWAL'
		case 'expire':
			return 'EXPIRATION'
		case 'cancellation':
			return 'CANCELLATION'
		default:
			throw new Error(`Unhandled event: ${event as string}`)
	}
}

const postWebhook = async ({
	apiBase,
	appUserId,
	event,
	plan
}: {
	apiBase: string
	appUserId: string
	event: NonNullable<ParsedArgs['event']>
	plan: SubscriptionPlan
}): Promise<void> => {
	const eventType = mapWebhookEventType({ event })
	const secret = env.REVENUECAT_WEBHOOK_SECRET
	const headers: Record<string, string> = {
		'Content-Type': 'application/json'
	}
	if (secret) {
		headers.Authorization = `Bearer ${secret}`
	}

	const isTrialPurchase = event === 'purchase'
	const body = {
		api_version: '1.0',
		event: {
			type: eventType,
			app_user_id: appUserId,
			product_id: `${plan}_monthly`,
			expiration_at_ms:
				event === 'expire' || event === 'cancellation'
					? Date.now() - 60_000
					: Date.now() +
						(isTrialPurchase ? 14 : 30) * 24 * 60 * 60 * 1000,
			entitlement_ids: [plan],
			period_type:
				event === 'expire' || event === 'cancellation'
					? 'NORMAL'
					: isTrialPurchase
						? 'TRIAL'
						: 'NORMAL'
		}
	}

	const url = `${apiBase.replace(/\/$/, '')}/billing/revenuecat/webhook`
	console.log(`POST ${url}`)
	console.log(JSON.stringify(body, null, 2))

	const response = await fetch(url, {
		method: 'POST',
		headers,
		body: JSON.stringify(body)
	})

	const text = await response.text()
	console.log(`\nHTTP ${response.status}: ${text}`)

	if (!response.ok) {
		throw new Error(
			`Webhook failed (${response.status}). Is the API running at ${apiBase}?`
		)
	}
}

const verifyGates = async ({
	companyId
}: {
	companyId: string
}): Promise<void> => {
	const entitlementService = container.resolve(EntitlementService)
	const entitlements = await entitlementService.getEntitlements({ companyId })

	console.log('\n=== verify gates ===')

	try {
		await entitlementService.assertCanWrite({ companyId })
		console.log('assertCanWrite:        PASS (writes allowed)')
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		if (message.includes(SUBSCRIPTION_REQUIRED_ERROR)) {
			console.log('assertCanWrite:        BLOCKED (subscription required)')
		} else {
			throw error
		}
	}

	try {
		await entitlementService.assertCanAddAthletes({
			companyId,
			additionalCount: 1
		})
		console.log('assertCanAddAthletes:  PASS (can add 1 more)')
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		if (message.includes(ATHLETE_LIMIT_ERROR)) {
			console.log('assertCanAddAthletes:  BLOCKED (athlete limit)')
		} else if (message.includes(SUBSCRIPTION_REQUIRED_ERROR)) {
			console.log('assertCanAddAthletes:  BLOCKED (subscription required)')
		} else {
			throw error
		}
	}

	console.log(
		`Expected from entitlements: canWrite=${entitlements.canWrite}, athletes=${entitlements.athleteCount}/${
			entitlements.maxAthletes === null ? '∞' : entitlements.maxAthletes
		}`
	)
	console.log('')
}

const fillAthletesToPlanLimit = async ({
	companyId,
	teamId,
	plan
}: {
	companyId: string
	teamId: string
	plan: SubscriptionPlan
}): Promise<void> => {
	const maxAthletes = PLAN_LIMITS[plan].maxAthletes
	if (maxAthletes === null) {
		throw new Error('Elite has unlimited athletes — pick --plan=core or pro')
	}

	const athleteRepository = container.resolve(AthleteRepository)
	const current = await athleteRepository.count({ filter: { companyId } })
	const needed = maxAthletes - current

	if (needed <= 0) {
		console.log(
			`Already at or over ${plan} limit (${current}/${maxAthletes}). Nothing to create.`
		)
		return
	}

	const stamp = Date.now()
	const rows = Array.from({ length: needed }, (_, index) => ({
		teamId,
		companyId,
		firstName: 'Limit',
		lastName: `Tester${current + index + 1}`,
		email: `limit.tester.${stamp}.${index}@billing-test.local`,
		color: '#64748B'
	}))

	await athleteRepository.createMany({ data: rows })
	console.log(
		`Created ${needed} dummy athlete(s). Count should now be ${maxAthletes}/${maxAthletes} for ${plan}.`
	)
	console.log(
		'Next: pnpm billing:test set --state=active --plan=' +
			plan +
			' && pnpm billing:test verify'
	)
}

const clearLimitAthletes = async ({
	companyId
}: {
	companyId: string
}): Promise<void> => {
	const db = getDb()
	const rows = await db
		.update(athletes)
		.set({ deletedAt: new Date() })
		.where(
			and(
				eq(athletes.companyId, companyId),
				isNull(athletes.deletedAt),
				like(athletes.email, `%${LIMIT_TEST_EMAIL_SUFFIX}`)
			)
		)
		.returning({ id: athletes.id })

	console.log(
		`Soft-deleted ${rows.length} limit-test athlete(s) (*${LIMIT_TEST_EMAIL_SUFFIX}).`
	)
}

const run = async (): Promise<void> => {
	const args = parseArgs({ argv: process.argv.slice(2) })

	if (args.command === 'help') {
		printUsage()
		return
	}

	await connectToPostgresDatabase({ dbString: POSTGRES_URL })

	try {
		const { company, teamId, coachEmail, clerkId } = await resolveCompany({
			email: args.email,
			companyId: args.companyId
		})

		console.log(`Coach: ${coachEmail}`)
		console.log(`Company: ${company.id}`)
		console.log(`Team: ${teamId}`)
		if (clerkId) {
			console.log(`Clerk id: ${clerkId}`)
		}

		switch (args.command) {
			case 'status':
				await printEntitlements({
					companyId: company.id,
					label: 'current status'
				})
				break

			case 'set': {
				if (!args.state) {
					throw new Error(
						'set requires --state=trial|trial-ended|active|expired'
					)
				}
				await setState({
					companyId: company.id,
					state: args.state,
					plan: args.plan,
					clerkId
				})
				await printEntitlements({
					companyId: company.id,
					label: `after set --state=${args.state}`
				})
				console.log(
					'Reload the mobile app (or pull-to-refresh) so GraphQL refetches company.subscription.'
				)
				if (args.state === 'trial-ended') {
					console.log(
						'Note: status may flip trial → expired on first entitlement read (lazy expiry).'
					)
				}
				break
			}

			case 'webhook': {
				if (!args.event) {
					throw new Error(
						'webhook requires --event=purchase|expire|renewal|cancellation'
					)
				}
				const appUserId = await ensureRcAppUserId({
					companyId: company.id,
					clerkId
				})
				console.log(`Using RevenueCat app_user_id: ${appUserId}`)
				await postWebhook({
					apiBase: args.apiBase,
					appUserId,
					event: args.event,
					plan: args.plan
				})
				await printEntitlements({
					companyId: company.id,
					label: `after webhook --event=${args.event}`
				})
				console.log(
					'Reload the mobile app so GraphQL refetches company.subscription.'
				)
				break
			}

			case 'verify':
				await printEntitlements({
					companyId: company.id,
					label: 'before verify'
				})
				await verifyGates({ companyId: company.id })
				break

			case 'fill-athletes':
				await fillAthletesToPlanLimit({
					companyId: company.id,
					teamId,
					plan: args.plan
				})
				await printEntitlements({
					companyId: company.id,
					label: 'after fill-athletes'
				})
				break

			case 'clear-limit-athletes':
				await clearLimitAthletes({ companyId: company.id })
				await printEntitlements({
					companyId: company.id,
					label: 'after clear-limit-athletes'
				})
				break

			default:
				printUsage()
		}
	} finally {
		await closePostgresConnection()
	}
}

void run().catch(async (error: unknown) => {
	const message = error instanceof Error ? error.message : String(error)
	console.error('\nBilling test helper failed:', message)
	try {
		await closePostgresConnection()
	} catch {
		// ignore
	}
	process.exit(1)
})
