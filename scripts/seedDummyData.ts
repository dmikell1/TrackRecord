import 'reflect-metadata'

import { subDays } from 'date-fns'
import { container } from 'tsyringe'

import {
	closePostgresConnection,
	connectToPostgresDatabase,
	POSTGRES_URL
} from '@packages/database/createPostgresConnection'
import { SessionType, TrackEvent } from '@packages/enums/trackRecord'
import { TrackRecordNotificationRepository } from '@packages/repositories/notification/TrackRecordNotificationRepository'
import { VideoRepository } from '@packages/repositories/video/VideoRepository'
import { AthleteService } from '@packages/services/athlete/AthleteService'
import { TeamService } from '@packages/services/team/TeamService'
import { TrainingSessionService } from '@packages/services/trainingSession/TrainingSessionService'
import { UserService } from '@packages/services/user/UserService'
import { VideoCommentService } from '@packages/services/videoComment/VideoCommentService'
import { VideoService } from '@packages/services/video/VideoService'
import type { AthleteInterface } from '@packages/types/athlete'
import type { TrainingSessionInterface } from '@packages/types/trainingSession'
import type { VideoResult } from '@packages/types/video'
import { buildFoulResult, buildMarkResult, buildVerticalMarkResult } from '@builders/video'

const SEED_EMAIL_DOMAIN = '@seed.trackrecord.local'
const MIN_SEED_VIDEOS = 28

const SAMPLE_VIDEOS = [
	'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
	'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
	'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
	'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
	'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4'
] as const

const seedAthletes = [
	{
		firstName: 'Maya',
		lastName: 'Chen',
		email: `maya.chen${SEED_EMAIL_DOMAIN}`,
		color: '#3B82F6'
	},
	{
		firstName: 'Jordan',
		lastName: 'Williams',
		email: `jordan.williams${SEED_EMAIL_DOMAIN}`,
		color: '#10B981'
	},
	{
		firstName: 'Ava',
		lastName: 'Martinez',
		email: `ava.martinez${SEED_EMAIL_DOMAIN}`,
		color: '#F59E0B'
	},
	{
		firstName: 'Ethan',
		lastName: 'Brooks',
		email: `ethan.brooks${SEED_EMAIL_DOMAIN}`,
		color: '#8B5CF6'
	}
] as const

type SeedSessionKey =
	| 'earlySeasonInvite'
	| 'dualMeet'
	| 'countyChampionships'
	| 'conferenceFinals'
	| 'stateMeet'
	| 'springPractice'

interface SeedVideoSpec {
	sessionKey: SeedSessionKey
	athleteEmail: string
	event: TrackEvent
	result: VideoResult
	orientation: 'landscape' | 'portrait'
	durationMs: number
	videoIndex: number
}

/**
 * Progression graph only includes Meet sessions (practice is ignored).
 * Each primary athlete has the same event across multiple meets so the chart has a real season curve.
 */
const seedVideoSpecs: SeedVideoSpec[] = [
	// Maya Chen — Long Jump season progression
	{
		sessionKey: 'earlySeasonInvite',
		athleteEmail: `maya.chen${SEED_EMAIL_DOMAIN}`,
		event: TrackEvent.LongJump,
		result: buildMarkResult({ value: 5.12 }),
		orientation: 'landscape',
		durationMs: 3800,
		videoIndex: 0
	},
	{
		sessionKey: 'dualMeet',
		athleteEmail: `maya.chen${SEED_EMAIL_DOMAIN}`,
		event: TrackEvent.LongJump,
		result: buildMarkResult({ value: 5.28 }),
		orientation: 'landscape',
		durationMs: 3900,
		videoIndex: 1
	},
	{
		sessionKey: 'countyChampionships',
		athleteEmail: `maya.chen${SEED_EMAIL_DOMAIN}`,
		event: TrackEvent.LongJump,
		result: buildMarkResult({ value: 5.41 }),
		orientation: 'landscape',
		durationMs: 4000,
		videoIndex: 2
	},
	{
		sessionKey: 'conferenceFinals',
		athleteEmail: `maya.chen${SEED_EMAIL_DOMAIN}`,
		event: TrackEvent.LongJump,
		result: buildMarkResult({ value: 5.55 }),
		orientation: 'landscape',
		durationMs: 4100,
		videoIndex: 3
	},
	{
		sessionKey: 'stateMeet',
		athleteEmail: `maya.chen${SEED_EMAIL_DOMAIN}`,
		event: TrackEvent.LongJump,
		result: buildMarkResult({ value: 5.42 }),
		orientation: 'landscape',
		durationMs: 3900,
		videoIndex: 4
	},
	{
		sessionKey: 'stateMeet',
		athleteEmail: `maya.chen${SEED_EMAIL_DOMAIN}`,
		event: TrackEvent.LongJump,
		result: buildMarkResult({ value: 5.82 }),
		orientation: 'landscape',
		durationMs: 4200,
		videoIndex: 0
	},

	// Jordan Williams — High Jump season progression
	{
		sessionKey: 'earlySeasonInvite',
		athleteEmail: `jordan.williams${SEED_EMAIL_DOMAIN}`,
		event: TrackEvent.HighJump,
		result: buildVerticalMarkResult({ value: 1.6, cleared: true }),
		orientation: 'portrait',
		durationMs: 5800,
		videoIndex: 1
	},
	{
		sessionKey: 'dualMeet',
		athleteEmail: `jordan.williams${SEED_EMAIL_DOMAIN}`,
		event: TrackEvent.HighJump,
		result: buildVerticalMarkResult({ value: 1.65, cleared: true }),
		orientation: 'portrait',
		durationMs: 5900,
		videoIndex: 2
	},
	{
		sessionKey: 'countyChampionships',
		athleteEmail: `jordan.williams${SEED_EMAIL_DOMAIN}`,
		event: TrackEvent.HighJump,
		result: buildVerticalMarkResult({ value: 1.7, cleared: true }),
		orientation: 'portrait',
		durationMs: 6000,
		videoIndex: 3
	},
	{
		sessionKey: 'conferenceFinals',
		athleteEmail: `jordan.williams${SEED_EMAIL_DOMAIN}`,
		event: TrackEvent.HighJump,
		result: buildVerticalMarkResult({ value: 1.75, cleared: true }),
		orientation: 'portrait',
		durationMs: 6100,
		videoIndex: 4
	},
	{
		sessionKey: 'stateMeet',
		athleteEmail: `jordan.williams${SEED_EMAIL_DOMAIN}`,
		event: TrackEvent.HighJump,
		result: buildVerticalMarkResult({ value: 1.78, cleared: true }),
		orientation: 'portrait',
		durationMs: 6200,
		videoIndex: 0
	},
	{
		sessionKey: 'stateMeet',
		athleteEmail: `jordan.williams${SEED_EMAIL_DOMAIN}`,
		event: TrackEvent.HighJump,
		result: buildVerticalMarkResult({ value: 1.81, cleared: false }),
		orientation: 'portrait',
		durationMs: 6300,
		videoIndex: 1
	},

	// Ava Martinez — Pole Vault season progression
	{
		sessionKey: 'earlySeasonInvite',
		athleteEmail: `ava.martinez${SEED_EMAIL_DOMAIN}`,
		event: TrackEvent.PoleVault,
		result: buildVerticalMarkResult({ value: 2.9, cleared: true }),
		orientation: 'portrait',
		durationMs: 6800,
		videoIndex: 2
	},
	{
		sessionKey: 'dualMeet',
		athleteEmail: `ava.martinez${SEED_EMAIL_DOMAIN}`,
		event: TrackEvent.PoleVault,
		result: buildVerticalMarkResult({ value: 3.0, cleared: true }),
		orientation: 'portrait',
		durationMs: 6900,
		videoIndex: 3
	},
	{
		sessionKey: 'countyChampionships',
		athleteEmail: `ava.martinez${SEED_EMAIL_DOMAIN}`,
		event: TrackEvent.PoleVault,
		result: buildVerticalMarkResult({ value: 3.1, cleared: true }),
		orientation: 'portrait',
		durationMs: 7000,
		videoIndex: 4
	},
	{
		sessionKey: 'conferenceFinals',
		athleteEmail: `ava.martinez${SEED_EMAIL_DOMAIN}`,
		event: TrackEvent.PoleVault,
		result: buildVerticalMarkResult({ value: 3.25, cleared: true }),
		orientation: 'portrait',
		durationMs: 7200,
		videoIndex: 0
	},
	{
		sessionKey: 'stateMeet',
		athleteEmail: `ava.martinez${SEED_EMAIL_DOMAIN}`,
		event: TrackEvent.PoleVault,
		result: buildVerticalMarkResult({ value: 3.35, cleared: true }),
		orientation: 'portrait',
		durationMs: 7400,
		videoIndex: 1
	},

	// Ethan Brooks — Discus season progression
	{
		sessionKey: 'earlySeasonInvite',
		athleteEmail: `ethan.brooks${SEED_EMAIL_DOMAIN}`,
		event: TrackEvent.Discus,
		result: buildMarkResult({ value: 38.2 }),
		orientation: 'landscape',
		durationMs: 4800,
		videoIndex: 2
	},
	{
		sessionKey: 'dualMeet',
		athleteEmail: `ethan.brooks${SEED_EMAIL_DOMAIN}`,
		event: TrackEvent.Discus,
		result: buildMarkResult({ value: 39.8 }),
		orientation: 'landscape',
		durationMs: 4900,
		videoIndex: 3
	},
	{
		sessionKey: 'countyChampionships',
		athleteEmail: `ethan.brooks${SEED_EMAIL_DOMAIN}`,
		event: TrackEvent.Discus,
		result: buildMarkResult({ value: 41.1 }),
		orientation: 'landscape',
		durationMs: 5000,
		videoIndex: 4
	},
	{
		sessionKey: 'conferenceFinals',
		athleteEmail: `ethan.brooks${SEED_EMAIL_DOMAIN}`,
		event: TrackEvent.Discus,
		result: buildMarkResult({ value: 42.3 }),
		orientation: 'landscape',
		durationMs: 5100,
		videoIndex: 0
	},
	{
		sessionKey: 'stateMeet',
		athleteEmail: `ethan.brooks${SEED_EMAIL_DOMAIN}`,
		event: TrackEvent.Discus,
		result: buildMarkResult({ value: 43.7 }),
		orientation: 'landscape',
		durationMs: 5200,
		videoIndex: 1
	},

	// Extra variety (practice + secondary events — not on progression chart)
	{
		sessionKey: 'springPractice',
		athleteEmail: `ava.martinez${SEED_EMAIL_DOMAIN}`,
		event: TrackEvent.ShotPut,
		result: buildMarkResult({ value: 10.8 }),
		orientation: 'landscape',
		durationMs: 3600,
		videoIndex: 2
	},
	{
		sessionKey: 'springPractice',
		athleteEmail: `ava.martinez${SEED_EMAIL_DOMAIN}`,
		event: TrackEvent.ShotPut,
		result: buildMarkResult({ value: 11.4 }),
		orientation: 'landscape',
		durationMs: 3800,
		videoIndex: 3
	},
	{
		sessionKey: 'springPractice',
		athleteEmail: `ethan.brooks${SEED_EMAIL_DOMAIN}`,
		event: TrackEvent.LongJump,
		result: buildFoulResult(),
		orientation: 'landscape',
		durationMs: 2900,
		videoIndex: 4
	},
	{
		sessionKey: 'springPractice',
		athleteEmail: `ethan.brooks${SEED_EMAIL_DOMAIN}`,
		event: TrackEvent.LongJump,
		result: buildMarkResult({ value: 6.05 }),
		orientation: 'landscape',
		durationMs: 4100,
		videoIndex: 0
	},
	{
		sessionKey: 'springPractice',
		athleteEmail: `maya.chen${SEED_EMAIL_DOMAIN}`,
		event: TrackEvent.Javelin,
		result: buildMarkResult({ value: 38.6 }),
		orientation: 'landscape',
		durationMs: 4400,
		videoIndex: 1
	},
	{
		sessionKey: 'springPractice',
		athleteEmail: `jordan.williams${SEED_EMAIL_DOMAIN}`,
		event: TrackEvent.Hammer,
		result: buildMarkResult({ value: 48.2 }),
		orientation: 'landscape',
		durationMs: 5200,
		videoIndex: 2
	},
	{
		sessionKey: 'stateMeet',
		athleteEmail: `jordan.williams${SEED_EMAIL_DOMAIN}`,
		event: TrackEvent.TripleJump,
		result: buildMarkResult({ value: 13.1 }),
		orientation: 'landscape',
		durationMs: 4600,
		videoIndex: 3
	}
]

const ensureAthlete = async ({
	athleteService,
	teamId,
	companyId,
	seed
}: {
	athleteService: AthleteService
	teamId: string
	companyId: string
	seed: (typeof seedAthletes)[number]
}): Promise<AthleteInterface> => {
	const match = await athleteService.findAthlete({
		filter: { teamId, email: seed.email }
	})
	if (match) {
		return match
	}
	const created = await athleteService.createAthlete({
		data: {
			teamId,
			companyId,
			firstName: seed.firstName,
			lastName: seed.lastName,
			email: seed.email,
			color: seed.color
		}
	})
	return created.athlete
}

const ensureSession = async ({
	trainingSessionService,
	teamId,
	companyId,
	coachId,
	name,
	date,
	type
}: {
	trainingSessionService: TrainingSessionService
	teamId: string
	companyId: string
	coachId: string
	name: string
	date: Date
	type: SessionType
}): Promise<TrainingSessionInterface> => {
	const sessions = await trainingSessionService.findTrainingSessions({
		filter: { teamId }
	})
	const existing = sessions.find(s => s.name === name)
	if (existing) {
		return existing
	}
	return trainingSessionService.createTrainingSession({
		data: {
			teamId,
			companyId,
			name,
			date,
			type,
			createdByUserId: coachId
		}
	})
}

const shouldReset = (): boolean => {
	const value = process.env.SEED_RESET
	return value === '1' || value === 'true'
}

const run = async (): Promise<void> => {
	const coachEmail = process.env.SEED_COACH_EMAIL ?? 'devyn.mikell@gmail.com'
	const reset = shouldReset()

	await connectToPostgresDatabase({ dbString: POSTGRES_URL })

	const userService = container.resolve(UserService)
	const teamService = container.resolve(TeamService)
	const athleteService = container.resolve(AthleteService)
	const trainingSessionService = container.resolve(TrainingSessionService)
	const videoService = container.resolve(VideoService)
	const videoRepository = container.resolve(VideoRepository)
	const videoCommentService = container.resolve(VideoCommentService)
	const notificationRepository = container.resolve(TrackRecordNotificationRepository)

	const coach = await userService.findUser({
		filter: { email: coachEmail },
		relations: { loadTeams: true, loadCompanies: true }
	})

	if (!coach) {
		throw new Error(
			`No user found for ${coachEmail}. Sign in to the app once so Clerk creates your profile, then run seed again.`
		)
	}

	const team = coach.teams?.[0]
	const company = coach.companies?.[0]

	if (!team || !company) {
		throw new Error(`User ${coachEmail} has no team/company. Complete signup first.`)
	}

	await teamService.updateTeam({
		filter: { id: team.id },
		data: {
			name: team.name.startsWith('Team ') ? 'Lincoln High Track' : team.name,
			settings: { units: 'imperial' }
		}
	})

	const athletes = await Promise.all(
		seedAthletes.map(seed =>
			ensureAthlete({
				athleteService,
				teamId: team.id,
				companyId: company.id,
				seed
			})
		)
	)

	const athleteByEmail = new Map(athletes.map(a => [a.email, a]))

	const sessionDefs = {
		earlySeasonInvite: {
			name: 'Early Season Invite',
			date: subDays(new Date(), 90),
			type: SessionType.Meet
		},
		dualMeet: {
			name: 'Dual Meet vs Riverside',
			date: subDays(new Date(), 60),
			type: SessionType.Meet
		},
		countyChampionships: {
			name: 'County Championships',
			date: subDays(new Date(), 45),
			type: SessionType.Meet
		},
		conferenceFinals: {
			name: 'Conference Finals',
			date: subDays(new Date(), 21),
			type: SessionType.Meet
		},
		stateMeet: {
			name: 'State Meet',
			date: subDays(new Date(), 7),
			type: SessionType.Meet
		},
		springPractice: {
			name: 'Spring Practice',
			date: subDays(new Date(), 3),
			type: SessionType.Practice
		}
	} as const

	const sessions = {
		earlySeasonInvite: await ensureSession({
			trainingSessionService,
			teamId: team.id,
			companyId: company.id,
			coachId: coach.id,
			...sessionDefs.earlySeasonInvite
		}),
		dualMeet: await ensureSession({
			trainingSessionService,
			teamId: team.id,
			companyId: company.id,
			coachId: coach.id,
			...sessionDefs.dualMeet
		}),
		countyChampionships: await ensureSession({
			trainingSessionService,
			teamId: team.id,
			companyId: company.id,
			coachId: coach.id,
			...sessionDefs.countyChampionships
		}),
		conferenceFinals: await ensureSession({
			trainingSessionService,
			teamId: team.id,
			companyId: company.id,
			coachId: coach.id,
			...sessionDefs.conferenceFinals
		}),
		stateMeet: await ensureSession({
			trainingSessionService,
			teamId: team.id,
			companyId: company.id,
			coachId: coach.id,
			...sessionDefs.stateMeet
		}),
		springPractice: await ensureSession({
			trainingSessionService,
			teamId: team.id,
			companyId: company.id,
			coachId: coach.id,
			...sessionDefs.springPractice
		})
	}

	if (reset) {
		const removedVideos = await videoRepository.delete({ filter: { teamId: team.id } })
		await notificationRepository.delete({ filter: { teamId: team.id } })
		console.log(`Reset: cleared team videos and notifications (${removedVideos ? 'ok' : 'none'})`)

		for (const [key, def] of Object.entries(sessionDefs) as Array<
			[keyof typeof sessionDefs, (typeof sessionDefs)[keyof typeof sessionDefs]]
		>) {
			const session = sessions[key]
			await trainingSessionService.updateTrainingSession({
				filter: { id: session.id, teamId: team.id },
				data: { date: def.date, type: def.type }
			})
		}
	}

	let existingVideos = await videoService.findVideos({ filter: { teamId: team.id } })
	let createdVideoCount = 0
	const shouldSeedVideos = reset || existingVideos.length < MIN_SEED_VIDEOS

	if (shouldSeedVideos) {
		for (const spec of seedVideoSpecs) {
			const athlete = athleteByEmail.get(spec.athleteEmail)
			if (!athlete) {
				continue
			}

			const session = sessions[spec.sessionKey]
			if (!reset) {
				const alreadyExists = existingVideos.some(
					v =>
						v.sessionId === session.id &&
						v.athleteId === athlete.id &&
						v.event === spec.event &&
						JSON.stringify(v.result) === JSON.stringify(spec.result)
				)

				if (alreadyExists) {
					continue
				}
			}

			await videoService.createVideo({
				data: {
					sessionId: session.id,
					teamId: team.id,
					athleteId: athlete.id,
					event: spec.event,
					videoUrl: SAMPLE_VIDEOS[spec.videoIndex % SAMPLE_VIDEOS.length],
					orientation: spec.orientation,
					result: spec.result,
					durationMs: spec.durationMs
				}
			})
			createdVideoCount += 1
		}
	}

	const allVideos = await videoService.findVideos({ filter: { teamId: team.id } })
	const maya = athleteByEmail.get(`maya.chen${SEED_EMAIL_DOMAIN}`)
	const jordan = athleteByEmail.get(`jordan.williams${SEED_EMAIL_DOMAIN}`)
	const mayaLj = allVideos.find(
		v => v.athleteId === maya?.id && v.event === TrackEvent.LongJump && v.isPR
	)
	const jordanHj = allVideos.find(
		v => v.athleteId === jordan?.id && v.event === TrackEvent.HighJump
	)

	if (mayaLj && jordanHj) {
		const mayaComments = await videoCommentService.findVideoComments({
			filter: { videoId: mayaLj.id }
		})

		if (reset || mayaComments.length === 0) {
			await videoCommentService.createVideoComment({
				data: {
					videoId: mayaLj.id,
					userId: coach.id,
					text: 'Great pop off the board — drive the knee higher on the next one.',
					stampSeconds: 2
				},
				teamId: team.id
			})

			await videoCommentService.createVideoComment({
				data: {
					videoId: jordanHj.id,
					userId: coach.id,
					text: 'Bar clearance looked clean at 1.70m.',
					stampSeconds: 5
				},
				teamId: team.id
			})
		}
	}

	console.log('\nSeed complete.\n')
	if (reset) {
		console.log('Mode:  reset (team videos + notifications cleared, then re-seeded)')
	}
	console.log(`Coach: ${coach.firstName} ${coach.lastName} (${coach.email})`)
	console.log(`Team:  ${team.name} (${team.id})`)
	console.log(`Athletes: ${athletes.length}`)
	console.log(`Sessions: ${Object.keys(sessions).length}`)
	console.log(`Videos: ${allVideos.length} (${createdVideoCount} added this run)`)
	console.log(
		'\nProgression chart: open Maya (LJ), Jordan (HJ), Ava (PV), or Ethan (Discus).'
	)
	console.log('Reload the app to see dummy athletes and historical marks.\n')

	await closePostgresConnection()
}

void run().catch(async (error: unknown) => {
	const message = error instanceof Error ? error.message : String(error)
	console.error('Seed failed:', message)
	try {
		await closePostgresConnection()
	} catch {
		// ignore disconnect errors
	}
	process.exit(1)
})
