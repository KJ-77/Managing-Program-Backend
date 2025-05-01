import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getSignedUploadUrl } from "../lib/s3";
import { invalidateCache } from "../lib/cloudfront";

/**
 * Generate a pre-signed URL for uploading files to S3
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Parse request body
    const body = event.body ? JSON.parse(event.body) : {};
    const { key, contentType } = body;

    if (!key || !contentType) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          message: "File key and contentType are required",
        }),
      };
    }

    // Generate the signed upload URL
    const uploadUrl = await getSignedUploadUrl(key, contentType);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        uploadUrl,
        key,
        // Instructions for frontend to complete the upload
        uploadMethod: "PUT",
        headers: {
          "Content-Type": contentType,
        },
      }),
    };
  } catch (error) {
    console.error("Error generating upload URL:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        message: "Error generating upload URL",
        error: String(error),
      }),
    };
  }
};
