import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { deleteObject } from "../lib/s3";
import { invalidateCache } from "../lib/cloudfront";

/**
 * Delete a file from the S3 bucket and invalidate CloudFront cache
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Extract the file key from path parameters
    const key = event.pathParameters?.key;

    if (!key) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({ message: "File key is required" }),
      };
    }

    // Delete the object from S3
    await deleteObject(key);

    // Invalidate CloudFront cache for this object
    try {
      await invalidateCache([`/${key}`]);
    } catch (invalidationError) {
      // Log CloudFront invalidation error but don't fail the request
      console.warn("CloudFront invalidation failed:", invalidationError);
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        message: "File deleted successfully",
        key,
      }),
    };
  } catch (error) {
    console.error("Error deleting file:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        message: "Error deleting file",
        error: String(error),
      }),
    };
  }
};
