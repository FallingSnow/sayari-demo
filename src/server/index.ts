import { resolve } from 'path';

import p from 'pino';

import options from './options';
import { Database } from './database';
import { HttpServer } from './http';
import { devMode, importDataset, loadSchema, prodMode } from './utils';

const log = p({ name: 'main', level: options.logLevel, prettyPrint: process.env.NODE_ENV });
const DATASET_PATH = resolve(__dirname, './assets/stackoverfaux.json');
const SCHEMA_PATH = resolve(__dirname, './schema.gql');

async function main() {

  log.info(`
███████╗ █████╗ ██╗   ██╗ █████╗ ██████╗ ██╗
██╔════╝██╔══██╗╚██╗ ██╔╝██╔══██╗██╔══██╗██║
███████╗███████║ ╚████╔╝ ███████║██████╔╝██║
╚════██║██╔══██║  ╚██╔╝  ██╔══██║██╔══██╗██║
███████║██║  ██║   ██║   ██║  ██║██║  ██║██║
╚══════╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝`);

  log.debug("Initializing database");
  const database = new Database();
  await database.connect();
  if (await database.size() === 0) {
    log.debug("Importing default dataset");
    await importDataset(DATASET_PATH, database);
  }

  log.debug("Initializing graphql schema");
  const schema = await loadSchema(SCHEMA_PATH);

  log.debug("Initializing http server");
  const http = new HttpServer({ schema, database });

  if (process.env.NODE_ENV === 'development') {
    log.info("Started in development mode!");
    await devMode(http.app);
  } else {
    await prodMode();
  }

  // http.app.listen(options.httpPort, token => {
  //   console.log(token);
  // })
  await http.listen(options.httpPort);

  log.info(`Listening on port %d`, options.httpPort);


}

main().then(() => log.info("Initialization completed"), log.fatal.bind(log));
