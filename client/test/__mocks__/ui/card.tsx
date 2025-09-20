import * as React from 'react';
export function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} data-testid="card" />;
}
export function CardContent(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} data-testid="card-content" />;
}
export default Card;
