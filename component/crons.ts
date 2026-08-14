import { cronJobs, type FunctionReference } from 'convex/server'
import { internal } from './_generated/api.js'

const crons = cronJobs()
const pruneDeliveries = (internal.webhooks as unknown as { pruneDeliveries: FunctionReference<
  'mutation',
  'internal',
  Record<string, never>,
  null
> }).pruneDeliveries

crons.interval(
  'prune webhook deliveries',
  { hours: 1 },
  pruneDeliveries,
  {},
)

export default crons
