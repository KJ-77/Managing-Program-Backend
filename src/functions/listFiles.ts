import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { listObjects, getSignedDownloadUrl } from "../lib/s3";

/**
 * Lists files and folders from the S3 bucket with optional path prefix
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Get prefix from query parameters
    const prefix = event.queryStringParameters?.prefix || "";
    const generateUrls = event.queryStringParameters?.generateUrls === "true";

    // Get files and folders from S3
    const result = await listObjects(prefix);

    // Generate signed URLs for files if requested
    if (generateUrls) {
      for (const file of result.files) {
        file.signedUrl = await getSignedDownloadUrl(file.key);
      }
    }

    // Format path segments for frontend navigation
    const pathSegments = prefix ? prefix.split("/").filter(Boolean) : [];

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", // Update with specific domain in production
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        files: result.files,
        folders: result.folders,
        pathSegments,
        currentPath: prefix,
      }),
    };
  } catch (error) {
    console.error("Error listing files:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", // Update with specific domain in production
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        message: "Error listing files",
        error: String(error),
      }),
    };
  }
};
