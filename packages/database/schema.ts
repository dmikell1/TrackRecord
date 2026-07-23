import { relations } from 'drizzle-orm'
import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar
} from 'drizzle-orm/pg-core'

import { standardTimestamps } from '@packages/database/timestampColumns'

export const users = pgTable('users', {
	id: uuid('id').defaultRandom().primaryKey(),
	clerkId: varchar('clerk_id', { length: 255 }),
	firstName: varchar('first_name', { length: 45 }).notNull(),
	lastName: varchar('last_name', { length: 45 }).notNull(),
	email: varchar('email', { length: 255 }).notNull().unique(),
	avatar: text('avatar').notNull(),
	status: varchar('status', { length: 50 }).notNull(),
	invitedById: uuid('invited_by_id'),
	...standardTimestamps
})

export const companies = pgTable('companies', {
	id: uuid('id').defaultRandom().primaryKey(),
	ownerId: uuid('owner_id')
		.notNull()
		.references(() => users.id),
	name: varchar('name', { length: 45 }).notNull(),
	settings: jsonb('settings')
		.notNull()
		.$type<{ timezoneName?: string }>(),
	subscriptionPlan: varchar('subscription_plan', { length: 50 }),
	subscriptionStatus: varchar('subscription_status', { length: 50 })
		.notNull()
		.default('trial'),
	trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
	subscriptionExpiresAt: timestamp('subscription_expires_at', {
		withTimezone: true
	}),
	revenueCatAppUserId: varchar('revenue_cat_app_user_id', { length: 255 }),
	...standardTimestamps
})

export const teams = pgTable('teams', {
	id: uuid('id').defaultRandom().primaryKey(),
	name: varchar('name', { length: 45 }).notNull(),
	ownerId: uuid('owner_id')
		.notNull()
		.references(() => users.id),
	companyId: uuid('company_id')
		.notNull()
		.references(() => companies.id),
	settings: jsonb('settings')
		.notNull()
		.default({})
		.$type<import('@packages/types/teamSettings').TeamSettingsInterface>(),
	...standardTimestamps
})

export const companyUsers = pgTable(
	'company_users',
	{
		companyId: uuid('company_id')
			.notNull()
			.references(() => companies.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		...standardTimestamps
	},
	(t) => ({
		pk: primaryKey({ columns: [t.companyId, t.userId] })
	})
)

export const teamUsers = pgTable(
	'team_users',
	{
		teamId: uuid('team_id')
			.notNull()
			.references(() => teams.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		...standardTimestamps
	},
	(t) => ({
		pk: primaryKey({ columns: [t.teamId, t.userId] })
	})
)

export const userRoles = pgTable('user_roles', {
	id: uuid('id').defaultRandom().primaryKey(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	companyId: uuid('company_id')
		.notNull()
		.references(() => companies.id, { onDelete: 'cascade' }),
	role: varchar('role', { length: 50 }).notNull(),
	...standardTimestamps
})

// ─── Track Record Domain Tables ───────────────────────────────────────────────

export const athletes = pgTable('athletes', {
	id: uuid('id').defaultRandom().primaryKey(),
	teamId: uuid('team_id')
		.notNull()
		.references(() => teams.id, { onDelete: 'cascade' }),
	companyId: uuid('company_id')
		.notNull()
		.references(() => companies.id, { onDelete: 'cascade' }),
	userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
	firstName: varchar('first_name', { length: 45 }).notNull(),
	lastName: varchar('last_name', { length: 45 }).notNull(),
	email: varchar('email', { length: 255 }).notNull(),
	phone: varchar('phone', { length: 30 }),
	color: varchar('color', { length: 20 }).notNull().default('#3B82F6'),
	dateOfBirth: timestamp('date_of_birth', { withTimezone: true }),
	parentalConsentStatus: varchar('parental_consent_status', { length: 50 })
		.notNull()
		.default('NotRequired'),
	parentEmail: varchar('parent_email', { length: 255 }),
	parentalConsentToken: varchar('parental_consent_token', { length: 255 }),
	parentalConsentAt: timestamp('parental_consent_at', { withTimezone: true }),
	deletedAt: timestamp('deleted_at', { withTimezone: true }),
	...standardTimestamps
})

export const athleteInvites = pgTable('athlete_invites', {
	id: uuid('id').defaultRandom().primaryKey(),
	teamId: uuid('team_id')
		.notNull()
		.references(() => teams.id, { onDelete: 'cascade' }),
	email: varchar('email', { length: 255 }).notNull(),
	token: varchar('token', { length: 255 }).notNull().unique(),
	status: varchar('status', { length: 50 }).notNull().default('Pending'),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	acceptedByUserId: uuid('accepted_by_user_id').references(() => users.id, { onDelete: 'set null' }),
	...standardTimestamps
})

export const recorderInvites = pgTable('recorder_invites', {
	id: uuid('id').defaultRandom().primaryKey(),
	teamId: uuid('team_id')
		.notNull()
		.references(() => teams.id, { onDelete: 'cascade' }),
	email: varchar('email', { length: 255 }).notNull(),
	token: varchar('token', { length: 255 }).notNull().unique(),
	status: varchar('status', { length: 50 }).notNull().default('Pending'),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	acceptedByUserId: uuid('accepted_by_user_id').references(() => users.id, {
		onDelete: 'set null'
	}),
	...standardTimestamps
})

export const trainingSessions = pgTable(
	'training_sessions',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		teamId: uuid('team_id')
			.notNull()
			.references(() => teams.id, { onDelete: 'cascade' }),
		companyId: uuid('company_id')
			.notNull()
			.references(() => companies.id, { onDelete: 'cascade' }),
		name: varchar('name', { length: 255 }).notNull(),
		date: timestamp('date', { withTimezone: true }).notNull(),
		type: varchar('type', { length: 50 }).notNull(),
		createdByUserId: uuid('created_by_user_id')
			.notNull()
			.references(() => users.id),
		...standardTimestamps
	},
	table => ({
		teamTypeIdx: index('training_sessions_team_type_idx').on(
			table.teamId,
			table.type
		)
	})
)

export const videos = pgTable(
	'videos',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		sessionId: uuid('session_id')
			.notNull()
			.references(() => trainingSessions.id, { onDelete: 'cascade' }),
		teamId: uuid('team_id')
			.notNull()
			.references(() => teams.id, { onDelete: 'cascade' }),
		athleteId: uuid('athlete_id').references(() => athletes.id, {
			onDelete: 'cascade'
		}),
		event: varchar('event', { length: 50 }),
		result: jsonb('result').$type<{
			type: 'Foul' | 'Mark' | 'VerticalHeights' | 'Time' | 'DNF' | 'DQ'
			value?: number
			cleared?: boolean
			reason?: string
			heights?: Array<{ height: number; cleared: boolean }>
		} | null>(),
		isPR: boolean('is_pr').notNull().default(false),
		videoUrl: text('video_url').notNull(),
		thumbUrl: text('thumb_url'),
		orientation: varchar('orientation', { length: 20 })
			.notNull()
			.default('portrait'),
		durationMs: integer('duration_ms'),
		recordedAt: timestamp('recorded_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
		...standardTimestamps
	},
	table => ({
		teamAthleteEventIdx: index('videos_team_athlete_event_idx').on(
			table.teamId,
			table.athleteId,
			table.event
		)
	})
)

export const videoPerformances = pgTable(
	'video_performances',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		videoId: uuid('video_id')
			.notNull()
			.references(() => videos.id, { onDelete: 'cascade' }),
		teamId: uuid('team_id')
			.notNull()
			.references(() => teams.id, { onDelete: 'cascade' }),
		athleteId: uuid('athlete_id')
			.notNull()
			.references(() => athletes.id, { onDelete: 'cascade' }),
		event: varchar('event', { length: 50 }),
		result: jsonb('result').$type<{
			type: 'Foul' | 'Mark' | 'VerticalHeights' | 'Time' | 'DNF' | 'DQ'
			value?: number
			cleared?: boolean
			reason?: string
			heights?: Array<{ height: number; cleared: boolean }>
		} | null>(),
		isPR: boolean('is_pr').notNull().default(false),
		...standardTimestamps
	},
	table => ({
		videoAthleteUnique: uniqueIndex('video_performances_video_athlete_idx').on(
			table.videoId,
			table.athleteId
		),
		teamAthleteEventIdx: index('video_performances_team_athlete_event_idx').on(
			table.teamId,
			table.athleteId,
			table.event
		)
	})
)

export const videoComments = pgTable('video_comments', {
	id: uuid('id').defaultRandom().primaryKey(),
	videoId: uuid('video_id')
		.notNull()
		.references(() => videos.id, { onDelete: 'cascade' }),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	text: text('text').notNull(),
	stampSeconds: integer('stamp_seconds'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
})

export const trackRecordNotifications = pgTable('track_record_notifications', {
	id: uuid('id').defaultRandom().primaryKey(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	teamId: uuid('team_id')
		.notNull()
		.references(() => teams.id, { onDelete: 'cascade' }),
	type: varchar('type', { length: 50 }).notNull(),
	text: text('text').notNull(),
	read: boolean('read').notNull().default(false),
	payload: jsonb('payload').$type<Record<string, unknown>>(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
})

export const pushDeviceTokens = pgTable(
	'push_device_tokens',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		token: text('token').notNull(),
		platform: varchar('platform', { length: 20 }).notNull(),
		...standardTimestamps
	},
	(t) => ({
		tokenUnique: uniqueIndex('push_device_tokens_token_unique').on(t.token),
		userIdIdx: index('push_device_tokens_user_id_idx').on(t.userId)
	})
)

export const coachLifecycleEmailJobs = pgTable(
	'coach_lifecycle_email_jobs',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		companyId: uuid('company_id')
			.notNull()
			.references(() => companies.id, { onDelete: 'cascade' }),
		teamId: uuid('team_id')
			.notNull()
			.references(() => teams.id, { onDelete: 'cascade' }),
		step: varchar('step', { length: 50 }).notNull(),
		status: varchar('status', { length: 50 }).notNull().default('pending'),
		scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
		sentAt: timestamp('sent_at', { withTimezone: true }),
		skippedAt: timestamp('skipped_at', { withTimezone: true }),
		skipReason: text('skip_reason'),
		...standardTimestamps
	},
	(t) => ({
		userStepUnique: uniqueIndex(
			'coach_lifecycle_email_jobs_user_step_unique'
		).on(t.userId, t.step),
		dueIdx: index('coach_lifecycle_email_jobs_due_idx').on(
			t.status,
			t.scheduledFor
		),
		companyIdIdx: index('coach_lifecycle_email_jobs_company_id_idx').on(
			t.companyId
		)
	})
)

// ─── Track Record Relations ────────────────────────────────────────────────────

export const athletesRelations = relations(athletes, ({ one, many }) => ({
	team: one(teams, { fields: [athletes.teamId], references: [teams.id] }),
	company: one(companies, { fields: [athletes.companyId], references: [companies.id] }),
	user: one(users, { fields: [athletes.userId], references: [users.id] }),
	videos: many(videos),
	invites: many(athleteInvites)
}))

export const athleteInvitesRelations = relations(athleteInvites, ({ one }) => ({
	team: one(teams, { fields: [athleteInvites.teamId], references: [teams.id] }),
	acceptedByUser: one(users, { fields: [athleteInvites.acceptedByUserId], references: [users.id] })
}))

export const recorderInvitesRelations = relations(recorderInvites, ({ one }) => ({
	team: one(teams, { fields: [recorderInvites.teamId], references: [teams.id] }),
	acceptedByUser: one(users, {
		fields: [recorderInvites.acceptedByUserId],
		references: [users.id]
	})
}))

export const trainingSessionsRelations = relations(trainingSessions, ({ one, many }) => ({
	team: one(teams, { fields: [trainingSessions.teamId], references: [teams.id] }),
	company: one(companies, { fields: [trainingSessions.companyId], references: [companies.id] }),
	createdBy: one(users, { fields: [trainingSessions.createdByUserId], references: [users.id] }),
	videos: many(videos)
}))

export const videosRelations = relations(videos, ({ one, many }) => ({
	session: one(trainingSessions, { fields: [videos.sessionId], references: [trainingSessions.id] }),
	team: one(teams, { fields: [videos.teamId], references: [teams.id] }),
	athlete: one(athletes, { fields: [videos.athleteId], references: [athletes.id] }),
	comments: many(videoComments),
	performances: many(videoPerformances)
}))

export const videoPerformancesRelations = relations(videoPerformances, ({ one }) => ({
	video: one(videos, { fields: [videoPerformances.videoId], references: [videos.id] }),
	team: one(teams, { fields: [videoPerformances.teamId], references: [teams.id] }),
	athlete: one(athletes, { fields: [videoPerformances.athleteId], references: [athletes.id] })
}))

export const videoCommentsRelations = relations(videoComments, ({ one }) => ({
	video: one(videos, { fields: [videoComments.videoId], references: [videos.id] }),
	user: one(users, { fields: [videoComments.userId], references: [users.id] })
}))

export const trackRecordNotificationsRelations = relations(trackRecordNotifications, ({ one }) => ({
	user: one(users, { fields: [trackRecordNotifications.userId], references: [users.id] }),
	team: one(teams, { fields: [trackRecordNotifications.teamId], references: [teams.id] })
}))

export const pushDeviceTokensRelations = relations(pushDeviceTokens, ({ one }) => ({
	user: one(users, { fields: [pushDeviceTokens.userId], references: [users.id] })
}))

export const coachLifecycleEmailJobsRelations = relations(
	coachLifecycleEmailJobs,
	({ one }) => ({
		user: one(users, {
			fields: [coachLifecycleEmailJobs.userId],
			references: [users.id]
		}),
		company: one(companies, {
			fields: [coachLifecycleEmailJobs.companyId],
			references: [companies.id]
		}),
		team: one(teams, {
			fields: [coachLifecycleEmailJobs.teamId],
			references: [teams.id]
		})
	})
)

export const usersRelations = relations(users, ({ many }) => ({
	companyLinks: many(companyUsers),
	teamLinks: many(teamUsers),
	roles: many(userRoles),
	pushDeviceTokens: many(pushDeviceTokens)
}))

export const companiesRelations = relations(companies, ({ one, many }) => ({
	owner: one(users, {
		fields: [companies.ownerId],
		references: [users.id]
	}),
	teams: many(teams),
	memberLinks: many(companyUsers)
}))

export const teamsRelations = relations(teams, ({ one, many }) => ({
	company: one(companies, {
		fields: [teams.companyId],
		references: [companies.id]
	}),
	owner: one(users, {
		fields: [teams.ownerId],
		references: [users.id]
	}),
	memberLinks: many(teamUsers)
}))

export const schema = {
	users,
	companies,
	teams,
	companyUsers,
	teamUsers,
	userRoles,
	athletes,
	athleteInvites,
	recorderInvites,
	trainingSessions,
	videos,
	videoPerformances,
	videoComments,
	trackRecordNotifications,
	pushDeviceTokens,
	coachLifecycleEmailJobs,
	usersRelations,
	companiesRelations,
	teamsRelations,
	athletesRelations,
	athleteInvitesRelations,
	recorderInvitesRelations,
	trainingSessionsRelations,
	videosRelations,
	videoPerformancesRelations,
	videoCommentsRelations,
	trackRecordNotificationsRelations,
	pushDeviceTokensRelations,
	coachLifecycleEmailJobsRelations
}
