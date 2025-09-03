import React from 'react';
import { Monitor } from '../monitor';
interface ReviContextType {
    monitor: Monitor | null;
    isInitialized: boolean;
    sessionId: string;
}
export declare const useRevi: () => ReviContextType;
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
export declare function ReviProvider({ children, apiKey, apiUrl, environment, debug, userId, userEmail, sampleRate, sessionSampleRate }: ReviProviderProps): React.JSX.Element;
export default ReviProvider;
//# sourceMappingURL=ReviProvider.d.ts.map