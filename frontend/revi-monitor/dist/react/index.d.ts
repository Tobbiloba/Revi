export { ReviProvider, useRevi } from './PureReviProvider.js';
export type { ReviConfig, ErrorEvent, UserContext, SessionEvent, NetworkEvent } from '../types';
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
//# sourceMappingURL=index.d.ts.map