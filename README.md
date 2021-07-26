# sayari-demo

This is a developer challenge to build an app based on a stackoverflow like dataset.

Time: 40 - 50 hours (I had fun)

![A complex query](https://github.com/FallingSnow/sayari-demo/raw/master/screenshots/main.jpg "A complex query")
![database](https://github.com/FallingSnow/sayari-demo/raw/master/screenshots/database.jpg "database")

## Usage

Make sure you have the following installed:
* Docker
* Docker Compose

#### Local
```
docker-compose start db
npm install
npm run dev
```

#### Docker
```
docker-compose up
```

*Note*: If you're switching between dev and production, make sure to clear your cache.

## Design Descisions and Considerations

#### Rest vs GraphQL
Normally I always incorperate OpenAPI. That means designing the API in OpenAPI, then using code to create endpoints (REST and GraphQL in HTTP and WS) that conform to that specification. However that would take more time than I was willing to put into this project. :P So I just stuck with GraphQL.

#### Graphql Client Library
I chose `swr` over `apollo-client` because I wanted something lightweight. I'm sure apollo or relay have many more features but I like to keep the app weight (kbs) low and the application fast. Also the switch can be made later if it's determined a feature from another library would be useful.

#### Graph Library
At first I tried to use Sayari's trellis but it seemed to have issues being loaded as an es module in the browser. So instead I chose `3d-force-graph` because it was webgl based and had good documentation. Though I really wish it had worked in a web worker :(

#### Database
Redisgraph provide a high performance graph database. It has reliable persistence and active-active support for scaling.

Redis is an in memory database. Datasets might get too large and become larger than the avaliable memory. This can be alleviated by using hybrid storage solutions in redis (Redis on Flash) and keydb (FLASH). 

#### UI Framework
I have been using Preact a lot laterly but didn't want to run into any compatibility issues, so I stuck with React for this one.

#### Web Server
This one I assume is an interesting choice. There are some many web servers out there, even for node. I chose `uWebsockets.js` because it has very high performance, not much more complex than express, and has the possibility of using websockets baked in (thats always a good door to leave open).

The one thing I might have changed is serving the compiled UI from nginx instead of from node when in production.

## Features
* When not in development mode (NODE_ENV=development) console output is provided in machine readable format.
* On the fly self compiling of server via require hooks.
* Compiles web code when the code changes.
* Very powerful search that was not utilized to the fullest in the web UI.


## Possible Improvements
* Use a possibly more efficient protocol like msgpack.
* Use websockets for data transmission. Would be useful to get data to/from database for live data. (d3-force-graph supports live data updates)
* Single redisgraph query per graphql using neo4j-graphql-js
  Once redisgraph supports pattern comprehension we can directly query the database using neo4j-graphql-js. [See https://github.com/RedisGraph/RedisGraph/issues/1308]
* Or we can use graphql directives to store relationship data in the graphql schema. Then we don't need to write resolvers.
* Lock mouse during graph drag. https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API
* Graph query endpoint, were data is deduplicated and returned as {nodes, links}
* Run the graph in a web worker. Work was made towards this but `3d-force-graph` creates dom elements internally, so you cannot use it in its present form [See https://github.com/vasturiano/3d-force-graph/issues/353]. Offscreen Canvas library should also be updated to support es modules [See https://github.com/ai/offscreen-canvas/issues/24]. Look at `graph-worker.ts` in the src/web directory.
* Add React-Refresh support, but thats kind of a pipedream. Although SWC does support adding the transforms.
* **Testing** I didn't have enough time to add testing lol, why does it always end up this way. I guess this is just a challenge, but it would have been nice to add.
* Full-text search. This is half built with the search resolver already parsing freetext. RedisGraph supports full text indicies, but putting them on the right fields on the right datatypes would have taken more time.
* Responsive sizing and mobile friendly. (Would have taken more time)
* Better documenation. As it stands the code isn't the easiest to read. Function documenation and clean up would have been nice to add if time permited.


## Lessons
* I would have made the backend/database more data agnostic. Remove labels all together maybe. Using data type labels (like Post, Comment, Answer, User) rather than refering to data simply as nodes and edges made things more difficult than they should have been. Also doesn't make it easy to adapt this backend to another dataset.

## Example Graphql Queries
Get all posts along with the user that created it
```graphql
query {
  posts {
    _id,
    __typename,
    title,
    score,
    body,
    user {
      _id,
      __typename
    }
  }
}
```

Get all posts with panda in the title
```graphql
query {
  search(keywords: "title:\"panda\"") {
    ... on Post {
      _id,
      title
    }
  }
}
```

Graphql Data Strcuture
```graphql
query {
  __schema {
    types {
      kind
      name
      fields {
        name
      }
      possibleTypes {
        name
      }
    }
  }
}
```