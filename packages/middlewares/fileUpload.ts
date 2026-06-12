import { RequestHandler } from 'express'
import fileUpload from 'express-fileupload'

export const useFileUpload = (size?: number): RequestHandler =>
	fileUpload({
		useTempFiles: true,
		limits: { fileSize: (size ?? 300) * 1024 * 1024 }
	})
