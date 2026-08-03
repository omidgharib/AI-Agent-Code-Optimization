// FILE: src/core/logger.ts
import chalk from "chalk";

let verbose = false;

export function setVerbose(v: boolean) {
  verbose = v;
}

export const logger = {
  info: (msg: string) => console.log(chalk.blue("[info]"), msg),
  warn: (msg: string) => console.warn(chalk.yellow("[warn]"), msg),
  error: (msg: string) => console.error(chalk.red("[error]"), msg),
  success: (msg: string) => console.log(chalk.green("[ok]"), msg),
  debug: (msg: string) => {
    if (verbose) console.log(chalk.gray("[debug]"), msg);
  },
};
