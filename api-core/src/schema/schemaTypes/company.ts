import gql from 'graphql-tag'

export const Company = gql`
	enum SubscriptionPlan {
		core
		pro
		elite
	}

	enum SubscriptionStatus {
		trial
		active
		expired
		cancelled
	}

	type CompanySubscription {
		plan: SubscriptionPlan
		status: SubscriptionStatus!
		canWrite: Boolean!
		maxAthletes: Int
		maxRecorderSeats: Int!
		recorderSeatCount: Int!
		trialEndsAt: DateTime
		athleteCount: Int
	}

	extend type Mutation {
		syncCompanySubscription(
			companyId: ID!
			plan: SubscriptionPlan!
			revenueCatAppUserId: String!
			isActive: Boolean!
			isInTrial: Boolean
			expiresAt: DateTime
		): Company!
	}

	type Company {
		id: ID!
		name: String!
		subscription: CompanySubscription!
	}
`
