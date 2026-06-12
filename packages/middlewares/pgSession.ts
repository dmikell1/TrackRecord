import connectPgSimple from 'connect-pg-simple'
import { RequestHandler } from 'express'
import session from 'express-session'

import { env } from '@packages/utils/validateEnvs'

const PgSessionStore = connectPgSimple(session)

export const pgSession = (): RequestHandler => {
	return session({
		name: 'qid',
		secret: env.SESSION_SECRET,
		store: new PgSessionStore({
			conString: env.DATABASE_URL,
			createTableIfMissing: true,
			tableName: 'session'
		}),
		resave: false,
		saveUninitialized: false,
		cookie: {
			httpOnly: true,
			maxAge: 1000 * 60 * 60 * 24 * 14,
			secure: false
		}
	})
}
