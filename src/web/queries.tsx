
import { setup, styled } from 'goober';

import {ShadowWrapper, Header, Code} from './components.js';

const QueryWrapper = styled(ShadowWrapper)({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between'
});

const Query = styled('li')({
  cursor: 'pointer',
  textAlign: 'center',
  padding: '1rem 0',
  opacity: 0.9,
  border: '1px solid transparent',
  transition: 'all 0.2s',
  '&:hover': {
    opacity: 1,
    borderColor: 'lightgrey',
  }
});

export const queries = [
  {
    name: "Basic",
    details: "Posts",
    query: "query { posts { id, _id, __typename, score } }"
  },
  {
    name: "Complex",
    details: "Posts + Comments + Users",
    query: "query { posts {id, _id, __typename, title, score, user {id, _id, __typename}, comments {id, _id, __typename, user {id, _id, __typename, comments {id, _id, __typename}}}} }"
  },
];
const Queries = ({ onSelect, selected }) => {
  const items = queries.map((query, idx) => (<Query key={query.name} title={query.details} onClick={() => onSelect(query)}>{query.name}</Query>))
  return (
    <QueryWrapper>
      <div>
        <Header>Queries</Header>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {items}
        </ul>
      </div>
      <Code>
        <h4>Query <small>{selected.name}</small></h4>
        {selected.query}
      </Code>
    </QueryWrapper>
  )
};

export default Queries;