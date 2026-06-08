// The only file you write per queue: the job logic.
// Default-export an async (job) => result function.
export default async function (job) {
  const { postId, followers = [] } = job.data;
  // ...business logic — e.g. fan out push notifications in batches
  return { postId, notified: followers.length };
}
