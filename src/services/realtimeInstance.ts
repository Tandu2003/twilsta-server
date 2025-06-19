import RealtimeService from './realtimeService';

// Singleton instance for RealtimeService
let realtimeServiceInstance: RealtimeService | null = null;

/**
 * Set the RealtimeService instance
 */
export function setRealtimeService(instance: RealtimeService): void {
  realtimeServiceInstance = instance;
}

/**
 * Get the RealtimeService instance
 */
export function getRealtimeService(): RealtimeService | null {
  return realtimeServiceInstance;
}

/**
 * Check if RealtimeService is initialized
 */
export function isRealtimeServiceInitialized(): boolean {
  return realtimeServiceInstance !== null;
}
