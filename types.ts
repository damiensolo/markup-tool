/**
 * Represents RFI data linked to a rectangle.
 */
export interface RfiData {
  id: number;
  title: string;
  type: string;
  question: string;
}

/**
 * Represents a rectangle highlight on the blueprint.
 * All values are percentages (0-100) relative to the image container's dimensions.
 */
export interface Rectangle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rfi?: RfiData;
}
