const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const bucketName = process.env.S3_BUCKET_NAME;
const cloudfrontDomain = process.env.CLOUDFRONT_DISTRIBUTION_DOMAIN;

/**
 * Process S3 objects into a structured response
 * @param {Array} s3Objects - Array of S3 objects
 * @param {string} prefix - Current path prefix
 * @param {boolean} generateUrls - Whether to generate signed URLs
 * @returns {Object} Structured response with files, folders and path info
 */
const processS3Response = async (s3Objects, prefix, generateUrls = false) => {
  // Normalize the prefix to always end with a slash if not empty
  const normalizedPrefix = prefix
    ? prefix.endsWith("/")
      ? prefix
      : `${prefix}/`
    : "";

  // Track processed folders to avoid duplicates
  const processedFolders = new Set();

  // Prepare result structure
  const result = {
    files: [],
    folders: [],
    pathSegments: [],
    currentPath: normalizedPrefix,
  };

  // Process path segments for breadcrumb navigation
  if (normalizedPrefix) {
    const segments = normalizedPrefix.split("/").filter(Boolean);
    result.pathSegments = segments.map((segment, index) => {
      const path = segments.slice(0, index + 1).join("/");
      return { name: segment, path: path };
    });
  }

  // Process objects from S3 into files and folders
  for (const item of s3Objects) {
    // Remove the current prefix from the key to get the relative path
    const key = item.Key;
    const relativePath = key.startsWith(normalizedPrefix)
      ? key.slice(normalizedPrefix.length)
      : key;

    // Skip the folder itself (which often appears as an object)
    if (relativePath === "") continue;

    // Check if this is a file or a subfolder
    if (relativePath.includes("/")) {
      // This is a subfolder or a file in a subfolder
      const folderName = relativePath.split("/")[0];
      const folderPath = normalizedPrefix + folderName + "/";

      // Only add each folder once
      if (!processedFolders.has(folderPath)) {
        processedFolders.add(folderPath);
        result.folders.push({
          key: folderPath,
          name: folderName,
          isFolder: true,
          type: "folder",
        });
      }
    } else {
      // This is a file in the current directory
      let fileObject = {
        key,
        name: relativePath,
        isFolder: false,
        lastModified: item.LastModified,
        size: item.Size,
        type: getContentType(relativePath),
      };

      // Generate signed URL if requested
      if (generateUrls) {
        fileObject.signedUrl = await getSignedUrl(key);
      }

      result.files.push(fileObject);
    }
  }

  return result;
};

/**
 * Get content type based on file extension
 * @param {string} filename - Name of the file
 * @returns {string} Content type
 */
const getContentType = (filename) => {
  const extension = filename.split(".").pop().toLowerCase();
  const contentTypes = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    txt: "text/plain",
    // Add more as needed
  };

  return contentTypes[extension] || "application/octet-stream";
};

/**
 * Generate a signed URL for a file
 * @param {string} key - S3 object key
 * @param {boolean} useCdn - Whether to use CloudFront
 * @returns {string} Signed URL
 */
const getSignedUrl = async (key, useCdn = false) => {
  if (useCdn && cloudfrontDomain) {
    // Use CloudFront URL with signed cookies for authenticated access
    const cloudFront = new AWS.CloudFront.Signer(
      process.env.CLOUDFRONT_KEY_PAIR_ID,
      process.env.CLOUDFRONT_PRIVATE_KEY
    );

    const url = `https://${cloudfrontDomain}/${encodeURIComponent(key)}`;
    const expireTime = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour

    return cloudFront.getSignedUrl({
      url,
      expires: expireTime,
    });
  } else {
    // Use S3 pre-signed URL
    const params = {
      Bucket: bucketName,
      Key: key,
      Expires: 3600, // URL expires in 1 hour
    };

    return await s3.getSignedUrlPromise("getObject", params);
  }
};

/**
 * List files and folders from S3
 */
exports.listFiles = async (event) => {
  try {
    const queryParams = event.queryStringParameters || {};
    const prefix = queryParams.prefix || "";
    const generateUrls = queryParams.generateUrls === "true";

    // List objects from S3
    const params = {
      Bucket: bucketName,
      Prefix: prefix,
      Delimiter: "/",
    };

    const s3Response = await s3.listObjectsV2(params).promise();
    const allObjects = [
      ...(s3Response.Contents || []),
      ...(s3Response.CommonPrefixes || []),
    ];

    // Process the response
    const result = await processS3Response(allObjects, prefix, generateUrls);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error("Error listing files:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({ error: "Failed to list files" }),
    };
  }
};

/**
 * Get a signed URL for a file
 */
exports.getFileUrl = async (event) => {
  try {
    const key = decodeURIComponent(event.pathParameters.key);
    const queryParams = event.queryStringParameters || {};
    const useCdn = queryParams.cdn === "true";

    // Generate a signed URL
    const url = await getSignedUrl(key, useCdn);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({ url }),
    };
  } catch (error) {
    console.error("Error getting file URL:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({ error: "Failed to generate file URL" }),
    };
  }
};

/**
 * Generate a pre-signed URL for uploading a file
 */
exports.getUploadUrl = async (event) => {
  try {
    const { key, contentType } = JSON.parse(event.body);

    // Generate a pre-signed URL for uploading
    const params = {
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
      Expires: 3600, // URL expires in 1 hour
    };

    const uploadUrl = await s3.getSignedUrlPromise("putObject", params);

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
      body: JSON.stringify({ error: "Failed to generate upload URL" }),
    };
  }
};

/**
 * Delete a file from S3
 */
exports.deleteFile = async (event) => {
  try {
    const key = decodeURIComponent(event.pathParameters.key);

    // Delete the object from S3
    await s3
      .deleteObject({
        Bucket: bucketName,
        Key: key,
      })
      .promise();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({ message: "File deleted successfully" }),
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
      body: JSON.stringify({ error: "Failed to delete file" }),
    };
  }
};
