import { defineApp } from 'convex/server'
import shopify from '@convex-dev/shopify/convex.config.js'

const app = defineApp()
app.use(shopify, { name: 'commerce' })

export default app
