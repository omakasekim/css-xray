export interface SpecificityTuple {
  ids: number;
  classes: number;
  elements: number;
  formatted: string;
}

export interface TailwindConflict {
  className: string;
  bucket: string;
  overriddenBy: string;
  reason: string;
}

export interface StackingContextInfo {
  createsContext: boolean;
  reason: string;
  zIndex: string;
  parentTrapWarning?: string;
}

export interface LayoutNodeSnapshot {
  id: string;
  parentId: string | null;
  tag: string;
  idAttr?: string;
  classes: string[];
  depth: number;
  rect: { x: number; y: number; width: number; height: number };
  boxModel: {
    margin: [number, number, number, number];
    border: [number, number, number, number];
    padding: [number, number, number, number];
  };
  display: string;
  position: string;
  zIndex: string;
  opacity: string;
  transform: string;
  gap: string;
  gridTemplateColumns: string;
  overflowBug: boolean;
  stacking: StackingContextInfo;
  textPreview: string;
}

export interface CssXrayPreset {
  id: string;
  name: string;
  tag: string;
  description: string;
  html: string;
  css: string;
}
