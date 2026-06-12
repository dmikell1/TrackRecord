import { Company } from '@api-core/src/schema/schemaTypes/company'
import { root } from '@api-core/src/schema/schemaTypes/root'
import { Team } from '@api-core/src/schema/schemaTypes/team'
import { TrackRecord } from '@api-core/src/schema/schemaTypes/trackRecord'
import { User } from '@api-core/src/schema/schemaTypes/user'

export const typeDefs = [root, User, Company, Team, TrackRecord]
