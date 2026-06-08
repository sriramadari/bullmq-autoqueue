export default async function (job) {
  const { to, code } = job.data;
  // ...send the OTP email
  return { to, sent: true, code };
}
