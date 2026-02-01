/**
 * Placeholder Server Lambda Handler
 *
 * This is a temporary handler that will be replaced during deployment
 * with the actual OpenNext server handler for deployed Next.js apps.
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
      message: "Anchor Deploy - Server Lambda (Placeholder)",
      info: "This Lambda will be replaced with OpenNext server handler during deployment",
      timestamp: new Date().toISOString(),
    }),
  };
};
