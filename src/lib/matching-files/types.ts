export interface ParsedRow {
  _originalRowIndex: number;
  article: string;
  colour: string;
  size: string;
  [key: string]: any; // Allow other original fields to be retained
}

export interface UploadedFile {
  id: string;
  originalFilename: string;
  displayHeading: string;
  fileType: string;
  fileSize: number;
  uploadDate: number; // Unix timestamp
  status: 'parsing' | 'ready' | 'error' | 'unsupported';
  errorMessage?: string;
}

// Data is stored separately in IndexedDB to prevent loading huge arrays into memory unnecessarily
export interface ParsedFileData {
  fileId: string;
  rows: ParsedRow[];
}

export type MatchStatus = 'Perfect Match' | 'Partial Match' | 'Conflict' | 'Missing' | 'Duplicate' | 'Unique';

export interface ComparisonResultRow {
  id: string; // Unique row ID
  compositeKey: string;
  article: string;
  colour: string;
  size: string;
  totalQuantity: number;   // sum of quantity across ALL sources
  
  // Array of files that contain this exact composite key
  sources: {
    fileId: string;
    displayHeading: string;
    originalRowIndex: number;
    rowData: ParsedRow;
    quantity: number;
  }[];

  status: MatchStatus;
}
