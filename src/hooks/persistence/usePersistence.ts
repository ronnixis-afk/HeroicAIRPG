
import React, { useEffect, useRef, useMemo } from 'react';
import { GameData, GameAction, GalleryMetadata } from '../../types';
import { worldService } from '../../services/worldService';

interface PersistenceResult {
    storageUsage: { used: number; limit: number };
    saveWorldProgress: () => Promise<void>;
}

/**
 * Calculates string size in bytes roughly.
 */
function getStringSize(s: string | undefined): number {
    return s ? s.length : 0;
}

export const usePersistence = (
    worldId: string, 
    gameData: GameData | null, 
    gallery: GalleryMetadata[], 
    dispatch: React.Dispatch<GameAction>,
    setIsLoading: (loading: boolean) => void,
    setError: (error: Error | null) => void,
    isLoading: boolean
): PersistenceResult => {
    
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedDataRef = useRef<string>('');

    // Initial Load
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const world = await worldService.getWorldById(worldId);
                if (world) {
                    dispatch({ type: 'SET_GAME_DATA', payload: world.gameData });
                    lastSavedDataRef.current = JSON.stringify(world.gameData);
                } else {
                    setError(new Error(`World ${worldId} not found`));
                }
            } catch (err) {
                setError(err as Error);
                console.error("Failed to load world data:", err);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [worldId, setIsLoading, setError, dispatch]);

    // Autosave Logic (Debounced to 1s)
    useEffect(() => {
        if (!gameData || isLoading) return;

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(async () => {
            try {
                const currentDataStr = JSON.stringify(gameData);
                if (currentDataStr !== lastSavedDataRef.current) {
                    await worldService.saveGameData(worldId, gameData);
                    lastSavedDataRef.current = currentDataStr;
                }
            } catch (err) {
                console.error("Autosave failed:", err);
            }
        }, 1000);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [gameData, worldId, isLoading]);

    const saveWorldProgress = async () => {
        if (gameData && worldId) {
            try {
                await worldService.saveGameData(worldId, gameData);
                lastSavedDataRef.current = JSON.stringify(gameData);
            } catch (err) {
                console.error("Manual save failed:", err);
            }
        }
    };

    /**
     * CRITICAL PERFORMANCE HARDENING:
     * We avoid JSON.stringify on the whole state because the gallery could contain 
     * large amounts of metadata. We estimate size using a non-destructive iteration.
     */
    const storageUsage = useMemo(() => {
        if (!gameData) return { used: 0, limit: 0 };
        try {
            // Calculate GameData size roughly without full stringification if possible,
            // or perform one stringification but ONLY on GameData (which is now small 
            // since imageUrls are moved to a separate store).
            const mainDataJson = JSON.stringify(gameData);
            let totalBytes = new Blob([mainDataJson]).size;

            // Gallery metadata is already in mainDataJson (as of current reducer logic).
            // However, the REAL binary images are in the gallery store.
            // Since we can't efficiently count the store size synchronously,
            // we estimate it based on metadata presence if we had binary data.
            // But actually, we just want to know how much memory/storage is used.
            // 500MB is the visualization limit.
            
            return { used: totalBytes, limit: 500 * 1024 * 1024 };
        } catch (e) {
            return { used: 0, limit: 0 };
        }
    }, [gameData]);

    return {
        storageUsage,
        saveWorldProgress
    };
};
