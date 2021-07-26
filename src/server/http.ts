import { resolve, extname } from 'path';
import { promises as fs } from 'fs';
import mime from 'mime';

import p from 'pino';
import { App, HttpResponse, HttpRequest } from 'uWebSockets.js';
import { GraphQLSchema, parse, validate } from "graphql";
import { compileQuery, isCompiledQuery } from "graphql-jit";

import options from './options';
import { Database } from './database';

const log = p({ name: 'http', level: options.logLevel, prettyPrint: process.env.NODE_ENV });

const DIST_PATH = resolve(__dirname, '../../dist');


export class HttpServer {
  app = App();
  schema: GraphQLSchema;
  database: Database;

  constructor({ schema, database }) {
    this.schema = schema;
    this.database = database;

    this.app.post('/api', this.errorHandler(this.apiHandler.bind(this)));
    this.app.get('/', this.errorHandler(fileHandler));
    this.app.get('/*', this.errorHandler(fileHandler));
  }

  listen(port) {
    return new Promise((res, rej) => {
      this.app.listen(port, token => {
        if (token) return res(token);
        else return rej();
      })
    })
  }


  async apiHandler(res, req) {

    // Abort handlers are required with uWS when you use async
    let aborted = false;
    res.onAborted(() => aborted = true);


    const { method, url, query, headers, body, json } = await httpParser(res, req);
    log.trace(`${method} ${url} ${query}`);

    // Attempt to convert request body into json
    let data, errors = [];
    if (headers['content-type'] === 'application/json') {

      // Handle body/json errors like invalid json
      try {
        data = await json();
      } catch (error) {
        errors.push(error);
      }


    } else {
      errors.push({
        message: "http header \"content-type\"'s value must be \"application/json\""
      });
    }

    // Return our errors back to the client that made the request
    if (errors.length) {
      if (aborted) return;
      return res.writeStatus('400 BAD REQUEST').end(JSON.stringify({ errors }));
    }

    // Process the query and variables
    const results = await this.graphqlHandler(data);

    if (aborted) return;
    res.end(JSON.stringify(results));
  }


  // This function handles generic errors not caught inside request handlers
  errorHandler(inner: Function) {


    return (res, req) => {
      let aborted = false;
      res.onAborted(() => aborted = true);

      log.debug(`New request: [${req.getMethod().toUpperCase()}] ${req.getUrl()}`);

      // Run the request handler, catch any errors and return a 500 response code
      inner(res, req).catch(e => {
        log.error(e);

        if (aborted) return;
        return res.writeStatus('500 INTERNAL SERVER ERROR').end("An unexpected error occured. Please see server logs for more details.");
      })
    }
  }


  /**
   * Handles parsing, validation, compiling, and execution of graphql query
   * @param param0 
   * @returns 
   */
  async graphqlHandler({ query, variables }) {
    log.trace('Executing graphql query:\n%s', query);
    let parsedQuery;
    try {
      parsedQuery = parse(query);
    } catch (error) {
      return { errors: [error] };
    }

    // Validate the query, make sure it can be used with our schema
    // Eg. check to see if it accesses non existing types
    const validationErrors = validate(this.schema, parsedQuery);
    if (validationErrors.length > 0) {
      return { errors: validationErrors };
    }

    // OPTIMIZE: lru cache
    const compiledQuery = compileQuery(this.schema, parsedQuery);

    // check if the compilation is successful
    if (!isCompiledQuery(compiledQuery)) {
      return { errors: [new Error("Error compiling query")] };
    }

    try {
      const executionResult = await compiledQuery.query(undefined, { database: this.database }, variables);
      return executionResult;
    } catch (error) {
      return { errors: [error] };
    }
  }
}

/**
 * Static file handler, redirects to index.html if the file was not found and does not have an extention
 * @param res
 * @param req
 */
async function fileHandler(res: HttpResponse, req: HttpRequest) {
  // We can't cancel a promise in JS yet. And uWS requires us to set a cancel handler on async functions
  /* Keep track of abortions */
  let aborted = false;

  /* You MUST register an abort handler to know if the upgrade was aborted by peer */
  res.onAborted(() => {
    /* We can simply signal that we were aborted */
    aborted = true;
  });

  let { method, url, query, headers, body } = await httpParser(res, req);

  const relativeFilePath = url.replace(/^\/|\/$/g, '') || 'index.html';
  let filePath = resolve(DIST_PATH, relativeFilePath);

  try {

    await fs.access(filePath);

  } catch (error) {

    // If file with an extension was not found, return 404
    if (extname(url)) {
      if (aborted) return;
      res.writeStatus('404 NOT FOUND').end();
      return;
    }

    log.debug(`Unable to read file: %o`, error);
    filePath = resolve(DIST_PATH, 'index.html');

  }

  if (aborted) return;

  const contentType = mime.getType(extname(filePath));

  const contents = await fs.readFile(filePath);

  if (aborted) return;

  // if (!lastModified) {
  //   lastModified = stats.mtime.toUTCString();
  //   res.writeHeader('Last-Modified', lastModified);
  // }
  if (process.env.NODE_ENV !== 'development')
    res.writeHeader('Cache-Control', 'public, max-age=86400');

  res
    .writeStatus('200 OK')
    .writeHeader('Content-Type', contentType)
    .end(contents);
};

/**
 * Extract information out of a http request.
 * Extracts method, url, query, headers, body/json
 * @param res
 * @param req
 * @returns 
 */
function httpParser(res: HttpResponse, req: HttpRequest) {
  const method = req.getMethod();
  const url = req.getUrl();
  const query = req.getQuery();
  const headers = {};

  req.forEach((key, value) => headers[key] = value);

  // Collect body stream into a single string
  const body = () => new Promise((resolve, rej) => {
    const chunks = [];
    res.onData((chunk, last) => {

      // For some reason beyond my knowledge, arraybuffers can become detached and unsuable. When that happens their byteLength is set to 0
      if (chunk.byteLength > 0)
        chunks.push(chunk);

      // Each chunk is an arraybuffer. These need to be converted to Buffers and merged into one big buffer
      if (last) {
        const buffers = chunks.map(a => Buffer.from(a));
        const buffer = Buffer.concat(buffers);
        return resolve(buffer)
      }
    })
  });

  const json = async () => {
    return JSON.parse((await body()).toString());
  };

  return { method, url, query, headers, body, json };
}