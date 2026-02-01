/**
 * Placeholder Image Optimization Lambda Handler
 *
 * This is a temporary handler that will be replaced during deployment
 * with the actual OpenNext image handler for Next.js image optimization.
 *
 * For now, it returns a simple response indicating the infrastructure is ready.
 */

import type { Handler } from "aws-lambda";

export const handler: Handler = async (event) => {
  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      message: "Anchor Deploy - Image Lambda (Placeholder)",
      info: "This Lambda will be replaced with OpenNext image handler during deployment",
      timestamp: new Date().toISOString(),
    }),
  };
};
