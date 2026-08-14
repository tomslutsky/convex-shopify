import { cronJobs } from 'convex/server';
import { internal } from './_generated/api.js';
const crons = cronJobs();
const pruneDeliveries = internal.webhooks.pruneDeliveries;
crons.interval('prune webhook deliveries', { hours: 1 }, pruneDeliveries, {});
export default crons;
//# sourceMappingURL=crons.js.map