import gql from 'graphql-tag'

export const TrackRecord = gql`
	extend type Team {
		settings: TeamSettings!
	}

	type TeamSettings {
		units: String
		accountHolderType: AccountHolderType
		coachingLevels: [CoachingLevel!]!
		focusedEventGroups: [EventGroup!]!
		enabledEvents: [TrackEvent!]!
	}

	# ─── Enums ────────────────────────────────────────────────────────────────────

	enum SessionType {
		Meet
		Practice
	}

	enum CoachingLevel {
		MiddleSchool
		HighSchool
		College
		Professional
		Club
	}

	enum AccountHolderType {
		Coach
		Parent
	}

	enum EventGroup {
		Sprints
		MiddleDistance
		Distance
		Hurdles
		VerticalJumps
		HorizontalJumps
		Throws
		Relays
		Specialty
	}

	enum TrackEvent {
		HighJump
		PoleVault
		LongJump
		TripleJump
		ShotPut
		Discus
		Javelin
		Hammer
		M60
		M100
		M200
		M300
		M400
		M500
		M600
		M800
		M1000
		M1500
		M1600
		M3000
		M3200
		M5000
		M10000
		Mile
		TwoMile
		M60H
		M100H
		M110H
		M300H
		M400H
		M300IH
		M400LH
		Steeplechase
		M4x100
		M4x200
		M4x400
		M4x800
		SprintMedley
		DistanceMedley
		RaceWalk
	}

	enum VideoResultType {
		Foul
		Mark
		VerticalHeights
		Time
		DNF
		DQ
	}

	enum AthleteInviteStatus {
		Pending
		Accepted
		Expired
	}

	enum ParentalConsentStatus {
		NotRequired
		Pending
		Granted
	}

	enum BulkAthleteImportIssueReason {
		MissingName
		InvalidEmail
		DuplicateInBatch
		AlreadyOnTeam
		InviteEmailFailed
	}

	enum JoinInviteKind {
		Athlete
		Team
		Recorder
	}

	enum RecorderInviteStatus {
		Pending
		Accepted
		Expired
		Cancelled
	}

	enum TeamRecorderStatus {
		Pending
		Active
	}

	type TeamRecorderEntry {
		id: ID!
		email: String!
		displayName: String!
		status: TeamRecorderStatus!
		userId: ID
		inviteId: ID
	}

	type JoinInfo {
		kind: JoinInviteKind!
		teamId: ID!
		teamName: String!
		email: String
		firstName: String
		lastName: String
		status: AthleteInviteStatus
	}

	type RecorderInvite {
		id: ID!
		teamId: ID!
		email: String!
		token: String!
		status: RecorderInviteStatus!
		expiresAt: DateTime!
		acceptedByUserId: ID
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	enum TrackRecordNotificationType {
		Comment
		Join
		Video
	}

	# ─── Types ────────────────────────────────────────────────────────────────────

	type Athlete {
		id: ID!
		teamId: ID!
		companyId: ID!
		userId: ID
		firstName: String!
		lastName: String!
		email: String!
		phone: String
		color: String!
		avatarUrl: String
		dateOfBirth: DateTime
		parentalConsentStatus: ParentalConsentStatus!
		parentEmail: String
		parentalConsentAt: DateTime
		deletedAt: DateTime
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	type ParentalConsentInfo {
		athleteFirstName: String!
		athleteLastName: String!
		teamName: String!
		status: ParentalConsentStatus!
	}

	type AthleteInvite {
		id: ID!
		teamId: ID!
		email: String!
		token: String!
		status: AthleteInviteStatus!
		expiresAt: DateTime!
		acceptedByUserId: ID
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	type BulkAthleteImportRowResult {
		row: Int!
		email: String!
		reason: BulkAthleteImportIssueReason!
	}

	type BulkCreateAthletesResult {
		created: [Athlete!]!
		skipped: [BulkAthleteImportRowResult!]!
		failed: [BulkAthleteImportRowResult!]!
		inviteEmailsFailed: [BulkAthleteImportRowResult!]!
	}

	type TrainingSession {
		id: ID!
		teamId: ID!
		companyId: ID!
		name: String!
		date: DateTime!
		type: SessionType!
		createdByUserId: ID!
		createdAt: DateTime!
		updatedAt: DateTime!
		videos: [Video!]
		videoCount: Int!
	}

	type Video {
		id: ID!
		sessionId: ID!
		teamId: ID!
		athleteId: ID
		event: TrackEvent
		result: VideoResult
		isPR: Boolean!
		videoUrl: String!
		thumbUrl: String
		orientation: String!
		durationMs: Int
		recordedAt: DateTime!
		createdAt: DateTime!
		updatedAt: DateTime!
		commentCount: Int!
		comments: [VideoComment!]
		performances: [VideoPerformance!]!
	}

	type VideoPerformance {
		id: ID!
		videoId: ID!
		teamId: ID!
		athleteId: ID!
		event: TrackEvent!
		result: VideoResult
		isPR: Boolean!
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	type VideoResult {
		type: VideoResultType!
		value: Float
		cleared: Boolean
		reason: String
		heights: [HeightAttempt!]
	}

	type HeightAttempt {
		height: Float!
		cleared: Boolean!
	}

	type VideoComment {
		id: ID!
		videoId: ID!
		userId: ID!
		text: String!
		stampSeconds: Int
		createdAt: DateTime!
	}

	type TrackRecordNotification {
		id: ID!
		userId: ID!
		teamId: ID!
		type: TrackRecordNotificationType!
		text: String!
		read: Boolean!
		payload: String
		createdAt: DateTime!
	}

	type ProgressionPoint {
		date: DateTime!
		bestResult: Float
		label: String!
		sessionId: ID!
		sessionName: String!
	}

	type ProgressionStats {
		pr: Float
		recentResult: Float
		totalAttempts: Int!
		prDate: DateTime
	}

	type AthleteProgression {
		points: [ProgressionPoint!]!
		stats: ProgressionStats!
	}

	# ─── Input Types ──────────────────────────────────────────────────────────────

	input CreateTrainingSessionInput {
		team: ID!
		companyId: ID!
		name: String!
		date: DateTime!
		type: SessionType!
	}

	input UpdateTrainingSessionInput {
		team: ID!
		name: String
		date: DateTime
		type: SessionType
	}

	input CreateAthleteInput {
		team: ID!
		companyId: ID!
		firstName: String!
		lastName: String!
		email: String!
		phone: String
		color: String!
		sendInvite: Boolean
	}

	type CreateAthleteResult {
		athlete: Athlete!
		invite: AthleteInvite
		inviteEmailSent: Boolean
	}

	input UpdateAthleteInput {
		team: ID!
		firstName: String
		lastName: String
		email: String
		phone: String
		color: String
	}

	input CreateAthleteInviteInput {
		team: ID!
		email: String!
	}

	input CreateRecorderInviteInput {
		team: ID!
		email: String!
	}

	type CreateRecorderInviteResult {
		invite: RecorderInvite!
		emailSent: Boolean!
	}

	input BulkAthleteRowInput {
		firstName: String!
		lastName: String!
		email: String!
		phone: String
	}

	input BulkCreateAthletesInput {
		team: ID!
		companyId: ID!
		athletes: [BulkAthleteRowInput!]!
		sendInvites: Boolean
	}

	input VideoResultInput {
		type: VideoResultType!
		value: Float
		cleared: Boolean
		reason: String
		heights: [HeightAttemptInput!]
	}

	input PerformanceInput {
		athleteId: ID!
		result: VideoResultInput
	}

	input CreateRunningVideoInput {
		team: ID!
		sessionId: ID!
		event: TrackEvent
		videoUrl: String!
		thumbUrl: String
		orientation: String!
		durationMs: Int
		recordedAt: DateTime
		performances: [PerformanceInput!]!
	}

	input UpdateVideoPerformancesInput {
		team: ID!
		event: TrackEvent
		performances: [PerformanceInput!]!
	}

	input HeightAttemptInput {
		height: Float!
		cleared: Boolean!
	}

	input CreateVideoInput {
		team: ID!
		sessionId: ID!
		athleteId: ID
		event: TrackEvent
		result: VideoResultInput
		videoUrl: String!
		thumbUrl: String
		orientation: String!
		durationMs: Int
		recordedAt: DateTime
	}

	input UpdateVideoInput {
		team: ID!
		athleteId: ID
		event: TrackEvent
		result: VideoResultInput
		videoUrl: String
		thumbUrl: String
		durationMs: Int
	}

	input CreateVideoCommentInput {
		team: ID!
		videoId: ID!
		text: String!
		stampSeconds: Int
	}

	input TeamSettingsInput {
		units: String
		accountHolderType: AccountHolderType
		coachingLevels: [CoachingLevel!]
		focusedEventGroups: [EventGroup!]
		enabledEvents: [TrackEvent!]
	}

	# ─── Queries ──────────────────────────────────────────────────────────────────

	extend type Query {
		trainingSessions(team: ID!, type: SessionType, search: String): [TrainingSession!]!
		trainingSession(id: ID!, team: ID!): TrainingSession
		athletes(team: ID!, query: String): [Athlete!]!
		athlete(id: ID!, team: ID!): Athlete
		athleteInviteLink(team: ID!, athleteId: ID!): String!
		videos(team: ID!, sessionId: ID, athleteId: ID, event: TrackEvent): [Video!]!
		video(id: ID!, team: ID!): Video
		notifications(team: ID!, limit: Int): [TrackRecordNotification!]!
		athleteProgression(
			team: ID!
			athleteId: ID!
			event: TrackEvent!
			startDate: DateTime
			endDate: DateTime
		): AthleteProgression!
		athleteInvite(token: String!): AthleteInvite
		joinInfo(token: String!): JoinInfo
		parentalConsentInfo(token: String!): ParentalConsentInfo
		teamRecorders(team: ID!): [TeamRecorderEntry!]!
	}

	# ─── Mutations ────────────────────────────────────────────────────────────────

	extend type Mutation {
		createTrainingSession(data: CreateTrainingSessionInput!): TrainingSession!
		updateTrainingSession(id: ID!, data: UpdateTrainingSessionInput!): TrainingSession!
		deleteTrainingSession(id: ID!, team: ID!): Boolean!

		createAthlete(data: CreateAthleteInput!): CreateAthleteResult!
		bulkCreateAthletes(data: BulkCreateAthletesInput!): BulkCreateAthletesResult!
		updateAthlete(id: ID!, data: UpdateAthleteInput!): Athlete!
		deleteAthlete(id: ID!, team: ID!, deleteVideos: Boolean!): Boolean!
		createAthleteInvite(data: CreateAthleteInviteInput!): AthleteInvite!
		sendAthleteInviteEmail(team: ID!, inviteId: ID!): Boolean!
		resendAthleteInvite(team: ID!, athleteId: ID!): AthleteInvite!
		acceptAthleteInvite(
			token: String!
			dateOfBirth: DateTime!
			parentEmail: String
		): Athlete!
		grantParentalConsent(token: String!): Athlete!
		resendParentalConsentEmail(team: ID!, athleteId: ID!): Boolean!

		createRecorderInvite(data: CreateRecorderInviteInput!): CreateRecorderInviteResult!
		resendRecorderInvite(team: ID!, inviteId: ID!): RecorderInvite!
		acceptRecorderInvite(token: String!): Boolean!
		cancelRecorderInvite(id: ID!, team: ID!): Boolean!
		revokeRecorderAccess(userId: ID!, team: ID!): Boolean!

		createVideo(data: CreateVideoInput!): Video!
		createRunningVideo(data: CreateRunningVideoInput!): Video!
		updateVideo(id: ID!, data: UpdateVideoInput!): Video!
		updateVideoPerformances(id: ID!, data: UpdateVideoPerformancesInput!): Video!
		deleteVideo(id: ID!, team: ID!): Boolean!
		moveVideos(ids: [ID!]!, sessionId: ID!, team: ID!): [Video!]!

		createVideoComment(data: CreateVideoCommentInput!): VideoComment!

		markNotificationsRead(ids: [ID!]!, team: ID!): Boolean!
		markAllNotificationsRead(team: ID!): Boolean!

		updateTeam(team: ID!, name: String!): Team!
		updateTeamSettings(team: ID!, settings: TeamSettingsInput!): Team!
		teamInviteLink(team: ID!): String!
	}
`
