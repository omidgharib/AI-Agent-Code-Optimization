// FILE: src/core/logger.ts
import chalk from "chalk";

let verbose = false;
let debug = false;

export function setVerbose(v: boolean) {
  verbose = v;
}

export function setDebug(v: boolean) {
  debug = v;
}

export function isDebug(): boolean {
  return debug;
}

export const logger = {
  info: (msg: string) => console.log(chalk.blue("[info]"), msg),
  warn: (msg: string) => console.warn(chalk.yellow("[warn]"), msg),
  error: (msg: string) => console.error(chalk.red("[error]"), msg),
  success: (msg: string) => console.log(chalk.green("[ok]"), msg),
  debug: (msg: string) => {
    // --verbose and --debug both enable fine-grained detail.
    if (verbose || debug) console.log(chalk.gray("[debug]"), msg);
  },
  trace: (msg: string) => {
    // Deep diagnostics (full error cause chains etc.), only with --debug.
    if (debug) console.log(chalk.dim.gray("[trace]"), msg);
  },
};