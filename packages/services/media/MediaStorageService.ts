import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { injectable, inject, singleton } from 'tsyringe'

import { env } from '@packages/utils/validateEnvs'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'

export interface PresignResult {
	uploadUrl: string
	publicUrl: string
	key: string
}

@injectable()
@singleton()
@ReportErrors()
export class MediaStorageService {
	private client: S3Client

	constructor(
		@inject(ReportingService) private reportingService: ReportingService
	) {
		this.client = new S3Client({
			region: 'auto',
			endpoint: `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
			credentials: {
				accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
				secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
			},
			// R2 does not support AWS SDK default checksum headers on presigned PUTs
			requestChecksumCalculation: 'WHEN_REQUIRED',
			responseChecksumValidation: 'WHEN_REQUIRED'
		})
	}

	public async createPresignedUpload({
		key,
		contentType,
		expiresIn = 300
	}: {
		key: string
		contentType: string
		expiresIn?: number
	}): Promise<PresignResult> {
		try {
			const command = new PutObjectCommand({
				Bucket: env.CLOUDFLARE_R2_BUCKET,
				Key: key,
				ContentType: contentType
			})
			const uploadUrl = await getSignedUrl(this.client, command, { expiresIn })
			const publicUrl = `${env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`
			return { uploadUrl, publicUrl, key }
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}

	public async deleteObject({ key }: { key: string }): Promise<void> {
		try {
			await this.client.send(new DeleteObjectCommand({
				Bucket: env.CLOUDFLARE_R2_BUCKET,
				Key: key
			}))
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			throw error
		}
	}
}
