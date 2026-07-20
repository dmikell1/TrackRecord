import { me } from '@api-core/src/resolvers/queries/user/me'
import { trainingSessions } from '@api-core/src/resolvers/queries/trainingSession/trainingSessions'
import { trainingSession } from '@api-core/src/resolvers/queries/trainingSession/trainingSession'
import { athletes } from '@api-core/src/resolvers/queries/athlete/athletes'
import { athlete } from '@api-core/src/resolvers/queries/athlete/athlete'
import { athleteInviteLink } from '@api-core/src/resolvers/queries/athlete/athleteInviteLink'
import { athleteProgression } from '@api-core/src/resolvers/queries/athlete/athleteProgression'
import { parentalConsentInfo } from '@api-core/src/resolvers/queries/athlete/parentalConsentInfo'
import { videos } from '@api-core/src/resolvers/queries/video/videos'
import { video } from '@api-core/src/resolvers/queries/video/video'
import { notifications } from '@api-core/src/resolvers/queries/notification/notifications'
import { athleteInvite } from '@api-core/src/resolvers/queries/athleteInvite/athleteInvite'
import { joinInfo } from '@api-core/src/resolvers/queries/join/joinInfo'
import { teamRecorders } from '@api-core/src/resolvers/queries/recorder/teamRecorders'

const Query = {
	me,
	trainingSessions,
	trainingSession,
	athletes,
	athlete,
	athleteInviteLink,
	athleteProgression,
	parentalConsentInfo,
	videos,
	video,
	notifications,
	athleteInvite,
	joinInfo,
	teamRecorders
}

export { Query }
