import {createRequire} from 'node:module';
import path from 'node:path';
import os from 'node:os';
const require=createRequire(import.meta.url);
let playwright;
try{playwright=require('playwright');}catch{playwright=require(process.env.BASKET_PLAYWRIGHT||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
export const chromium=playwright.chromium;
export const browserOptions={channel:process.env.BASKET_BROWSER_CHANNEL||'msedge',headless:true};
