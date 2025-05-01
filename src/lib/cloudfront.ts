import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from "@aws-sdk/client-cloudfront";

// Initialize CloudFront client
const cloudfrontClient = new CloudFrontClient({
  region: process.env.AWS_REGION || "us-east-1",
});
const distributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID || "";

/**
 * Create CloudFront invalidation to clear cache for specific objects
 * @param paths - Array of paths to invalidate
 */
export async function invalidateCache(paths: string[]): Promise<string> {
  if (!distributionId) {
    throw new Error(
      "CloudFront Distribution ID not defined in environment variables"
    );
  }

  // Ensure paths begin with '/'
  const formattedPaths = paths.map((path) =>
    path.startsWith("/") ? path : `/${path}`
  );

  try {
    const command = new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: {
        CallerReference: `invalidation-${Date.now()}`,
        Paths: {
          Quantity: formattedPaths.length,
          Items: formattedPaths,
        },
      },
    });

    const response = await cloudfrontClient.send(command);
    return response.Invalidation?.Id || "";
  } catch (error) {
    console.error("Error invalidating CloudFront cache:", error);
    throw error;
  }
}

/**
 * Generate CloudFront URL from S3 key
 * @param key - S3 object key
 */
export function getCloudFrontUrl(key: string): string {
  // Get CloudFront domain from environment variable or use placeholder
  const cloudfrontDomain =
    process.env.CLOUDFRONT_DOMAIN || "your-distribution.cloudfront.net";

  // Clean the key to ensure it doesn't start with a '/'
  const cleanKey = key.startsWith("/") ? key.substring(1) : key;

  // Construct and return the CloudFront URL
  return `https://${cloudfrontDomain}/${cleanKey}`;
}
