import { Athlete } from '@api-core/src/resolvers/types/Athlete'
import { DateTime } from '@api-core/src/resolvers/scalars/DateTime'
import { Mutation } from '@api-core/src/resolvers/Mutation'
import { Query } from '@api-core/src/resolvers/Query'
import { Subscription } from '@api-core/src/resolvers/Subscription'
import { Team } from '@api-core/src/resolvers/types/Team'
import { TrainingSession } from '@api-core/src/resolvers/types/TrainingSession'
import { Video } from '@api-core/src/resolvers/types/Video'

export const resolvers = {
	Query,
	Mutation,
	Subscription,
	DateTime,
	Athlete,
	Team,
	TrainingSession,
	Video
}
