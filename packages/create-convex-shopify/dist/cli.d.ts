#!/usr/bin/env node
type Options = {
    name?: string;
    directory?: string;
    templateRef: string;
    yes: boolean;
    install: boolean;
    setup: boolean;
    dryRun: boolean;
    help: boolean;
};
export declare function parseArgs(argv: Array<string>): Options;
export declare function slugify(value: string): string;
export declare function rewriteTemplatePackage(input: string, appName: string, resolvedRef: string): string;
export declare function main(argv?: string[]): Promise<void>;
export {};
