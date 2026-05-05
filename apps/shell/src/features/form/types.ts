export type UINode = ButtonNode | GridNode;

export interface BaseNode {
  id?: string;
  type: string;
}

/** ─────────────────────────────
 *  BUTTON
 *  ───────────────────────────── */
export interface ButtonNode extends BaseNode {
  type: 'button';
  text: string;
  onClick?: string;
}

/** ─────────────────────────────
 *  GRID
 *  ───────────────────────────── */
export interface GridNode extends BaseNode {
  type: 'grid';
  columns: number;
  children: GridChildNode[];
}

/** children inside grid carry layout info */
export interface GridChildNode {
  node: UINode;
  cell?: GridCell;
}

export interface GridCell {
  row: number;     // 1-based (CSS grid)
  col: number;     // 1-based
  rowSpan?: number;
  colSpan?: number;
}
