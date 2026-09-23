export const startCronJobs = () => {
  // Hard-delete of completed cloud orders is disabled.
  // It silently dropped tickets that tills still needed to pull.
  console.log('[Cron] Order purge is disabled. Historical tickets stay in the cloud.');
};
