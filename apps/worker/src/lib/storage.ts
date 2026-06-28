import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "../config.js";

const s3 = new S3Client({
  region: "us-east-1",
  endpoint: `${config.minioUseSsl ? "https" : "http"}://${config.minioEndpoint}:${config.minioPort}`,
  credentials: {
    accessKeyId: config.minioAccessKey,
    secretAccessKey: config.minioSecretKey
  },
  forcePathStyle: true
});

export const storage = {
  async readObject(object: { bucket: string; key: string }) {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: object.bucket,
        Key: object.key
      })
    );

    return Buffer.from(await response.Body!.transformToByteArray());
  }
};
