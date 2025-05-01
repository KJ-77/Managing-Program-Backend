import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getSignedDownloadUrl } from "../lib/s3";
import { getCloudFrontUrl } from "../lib/cloudfront";

/**
 * Generate a signed URL for accessing a file, either directly from S3 or via CloudFront
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Extract the file key from path parameters
    const key = event.pathParameters?.key;
    // Determine whether to use CloudFront or direct S3 URLs
    const useCdn = event.queryStringParameters?.cdn === "true";

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

    let fileUrl;

    if (useCdn) {
      // Use CloudFront URL (for production)
      fileUrl = getCloudFrontUrl(key);
    } else {
      // Use direct S3 signed URL (for development or when CDN is not set up)
      fileUrl = await getSignedDownloadUrl(key);
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        url: fileUrl,
        key,
      }),
    };
  } catch (error) {
    console.error("Error generating file URL:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        message: "Error generating file URL",
        error: String(error),
      }),
    };
  }
};
