import {
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config.js";

export const s3 = new S3Client({
  region: "us-east-1",
  endpoint: `${config.minioUseSsl ? "https" : "http"}://${config.minioEndpoint}:${config.minioPort}`,
  credentials: {
    accessKeyId: config.minioAccessKey,
    secretAccessKey: config.minioSecretKey
  },
  forcePathStyle: true
});

let bucketReady = false;

export async function ensureBucket() {
  if (bucketReady) {
    return;
  }

  try {
    await s3.send(new HeadBucketCommand({ Bucket: config.minioBucket }));
  } catch {
    const { CreateBucketCommand } = await import("@aws-sdk/client-s3");
    await s3.send(new CreateBucketCommand({ Bucket: config.minioBucket }));
  }

  bucketReady = true;
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  await ensureBucket();
  await s3.send(
    new PutObjectCommand({
      Bucket: config.minioBucket,
      Key: key,
      Body: body,
      ContentType: contentType
    })
  );

  return {
    storageProvider: "minio",
    storageBucket: config.minioBucket,
    storageKey: key
  };
}

export async function getObjectBuffer(bucket: string, key: string) {
  const response = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key
    })
  );

  return Buffer.from(await response.Body!.transformToByteArray());
}

export async function getPresignedObjectUrl(bucket: string, key: string) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key
    }),
    { expiresIn: 900 }
  );
}
