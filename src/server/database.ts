import p from 'pino';
import { RedisGraph } from 'redis-modules-sdk';

import options from './options';

const log = p({ name: 'database', level: options.logLevel, prettyPrint: process.env.NODE_ENV });

class QueryBuilder {
  id = 0;
  query = "";
  nextId() {
    return this.id++;
  }
  addQuery(query) {
    this.query += query;
  }
}

export class Database extends RedisGraph {


  constructor() {
    super({
      host: options.databaseHost,
      port: options.databasePort
    });
  }

  async size() {
    const {results} = await this.query("MATCH (n) RETURN count(n)");
    return parseInt(results[0][0]);
  }

  // @ts-ignore
  async query(query) {
    try {

      const [keys, results, stats] = await super.query(options.databaseName, query);
      if (stats)
        log.trace("QUERY: \"%s\" [%s]", query, stats[1]);
        return { keys, results, stats };

    } catch (error) {
      log.error("Unable to run query: \"%s\"\n%s", query, error);
      throw new Error("Database error occurred. See server logs.");

    }
  }


  static toCypher(o, parent = 0, relation?, builder = new QueryBuilder()) {
    const currentId = builder.nextId();

    // Filter and remove all values that are objects
    const objects = Object.entries(o)
      .reduce((acc, [key, val]) => {

        // If objet, remove
        if (typeof val === 'object') {
          acc[key] = val;
          delete o[key];
        }

        return acc;
      }, {});

    if (!Array.isArray(o) && Object.keys(o).length > 0) {

      // Generate a label based on it's relationship. This is kind of hacky, a better way would be to define data type on the incoming data.
      // I removed this because if you don't know the structure of the incoming data, its better just not give it labels. Which would be the case when scraping the web. I guess it really depends on if you want to normilize the data by giving it data type labels or not.
      const label = relation ? ':' + toLabel(relation) : ":Post";
      // const label = "";

      // Convert remaining non object fields into
      const fields = Object
        .entries(o)
        .map(([key, val]) => `${key}: ${escape(val)}`)
        .join(', ');

      const node = `(n${currentId}${label} {${fields}})`;

      builder.addQuery(`MERGE ${node}\n`);

      // If there is a relationship, we should add it to the query
      if (relation) {
        builder.addQuery(`MERGE (n${currentId})-[:${toEdge(relation)}]->(n${parent})\n`);
      }
    }

    for (const [key, value] of Object.entries(objects)) {
      // const relationship = parent !== undefined ? `-[:${relation}]->(${currentId})` : '';
      Database.toCypher(value, Array.isArray(o) ? parent : currentId, Array.isArray(o) ? relation : key, builder);
    }

    return builder;
  }

  // TODO: If we mocked the query results in neo4j format, we wouldn't even have to define resolvers for graphql data types
  mockNeo4j() {
    return {
      session: () => ({
        writeTransaction: async (cb) => cb({
          run: this.query.bind(this)
        }),
        readTransaction: async (cb) => cb({
          run: this.query.bind(this)
        }),
        close: () => { }
      }),
    }
  }
}

function escape(val) {
  let valFormatted;
  switch (typeof val) {
    case 'string':
      valFormatted = `'${val.replace(/'|\\/g, c => `\\${c}`)}'`;
      break;
    default:
      valFormatted = val
  }
  return valFormatted;
}

function toLabel(str) {
  return str.charAt(0).toUpperCase() + str.substring(0, str[str.length - 1] === 's' ? str.length - 1 : undefined).slice(1);
}

function toEdge(str) {
  return str.substring(0, str[str.length - 1] === 's' ? str.length - 1 : undefined)
}