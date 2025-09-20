import * as React from 'react';
export function Skeleton(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} data-testid="skeleton" />;
}
export default Skeleton;
