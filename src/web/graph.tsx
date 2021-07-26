/** @jsxImportSource react */
import { useMemo, useRef, useEffect, Fragment } from 'react';
import useSWR from 'swr';
import ForceGraph3D from '3d-force-graph';
import SpriteText from 'three-spritetext';

import fetcher from "./fetcher.js";

const nodeColor = selected => node => node._id === selected?._id ? '#FFEB3B' : false;

const Graph = ({ query, onClick, width, selected }) => {
  const domEl = useRef();
  const graph = useRef();

  // Query graphql data api
  const { data: response, error } = useSWR(JSON.stringify({
    query
  }), fetcher, {
    revalidateOnFocus: false
  });

  if (error || response?.errors) {
    console.error(`Unable to query: "${query}"`);
    console.error(error || response?.errors);
  };

  // Convert graphql data into nodes and links
  const gData = useMemo(() => {
    if (!response?.data) return;
    return new NodeLinkBuilder(response.data.posts).build()
  }, [response]);

  useEffect(() => {
    if (!graph.current) return;
    // graph.current.nodeColor(nodeColor(selected));
  }, [selected]);


  useEffect(() => {
    // If graph exists already, or there is no dom element to attach to; return
    if (graph.current || !domEl.current) return;

    graph.current = ForceGraph3D();
    graph.current(domEl.current)
      .width(width)
      .cooldownTicks(200)
      .linkDirectionalArrowLength(3.5)
      .linkDirectionalArrowRelPos(1)
      .linkAutoColorBy('name')
      .linkOpacity(0.8)
      .nodeId('_id')
      .nodeVal('score')
      .nodeLabel('__typename')
      // .nodeColor(nodeColor(selected))
      .nodeOpacity(1)
      .nodeAutoColorBy('__typename')
      .backgroundColor('#00000000')
      .onNodeClick(onClick);

    // graph.current.dagMode('radialin').d3Force('center');
    // graph.onEngineStop(() => graph.zoomToFit(400));
    console.debug("Created graph");
  }, [gData, domEl]);

  useEffect(() => {
    // If no graph or no data; return
    if (!graph.current || !gData) return;

    console.info("Setting new graph data", gData);
    graph.current.graphData(gData);
  }, [graph, gData]);

  let message;

  if (error || response?.errors) {
    message = (<div>Error loading graph. Check console.</div>);
  } else if (!response) {
    message = (<div>Loading Data...</div>)
  }

  return (<Fragment>
    {message}
    <div style={{width: message ? 0: 'initial', height: message ? 0: 'initial', overflow: 'hidden'}}ref={domEl} />
  </Fragment>);
}

// This class serves as a way to create a list of nodes and links from a graphql query
class NodeLinkBuilder {
  nodes = new Map();
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
    this.nodes.set(node._id, node);
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

export default Graph;