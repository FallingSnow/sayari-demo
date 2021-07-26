import yargs from "yargs";

export default yargs(process.argv)
  .env('SAYARI')
  .options({
    'databaseHost': {
      type: 'string',
      default: 'localhost'
    },
    'databasePort': {
      type: 'number',
      default: 6379
    },
    'databaseName': {
      type: 'string',
      default: 'sayari'
    },
    'httpPort': {
      type: 'number',
      default: process.env.NODE_ENV === 'development' ? 8080 : 80,
    },
    'logLevel': {
      alias: 'l',
      type: 'string',
      options: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
      default: 'info'
    }
  })
  .version(require('../../package.json').version)
  .parseSync();