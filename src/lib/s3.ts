import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
});
const bucketName = process.env.S3_BUCKET_NAME || "";
const urlExpirationSeconds = parseInt(
  process.env.URL_EXPIRATION_TIME || "3600",
  10
);

// Interface for file/folder structure
export interface S3Object {
  key: string;
  isFolder: boolean;
  lastModified?: Date;
  size?: number;
  signedUrl?: string;
}

/**
 * Lists files and folders in a specific path
 * @param prefix - The folder path (e.g., "documents/2023/")
 * @param delimiter - The delimiter for folder structure (usually "/")
 */
export async function listObjects(
  prefix: string = "",
  delimiter: string = "/"
): Promise<{
  files: S3Object[];
  folders: S3Object[];
  commonPrefixes: string[];
}> {
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: prefix,
    Delimiter: delimiter,
  });

  try {
    const response = await s3Client.send(command);

    // Extract files
    const files: S3Object[] = (response.Contents || [])
      .filter(
        (item) =>
          item.Key && !item.Key.endsWith(delimiter) && item.Key !== prefix
      )
      .map((item) => ({
        key: item.Key!,
        isFolder: false,
        lastModified: item.LastModified,
        size: item.Size,
      }));

    // Extract folders (from CommonPrefixes)
    const folders: S3Object[] = (response.CommonPrefixes || [])
      .filter((prefix) => prefix.Prefix)
      .map((prefix) => ({
        key: prefix.Prefix!,
        isFolder: true,
      }));

    // Return the folder structure
    return {
      files,
      folders,
      commonPrefixes: (response.CommonPrefixes || []).map(
        (p) => p.Prefix || ""
      ),
    };
  } catch (error) {
    console.error("Error listing objects from S3:", error);
    throw error;
  }
}

/**
 * Generate a pre-signed URL for downloading a file
 * @param key - The S3 object key
 */
export async function getSignedDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  try {
    return await getSignedUrl(s3Client, command, {
      expiresIn: urlExpirationSeconds,
    });
  } catch (error) {
    console.error(`Error generating signed URL for ${key}:`, error);
    throw error;
  }
}

/**
 * Generate a pre-signed URL for uploading a file
 * @param key - The S3 object key to upload to
 * @param contentType - The MIME type of the file
 */
export async function getSignedUploadUrl(
  key: string,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });

  try {
    return await getSignedUrl(s3Client, command, {
      expiresIn: urlExpirationSeconds,
    });
  } catch (error) {
    console.error(`Error generating upload URL for ${key}:`, error);
    throw error;
  }
}

/**
 * Delete an object from S3
 * @param key - The S3 object key to delete
 */
export async function deleteObject(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  try {
    await s3Client.send(command);
  } catch (error) {
    console.error(`Error deleting object ${key}:`, error);
    throw error;
  }
}
