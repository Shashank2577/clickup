import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export function createMinioClient(): S3Client {
  return new S3Client({
    endpoint: process.env['MINIO_ENDPOINT'] || 'http://localhost:9000',
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env['MINIO_ACCESS_KEY'] || 'minioadmin',
      secretAccessKey: process.env['MINIO_SECRET_KEY'] || 'minioadmin',
    },
    forcePathStyle: true,
  })
}

const BUCKET = process.env['MINIO_BUCKET'] || 'clickup-files'

export async function uploadToMinio(
  client: S3Client,
  key: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  }))
  return (process.env['MINIO_ENDPOINT'] || 'http://localhost:9000') + '/' + BUCKET + '/' + key
}

export async function deleteFromMinio(client: S3Client, key: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

export async function getPresignedUrl(
  client: S3Client,
  key: string,
  expiresIn = 3600,
): Promise<string> {
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn },
  )
}
