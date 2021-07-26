import p from 'pino';

import { Database } from './database';
import options from './options';

const log = p({ name: 'main', level: options.logLevel, prettyPrint: process.env.NODE_ENV });

export const Post = {
  _id: getNodeId(),
  id: getProperty('id'),
  title: getProperty('title'),
  body: getProperty('body'),
  creation: getProperty('creation'),
  score: getProperty('score'),
  user: getRelation(false, 'user'),
  comments: getRelation(true, 'comment'),
  answers: getRelation(true, 'answer'),
};

export const Comment = {
  _id: getNodeId(),
  id: getProperty('id'),
  body: getProperty('body'),
  user: getRelation(false, 'user'),
};

export const Answer = {
  _id: getNodeId(),
  id: getProperty('id'),
  body: getProperty('body'),
  creation: getProperty('creation'),
  score: getProperty('score'),
  user: getRelation(false, 'user'),
  accepted: getProperty('accepted'),
  comments: getRelation(true, 'comment'),
  answers: getRelation(false, 'comment', 'out', 'Post'),
};

export const User = {
  _id: getNodeId(),
  id: getProperty('id'),
  name: getProperty('name'),
  posts: getRelation(true, 'user', 'out', 'Post'),
  comments: getRelation(true, 'user', 'out', 'Comment'),
  answers: getRelation(true, 'user', 'out', 'Answer'),
};

export const SearchResult = {
  __resolveType: ({ __typename }) => __typename
};

// OPTIMIZE: Using info.operation.selectionSet.selections[0].selectionSet.selections[0] you can actually only query the exect fields the client has asked for from the database
export const Query = {
  search: async (root, { keywords = "" }, context: { database: Database }, info) => {
    log.trace("Searching for \"%s\"", keywords);

    const params = new SearchParams(keywords);
    const query = `MATCH (n) ${params.toString()} RETURN id(n),labels(n)`;

    const { results } = await context.database.query(query);

    // @ts-ignore
    return results.map(([_id, __typename]) => ({
      _id,
      __typename
    }));
  },
  posts: getNode('Post'),
  users: getNode('User'),
};

export const Mutation = {
  // This is an example of a mutation, it doesn't actually work
  delete: async (root, { _id }, context: { database: Database }, info) => {
    const { results } = await context.database.query(`MATCH (n)-[e]-() WHERE id(n)=${_id} DELETE n,e`);
    console.log(results);
  }
}

// This is effectively dead code but will be very useful when redisgraph supports pattern comprehension. It allows you to directly query the information you want from the database.
// To use it you would replace current resolvers for types with this function and add `driver: this.database.mockNeo4j()` to the context of each graphql query.
// import { cypherMutation, cypherQuery } from 'neo4j-graphql-js';
// import { isMutation } from 'neo4j-graphql-js/dist/utils';
// async function directQuery(root, args, context, info) {
//   const cypherFunction = isMutation(info)
//       ? cypherMutation
//       : cypherQuery;
//     let [query, params] = cypherFunction(
//       args,
//       context,
//       info
//     );
//     const { results } = await context.database.query(query);
//     return results;
// }

function getNodeId() {
  return ({ _id }) => _id;
}

function getNode(label: string) {

  return async (root, args, { database }) => {
    log.trace("Getting nodes of type \"%s\"", label);
    const query = `MATCH (n:${label}) RETURN id(n)`;
    const { results } = await database.query(query);
    return results.map(ids => ({ _id: ids[0] }));
  }

}

function getProperty(field: string) {
  return async ({ _id }, args, { database }) => {

    log.trace("Getting \"%s\" on node with node id \'%s\'", field, _id);
    const query = `MATCH (n) WHERE id(n)=${_id} RETURN n.${field}`;
    const { results } = await database.query(query);
    return results[0][0];

  }
}

function getRelation(many = false, relation?: string, direction = 'in', label?: string) {
  return async ({ _id }, args, { database }) => {

    const query = `MATCH (n)${direction === 'in' ? '<' : ''}-[${relation ? ':' + relation : ''}]-${direction === 'out' ? '>' : ''}(r${label ? ':' + label : ''}) WHERE id(n)=${_id} RETURN id(r)`;
    const { results } = await database.query(query);

    if (many)
      return results.map(ids => ({ _id: ids[0] }));
    else
      return { _id: results[0][0] }

  }
}

// FIXME: SearchParams does not escape user input
class SearchParams {
  static pattern = /(?<text>.*?)(?<set>(?<key>\S*):(("(?<stringVal>.*?)")|(?<intVal>.*?)($|\s)))/g;
  fields = [];
  freetext = "";

  constructor(search) {
    let res;
    while (res = SearchParams.pattern.exec(search)) {
      this.freetext += res.groups.text;

      let key = `n.\`${res.groups.key.replace(/`/g, '')}\``;
      let comparitor = "CONTAINS";
      let value: number | string = res.groups.intVal ? parseInt(res.groups.intVal) : `'${res.groups.stringVal.replace(/'/g, "\\'")}'`;

      if (res.groups.key === '_id') {
        key = 'id(n)';
        comparitor = "=";
      }

      this.fields.push({
        key,
        comparitor,
        value
      });
    }
  }

  toString() {
    let output = "";
    if (Object.keys(this.fields).length) {
      output += "WHERE ";
      output += this.fields
        .map(({ key, comparitor, value }) => `${key} ${comparitor} ${value}`).join(' AND ');
    }

    return output;
  }
}