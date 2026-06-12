import { AsyncLocalStorage } from 'async_hooks'
import { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'

const requestIdStore = new AsyncLocalStorage<{ requestId: string }>()

export const getRequestId = (): string | undefined => {
	const store = requestIdStore.getStore()
	return store?.requestId
}

export const setRequestId = ({
	requestId,
	callback
}: {
	requestId: string
	callback: () => void | Promise<void>
}): void => {
	requestIdStore.run({ requestId }, callback)
}

export const generateRequestId = (): string => {
	return randomUUID()
}

export const requestTracingMiddleware = (
	req: Request,
	res: Response,
	next: NextFunction
): void => {
	const requestId = generateRequestId()

	// Add requestId to response headers
	res.setHeader('X-Request-ID', requestId)

	// Store requestId in async local storage
	requestIdStore.run({ requestId }, () => {
		// Add requestId to request object for easy access
		;(req as Request & { requestId: string }).requestId = requestId
		next()
	})
}

export const withRequestId = <T>({
	requestId,
	fn
}: {
	requestId: string
	fn: () => T | Promise<T>
}): T | Promise<T> => {
	return new Promise((resolve, reject) => {
		requestIdStore.run({ requestId }, async () => {
			try {
				const result = await fn()
				resolve(result)
			} catch (error) {
				reject(error)
			}
		})
	})
}
