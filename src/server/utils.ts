import { promises as fs } from "fs";
import { resolve, relative, dirname, basename } from 'path';

import p from "pino";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { HttpRequest, HttpResponse } from "uWebSockets.js";
import { transformFile } from "@swc/core";
import klaw from "klaw";

import { Database } from "./database";
import options from "./options";
import * as resolvers from "./resolvers";

const log = p({ name: 'utils', level: options.logLevel, prettyPrint: process.env.NODE_ENV });

const SWC_COMPILER_OPTIONS = {
  "minify": true,
  "env": {
    "targets": [
      "last 2 versions",
      "not dead",
      "not IE 11"
    ],
    "coreJs": 3,
    "mode": "usage",
    "loose": true
  },
  "sourceMaps": true,
  "jsc": {
    "parser": {
      "syntax": "typescript",
      "tsx": true,
      "dynamicImport": true
    },
    "loose": true,
    "externalHelpers": true,
    "keepClassNames": true,
    "transform": {
      "react": {
        "runtime": "automatic",
        "refresh": true
      }
    }
  },
  "module": {
    "type": "es6"
  }
};
const OUTPUT_DIR = resolve(__dirname, "../../dist");
const SOURCE_DIR = resolve(__dirname, '../web');

// OPTIMIZE: File streaming support
export async function importDataset(path: string, database: Database) {
  const text = await fs.readFile(path, 'utf-8');
  const dataset = JSON.parse(text);

  const builder = Database.toCypher(dataset);

  await database.query(builder.query);
}


export async function loadSchema(path: string) {
  const typeDefs = await fs.readFile(path, 'utf-8');
  const schema = makeExecutableSchema({
    typeDefs, resolvers
  });

  return schema;
}

export class SSEServer {
  clients: { [key: string]: HttpResponse } = {};
  id: number;

  constructor() {
    this.id = (new Date()).getTime();
  }

  handler(res: HttpResponse, req: HttpRequest) {
    const remoteAddress = Buffer.from(res.getRemoteAddressAsText()).toString();

    /* You MUST register an abort handler to know if the upgrade was aborted by peer */
    res.onAborted(() => {
      /* We can simply signal that we were aborted */
      delete this.clients[remoteAddress];
    });

    res
      .writeStatus('200 OK')
      .writeHeader("Content-Type", "text/event-stream")
      .writeHeader('Cache-Control', 'no-cache')
      .writeHeader('Connection', 'keep-alive')
      .write(`event: server-identifier\ndata: ${this.id}\n\n`);

    this.clients[remoteAddress] = res;
  };

  broadcast(data: string, event: string = "", id: string = "") {
    for (const client of Object.values(this.clients)) {
      client.write(`id: ${id}\nevent: ${event}\ndata: ${data}\n\n`);
    }
  }
}

export async function devMode(app) {
  const sse = new SSEServer();
  const chokidar = await import('chokidar');
  let ready = false;

  const watcher = chokidar.watch(SOURCE_DIR);

  app.get(`/dev/events`, sse.handler.bind(sse));

  watcher.once('ready', () => ready = true);
  watcher.on('all', async (event, path, details) => {
    try {

      // If intialscan is completed
      if (ready) {

        await compileFile(path, details);
        // Notify the client that a file has changed so the client can reload
        sse.broadcast(path, 'file-change');

        // If we are in the process of the initial scan
      } else {
        await compileFile(path, details);
      }
    } catch (error) {
      log.error("%o", error);
    }
  });
}

export async function prodMode() {
  try {
    for await (const {path, stats} of klaw(SOURCE_DIR)) {
      await compileFile(path, stats);
    }
  } catch (error) {
    log.error("%o", error);
  }
}

async function compileFile(path: string, stats) {
  if (!stats.isFile()) return;

  const relativePath = relative(SOURCE_DIR, path);
  const originalDestPath = resolve(OUTPUT_DIR, relativePath);
  const destDir = dirname(originalDestPath);

  await fs.mkdir(destDir, { recursive: true });

  if (!path.endsWith('.tsx') && !path.endsWith('.ts')) {
    await fs.copyFile(path, originalDestPath);
    return;
  };

  const destPath = originalDestPath.substring(0, originalDestPath.lastIndexOf('.')) + '.js';
  const destMapPath = destPath + '.map';

  log.trace("Transforming file: \"%s\" -> \"%s\"", path, destPath);
  // FIXME: Match transformFile expected options type
  // @ts-ignore
  const { code, map } = await transformFile(path, SWC_COMPILER_OPTIONS);

  // Make sure directory exists
  await fs.mkdir(destDir, { recursive: true });

  // Write transformed code and map
  await fs.writeFile(destPath, code + `\n//# sourceMappingURL=${basename(destMapPath)}`);
  await fs.writeFile(destMapPath, map);
}