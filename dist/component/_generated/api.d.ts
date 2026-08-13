/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */
import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as install from "../install.js";
import type * as installations from "../installations.js";
import type * as lib_adminClient from "../lib/adminClient.js";
import type * as lib_credentialCrypto from "../lib/credentialCrypto.js";
import type * as lib_shopifyAuth from "../lib/shopifyAuth.js";
import type * as lib_tokenLifecycle from "../lib/tokenLifecycle.js";
import type * as partner from "../partner.js";
import type * as webhooks from "../webhooks.js";
import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
declare const fullApi: ApiFromModules<{
    admin: typeof admin;
    auth: typeof auth;
    install: typeof install;
    installations: typeof installations;
    "lib/adminClient": typeof lib_adminClient;
    "lib/credentialCrypto": typeof lib_credentialCrypto;
    "lib/shopifyAuth": typeof lib_shopifyAuth;
    "lib/tokenLifecycle": typeof lib_tokenLifecycle;
    partner: typeof partner;
    webhooks: typeof webhooks;
}>;
/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;
/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;
export declare const components: {};
export {};
//# sourceMappingURL=api.d.ts.map