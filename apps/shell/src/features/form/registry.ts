import Button from './Button.svelte';
import Grid from './Grid.svelte';

export const registry: {
  button: typeof Button;
  grid: typeof Grid;
} = {
  button: Button,
  grid: Grid,
};

export type NodeType = keyof typeof registry;
