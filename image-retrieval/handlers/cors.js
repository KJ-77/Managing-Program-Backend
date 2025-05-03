/**
 * Handler for OPTIONS requests (CORS preflight)
 */
exports.handler = async (event) => {
  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,Accept,Cache-Control,Pragma,Origin,X-Requested-With",
      "Access-Control-Allow-Methods": "GET,PUT,POST,DELETE,OPTIONS,PATCH",
      "Access-Control-Allow-Credentials": true,
      "Access-Control-Max-Age": "1728000",
    },
    body: JSON.stringify({ message: "CORS enabled" }),
  };
};
