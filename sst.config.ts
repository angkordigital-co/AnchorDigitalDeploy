/// <reference path="./.sst/platform/config.d.ts" />

/**
 * SST Ion v3 Configuration for Anchor Deploy
 *
 * Serverless deployment platform for Next.js applications.
 * Deployed to AWS Singapore region (ap-southeast-1) for lowest latency to Cambodia.
 */
export default $config({
  app(input) {
    return {
      name: "anchor-deploy",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage ?? ""),
      home: "aws",
      providers: {
        aws: {
          region: "ap-southeast-1",
        },
      },
    };
  },
  async run() {
    // Import infrastructure modules
    // Order matters: database and storage first, then build-pipeline, then webhooks
    // (webhooks imports buildQueue from build-pipeline)
    const { projectsTable, deploymentsTable } = await import("./infra/database.js");
    const { artifactsBucket, logsBucket } = await import("./infra/storage.js");
    const { buildQueue, codeBuildProject, buildOrchestrator } = await import("./infra/build-pipeline.js");
    const { webhookApi, webhookSecret } = await import("./infra/webhooks.js");

    return {
      region: "ap-southeast-1",
      projectsTable: projectsTable.name,
      deploymentsTable: deploymentsTable.name,
      artifactsBucket: artifactsBucket.name,
      logsBucket: logsBucket.name,
      webhookUrl: webhookApi.url,
      buildQueueUrl: buildQueue.url,
      codeBuildProject: codeBuildProject.name,
    };
  },
});
