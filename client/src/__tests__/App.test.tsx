import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';

test('App se rend sans crasher', () => {
  const { container } = render(<App />);
  expect(container.firstChild).toBeTruthy();
});
