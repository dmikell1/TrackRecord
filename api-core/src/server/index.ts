import http from 'http'

import { ApolloServer, GraphQLServerListener } from '@apollo/server'
import { expressMiddleware } from '@apollo/server/express4'
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled'
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import { makeExecutableSchema } from '@graphql-tools/schema'
import * as Sentry from '@sentry/node'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { applyMiddleware } from 'graphql-middleware'
import { useServer } from 'graphql-ws/lib/use/ws'
import pinoHttp from 'pino-http'
import { WebSocketServer } from 'ws'

import { isDevelopment } from '@packages/utils/isDevelopment'
import { env } from '@packages/utils/validateEnvs'

import {
	connectToPostgresDatabase,
	POSTGRES_URL
} from '@packages/database/createPostgresConnection'
import { typeDefs } from '@api-core/src/schema'
import { resolvers } from '@api-core/src/resolvers'
import { schemaPermissions } from '@api-core/src/schema/schemaPermissions/schemaPermissions'
import { getContext } from '@api-core/src/server/getContext'

import { apolloFormatErrors } from '@api-core/src/server/apolloFormatErrors'
import { useFileUpload } from '@packages/middlewares/fileUpload'
import { corsOptions } from '@packages/middlewares/corsConfig'
import { setUserIdFromToken } from '@packages/middlewares/setUserIdFromToken'
import { requestTracingMiddleware } from '@packages/utils/tracing'
import { errorHandler } from '@packages/middlewares/errorHandler'
import { revenueCatRouter } from '@api-core/src/controllers/billing/revenueCatWebhook'
import { clerkRouter } from '@api-core/src/controllers/clerk'
import healthRouter from '@api-core/src/controllers/health'
import { presignRouter } from '@api-core/src/controllers/media/presignUpload'
import { deleteObjectRouter } from '@api-core/src/controllers/media/deleteObject'

import { startCoachLifecycleEmailProcessor } from '@packages/services/email/startCoachLifecycleEmailProcessor'
import { createReportingService } from '@packages/services/logging/ReportingService'
import { pgSession } from '@packages/middlewares/pgSession'
import { Context } from '@packages/types'

const ReportingService = createReportingService()

export const app = express()
const port = env.PORT

const httpLogger = pinoHttp({
	autoLogging: {
		ignore: (req) => req.url === '/health'
	},
	...(isDevelopment
		? {
				transport: {
					target: 'pino-pretty',
					options: { colorize: true, translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' }
				}
			}
		: { level: env.LOG_LEVEL })
})

export const startApolloServer = async (): Promise<void> => {
	let schema = makeExecutableSchema({ typeDefs, resolvers })
	schema = applyMiddleware(schema, schemaPermissions)

	await connectToPostgresDatabase({ dbString: POSTGRES_URL })

	const httpServer = http.createServer(app)
	const wsServer = new WebSocketServer({
		server: httpServer,
		path: '/graphql'
	})

	const serverCleanup = useServer(
		{
			schema,
			context: getContext
		},
		wsServer
	)

	const apolloServer = new ApolloServer<Context>({
		schema,
		plugins: [
			ApolloServerPluginDrainHttpServer({ httpServer }),

			{
				async serverWillStart(): Promise<void | GraphQLServerListener> {
					return {
						async drainServer(): Promise<void> {
							await serverCleanup.dispose()
						}
					}
				}
			},
			...(!isDevelopment ? [] : [ApolloServerPluginLandingPageDisabled()])
		],
		...(isDevelopment
			? {
					formatError: apolloFormatErrors,
					includeStacktraceInErrorResponses: true
				}
			: {
					formatError: apolloFormatErrors,
					includeStacktraceInErrorResponses: false
				})
	})

	await apolloServer.start()

	const sessionMiddleware = pgSession()
	const fileUpload = await useFileUpload(600)

	// pino-http request logger
	app.use(httpLogger)
	app.use(express.json())
	app.use(cookieParser())
	app.use(cors(corsOptions))
	app.use(requestTracingMiddleware)
	app.use(sessionMiddleware)
	app.use(fileUpload)
	app.use((req, res, next) => {
		void setUserIdFromToken(
			req as Parameters<typeof setUserIdFromToken>[0],
			res,
			next
		).catch(next)
	})

	app.use('/clerk', clerkRouter)
	app.use('/billing/revenuecat', revenueCatRouter)
	app.use('/', healthRouter)
	app.use('/media/presign', presignRouter)
	app.use('/media', deleteObjectRouter)

	const graphqlMiddleware = expressMiddleware(apolloServer, {
		context: async ({ req, res }): Promise<Context> => {
			const context = getContext()
			return {
				...context,
				req: req as unknown as Context['req'],
				res: res as unknown as Context['res']
			}
		}
	})

	app.use('/graphql', graphqlMiddleware as express.RequestHandler)

	// Sentry error handler must come before the custom error handler
	app.use(Sentry.expressErrorHandler())

	// Custom error handler
	app.use(errorHandler)

	process.on('unhandledRejection', (reason, promise) => {
		ReportingService.log({
			message: 'Unhandled Rejection',
			promise: String(promise),
			reason: String(reason)
		})
	})

	httpServer.listen({ port }, () =>
		ReportingService.log({ message: `app listening on port ${port}` })
	)

	startCoachLifecycleEmailProcessor()
}
