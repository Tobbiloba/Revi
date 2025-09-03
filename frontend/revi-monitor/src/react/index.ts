export { ReviProvider, useRevi } from './PureReviProvider.js';

// Re-export main SDK types that React users might need
export type { 
  ReviConfig, 
  ErrorEvent, 
  UserContext,
  SessionEvent,
  NetworkEvent 
} from '../types';

// TypeScript interface for ReviProvider props
export interface ReviProviderProps {
  children: React.ReactNode;
  apiKey: string;
  apiUrl?: string;
  environment?: 'development' | 'production' | 'staging';
  debug?: boolean;
  userId?: string;
  userEmail?: string;
  sampleRate?: number;
  sessionSampleRate?: number;
}