import { GameData } from '../types';

export interface CloudSaveMetadata {
    id: string;
    worldId: string;
    name: string;
    updatedAt: string;
    createdAt: string;
}

export const cloudSaveService = {
    fetchCloudSavesMetadata: async (): Promise<CloudSaveMetadata[]> => {
        const response = await fetch('/api/cloud-save', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch cloud saves metadata');
        }

        return await response.json();
    },

    pushSaveToCloud: async (worldId: string, name: string, data: GameData): Promise<string> => {
        const response = await fetch('/api/cloud-save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ worldId, name, data })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to push save to cloud');
        }

        const result = await response.json();
        return result.id;
    },

    fetchCloudSaveContext: async (id: string): Promise<{ data: GameData; name: string; worldId: string }> => {
        const response = await fetch(`/api/cloud-save/${id}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch cloud save data');
        }

        const result = await response.json();
        return { data: result.data, name: result.name, worldId: result.worldId };
    },

    deleteCloudSave: async (id: string): Promise<void> => {
        const response = await fetch(`/api/cloud-save/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete cloud save');
        }
    }
};
