/** @jsxImportSource react */
import { Fragment, createElement, useState, Suspense, lazy } from "react";
import { render } from "react-dom";
import { setup, styled } from 'goober';
import { createGlobalStyles } from 'goober/global';
import { prefix } from 'goober/prefixer';
import useSWR from 'swr';

import fetcher from "./fetcher.js";
import Queries, { queries } from "./queries.js";
import { ShadowWrapper, Header, Code } from './components.js';
const Graph = lazy(() => import('./graph.js'));

setup(createElement, prefix);

const GRID_WIDTH = .6; // Percent (0.0 - 1.0)

const GlobalStyles = createGlobalStyles({
  'html, body': {
    margin: 0,
    padding: 0,
    fontFamily: `'Montserrat', sans-serif`,
    backgroundColor: '#fefefe'
  },
});

const Wrapper = styled('div')({
  display: 'grid',
  height: '100vh',
  gridTemplateColumns: `20% ${GRID_WIDTH * 100}% 20%`,
});

const GraphContainer = styled('div')({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  fontSize: '1.2em',
  color: 'grey',
  height: '100vh',
  width: `${GRID_WIDTH * 100}vw`,
  backgroundColor: '#fafafa'
});

const searchQuery = (_id) => {
  return `query { search(keywords: "_id:${_id}") {
    ... on Post {
        _id,
        title,
        body,
        creation,
        score,
        comments {
          _id
        },
        user {
          name
        }
    }
    ... on Comment {
        _id,
        body,
        user {
          name
        }
    }
    ... on Answer {
        _id,
        body,
        creation,
        score,
        user {
          name
        },
        accepted
    }
    ... on User {
        _id,
        name,
        posts {
          _id
        },
        comments {
          _id
        }
    }
  }}`;
};
const InfoDetails = ({ _id }) => {
  const { data, error } = useSWR(JSON.stringify({
    query: searchQuery(_id)
  }), fetcher, {
    revalidateOnFocus: false
  });

  if (error || data?.errors) {
    console.error(error || data?.errors);
    return (<div>Error. Check console.</div>);
  }

  if (!data) {
    return (<div>Loading...</div>);
  }
  
  return (
    <Code>
      {JSON.stringify(data, null, 2)}
    </Code>
  )
};
const Info = ({ node }) => {
  const details = node ? <InfoDetails _id={node._id} /> : null;
  // Query graphql data api
  return (
    <ShadowWrapper>
      <Header>Details</Header>
      {details}
    </ShadowWrapper>
  )
};

const App = () => {

  const [selected, setSelected] = useState();
  const [query, setQuery] = useState(queries[0]);

  return (<Wrapper>
    <Queries onSelect={setQuery} selected={query} />
    <GraphContainer>
      <Suspense fallback={<div>Graph Loading...</div>}>
        <Graph width={window.innerWidth * GRID_WIDTH} onClick={node => setSelected(node)} selected={selected} query={query.query} />
      </Suspense>
    </GraphContainer>
    <Info node={selected} />
  </Wrapper>);
};

render(<Fragment>
  <GlobalStyles />
  <App />
</Fragment>, document.body);