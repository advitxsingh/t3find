export default {
  providers: [
    {
      domain: (process as any).env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
