import { setup, styled } from 'goober';

export const Header = styled('h3')({
  fontSize: '1.1em',
  textAlign: 'center'
});

export const ShadowWrapper = styled('div')({
  boxShadow: '0px 0px 16px -3px #0000000d',
  padding: '0.5rem 1rem',
  zIndex: 1,
  overflow: 'auto'
});

export const Code = styled('pre')({
  background: 'white',
  whiteSpace: 'pre-wrap'
});