// Optional per-queue overrides. Name defaults to "otp-email" from the folder;
// here we pin it to "otp-emails" and tune throughput + retries.
export default {
  name: "otp-emails",
  concurrency: 20, // OTPs should clear fast
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 1500 },
    removeOnComplete: 1000,
    removeOnFail: 2000,
  },
};
