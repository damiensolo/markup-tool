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
 * Represents Submittal data linked to a rectangle.
 */
export interface SubmittalData {
  id: string;
  title: string;
  specSection: string;
  status: 'Open' | 'Closed' | 'In Review';
}

/**
 * Represents Punch List data linked to a rectangle.
 */
export interface PunchData {
  id: string;
  title: string;
  status: 'Open' | 'Ready for Review' | 'Closed';
  assignee: string;
}

/**
 * Represents Drawing data linked to a rectangle.
 */
export interface DrawingData {
  id: string;
  title: string;
  thumbnailUrl: string;
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
  rfi?: RfiData[];
  submittals?: SubmittalData[];
  punches?: PunchData[];
  drawings?: DrawingData[];
}