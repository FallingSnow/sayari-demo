// This code is effectively dead. See readme.

importScripts('https://unpkg.com/three');
// 3d-force-graph requires this hack because it looks for three.js in window.THREE
globalThis.window = { THREE };
importScripts('https://unpkg.com/3d-force-graph');

const graph = ForceGraph3D();

const worker = insideWorker(e => {
  
  if (e.data.canvas) {

    graph(e.data.canvas)
      .width(500)
      .cooldownTicks(100)
      .linkDirectionalArrowLength(3.5)
      .linkDirectionalArrowRelPos(1)
      .linkAutoColorBy('name')
      .linkOpacity(0.8)
      .nodeId('_id')
      .nodeVal('score')
      .nodeLabel('_label')
      .nodeAutoColorBy('_label')
      .backgroundColor('#00000000')
      .onNodeClick(node => worker.postMessage({ event: 'click', node }));

    graph.dagMode('radialin').d3Force('center');

    // graph.onEngineStop(() => graph.zoomToFit(400));
    console.info("Graph created!");

  } else if (e.data.message === 'data') {
    const gData = new NodeLinkBuilder(e.data.data.data.posts).build()
    graph.graphData(gData);
  }
})

// This class serves as a way to create a list of nodes and links from a graphql query
class NodeLinkBuilder {
  nodes = new Set();
  links = new Set();

  constructor(data) {
    this.parse(data);
  }
  parse(data, parentId?, relationship?) {
    data = Array.isArray(data) ? data : [data];
    for (const node of data) {
      if (parentId) {
        this.addLink({ source: node._id, target: parentId, name: relationship });
      }

      const objects = Object.entries(node)
        .reduce((acc, [key, val]) => {

          // If objet, remove
          if (typeof val === 'object') {
            acc[key] = val;
            delete data[key];
          }

          return acc;
        }, {});

      for (const [relationship, nodes] of Object.entries(objects)) {
        if (nodes)
          this.parse(nodes, node._id, relationship);
      }

      this.addNode({ ...node });
    }
  }

  addNode(node) {
    this.nodes.add(node);
  }
  addLink(link) {
    this.links.add(link);
  }
  build() {
    const nodes = [];
    const links = [];
    this.nodes.forEach(value => nodes.push(value));
    this.links.forEach(value => links.push(value));
    return { nodes, links }
  }
}


// https://github.com/ai/offscreen-canvas/blob/master/inside-worker.js
function insideWorker(listener) {
  if (typeof globalThis.importScripts === 'function') {
    onmessage = listener
    return {
      post: function (a, b) {
        postMessage(a, b)
      },
      isWorker: true
    }
  } else {
    var randomId = document.currentScript.dataset.id
    var connection = window[randomId]
    delete window[randomId]

    connection.worker = listener

    setTimeout(function () {
      connection.msgs.forEach(function (data) {
        connection.worker({ data: data })
      })
    }, 1)

    return {
      post: function (data) {
        connection.host({ data: data })
      },
      isWorker: false
    }
  }
}