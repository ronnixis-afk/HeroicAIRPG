
// types.ts - Main Entry Point
// This file aggregates types from sub-modules to maintain backward compatibility
// while keeping the codebase modular and specializing AI context.

export * from './types/Core';
export * from './types/Items';
export * from './types/Characters';
export * from './types/World';
export * from './types/Game';

// Fix: Explicitly re-exporting Inventory and Item from their sub-module to resolve 
// "Module has no exported member" errors in various consumer components.
export type { Inventory } from './types/Items';
/* Fix: Explicitly re-exporting StoreItem to resolve "Module has no exported member" errors in various consumer components. */
export type { StoreItem } from './types/Items';
export { Item } from './types/Items';
// Fix: Re-exporting LibraryTrait from its sub-module to resolve visibility issues in the barrel file.
export type { LibraryTrait } from './types/Characters';
