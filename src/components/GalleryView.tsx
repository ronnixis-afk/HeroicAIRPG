import React, { useContext, useState, useEffect } from 'react';
import { GameDataContext } from '../context/GameDataContext';
import { Icon } from './Icon';
import type { GalleryMetadata, GalleryEntry } from '../types';
import { dbService } from '../services/dbService';

interface GalleryCardProps {
    metadata: GalleryMetadata;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onDownload: (id: string) => void;
    onShare: (id: string) => void;
}

const GalleryCard: React.FC<GalleryCardProps> = ({ metadata, onSelect, onDelete, onDownload, onShare }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        dbService.getGalleryImage(metadata.id).then(url => {
            setImageUrl(url || null);
            setIsLoading(false);
        });
    }, [metadata.id]);

    const getSafeUrl = () => {
        if (!imageUrl) return '';
        return imageUrl.startsWith('data:') ? imageUrl : `data:image/png;base64,${imageUrl}`;
    };

    return (
        <div
            onClick={() => onSelect(metadata.id)}
            className="group relative aspect-[9/16] bg-brand-surface rounded-xl overflow-hidden border border-brand-primary cursor-pointer hover:border-brand-accent transition-all shadow-lg"
        >
            {isLoading ? (
                <div className="w-full h-full flex items-center justify-center bg-brand-primary/20">
                    <Icon name="spinner" className="w-6 h-6 animate-spin text-brand-accent/40" />
                </div>
            ) : imageUrl ? (
                <img
                    src={getSafeUrl()}
                    alt={metadata.description}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-red-900/10">
                    <Icon name="danger" className="w-6 h-6 text-red-500/40" />
                </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                <span className="text-body-sm font-bold text-brand-accent mb-1">
                    {metadata.timestamp}
                </span>
                <p className="text-body-sm text-white line-clamp-2 leading-tight mb-4">
                    {metadata.description}
                </p>

                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); onDownload(metadata.id); }}
                        className="btn-icon w-10 h-10 bg-white/10 hover:bg-brand-accent hover:text-black backdrop-blur-md"
                        title="Download Image"
                    >
                        <Icon name="download" className="w-5 h-5" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onShare(metadata.id); }}
                        className="btn-icon w-10 h-10 bg-white/10 hover:bg-brand-accent hover:text-black backdrop-blur-md"
                        title="Share Memory"
                    >
                        <Icon name="share" className="w-5 h-5" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(metadata.id); }}
                        className="btn-icon w-10 h-10 bg-white/10 hover:bg-brand-danger hover:text-white backdrop-blur-md"
                        title="Delete Memory"
                    >
                        <Icon name="trash" className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

const GalleryView: React.FC = () => {
    const { gallery, deleteGalleryEntry } = useContext(GameDataContext);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
    const [showControls, setShowControls] = useState(true);

    const sortedGallery = [...(gallery || [])].sort((a, b) => {
        const timeA = Number(a.realTimestamp || 0);
        const timeB = Number(b.realTimestamp || 0);
        return timeB - timeA;
    });

    const selectedMetadata = sortedGallery.find(g => g.id === selectedId);

    useEffect(() => {
        if (selectedId) {
            dbService.getGalleryImage(selectedId).then((val: string | undefined) => setSelectedImageUrl(val || null));
        } else {
            setSelectedImageUrl(null);
        }
    }, [selectedId]);

    const getSafeUrl = (url: string | null) => {
        if (!url) return '';
        return url.startsWith('data:') ? url : `data:image/png;base64,${url}`;
    };

    const handleDelete = (id: string) => {
        if (window.confirm("Permanently delete this memory from the gallery?")) {
            deleteGalleryEntry(id);
            if (selectedId === id) setSelectedId(null);
        }
    };

    const handleDownload = async (id: string) => {
        const url = await dbService.getGalleryImage(id);
        if (!url) return;
        const meta = gallery.find(g => g.id === id);
        const link = document.createElement('a');
        link.href = getSafeUrl(url);
        link.download = `adventure_memory_${meta?.timestamp.replace(/\s+/g, '_') || id}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleShare = async (id: string) => {
        const url = await dbService.getGalleryImage(id);
        if (!url) return;
        const meta = gallery.find(g => g.id === id);
        const imageUrl = getSafeUrl(url);

        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const file = new File([blob], 'adventure-memory.png', { type: 'image/png' });

            if (navigator.share && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'Adventure Memory',
                    text: meta?.description
                });
            } else if (navigator.share) {
                await navigator.share({
                    title: 'Adventure Memory',
                    text: meta?.description,
                    url: window.location.href
                });
            }
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    return (
        <div className="p-4 pt-8 max-w-3xl mx-auto pb-24">
            <h1 className="text-center">Journey Gallery</h1>
            <p className="text-body-base text-brand-text-muted text-center mb-12">
                A visual record of your journey's most significant moments.
            </p>

            {sortedGallery.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {sortedGallery.map(meta => (
                        <GalleryCard
                            key={meta.id}
                            metadata={meta}
                            onSelect={setSelectedId}
                            onDelete={handleDelete}
                            onDownload={handleDownload}
                            onShare={handleShare}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-brand-primary rounded-3xl bg-brand-primary/5">
                    <Icon name="photo" className="w-16 h-16 text-brand-text-muted opacity-20 mb-4" />
                    <p className="text-body-base text-brand-text-muted italic">The canvas of your history is currently blank.</p>
                    <p className="text-body-sm text-brand-text-muted mt-2">Use 'View Scene' in chat to capture moments.</p>
                </div>
            )}

            {selectedId && selectedMetadata && (
                <div className="fixed inset-0 z-[100] bg-black/98 flex flex-col items-center justify-center animate-fade-in" onClick={() => setSelectedId(null)}>

                    <div className={`absolute top-8 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-6 transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDownload(selectedId); }}
                            className="btn-icon w-12 h-12 bg-black/40 hover:bg-brand-accent hover:text-black rounded-full backdrop-blur-xl border border-white/10 shadow-2xl group"
                            title="Save Image"
                        >
                            <Icon name="download" className="w-6 h-6 transition-transform group-active:scale-90" />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleShare(selectedId); }}
                            className="btn-icon w-12 h-12 bg-black/40 hover:bg-brand-accent hover:text-black rounded-full backdrop-blur-xl border border-white/10 shadow-2xl group"
                            title="Share Memory"
                        >
                            <Icon name="share" className="w-6 h-6 transition-transform group-active:scale-90" />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(selectedId); }}
                            className="btn-icon w-12 h-12 bg-black/40 hover:bg-brand-danger hover:text-white rounded-full backdrop-blur-xl border border-white/10 shadow-2xl group"
                            title="Delete Item"
                        >
                            <Icon name="trash" className="w-6 h-6 transition-transform group-active:scale-90" />
                        </button>
                    </div>

                    <button
                        onClick={() => setSelectedId(null)}
                        className={`absolute top-8 right-6 z-[110] btn-icon p-3 bg-black/20 rounded-full text-brand-text-muted hover:text-white transition-all backdrop-blur-md ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                        title="Close"
                    >
                        <Icon name="close" className="w-6 h-6" />
                    </button>

                    <div className="relative w-full max-w-2xl h-full flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
                        <div className="w-full relative group flex flex-col items-center h-full">
                            {!selectedImageUrl ? (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Icon name="spinner" className="w-12 h-12 animate-spin text-brand-accent" />
                                </div>
                            ) : (
                                <img
                                    src={getSafeUrl(selectedImageUrl)}
                                    alt="Scene"
                                    className="w-full h-full object-contain cursor-pointer"
                                    onClick={(e) => { e.stopPropagation(); setShowControls(!showControls); }}
                                />
                            )}

                            <div className={`absolute bottom-12 left-0 right-0 px-6 transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                                <div className="max-w-md mx-auto bg-black/60 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-2xl text-center">
                                    <span className="text-body-base font-bold text-brand-accent block mb-2">
                                        {selectedMetadata.timestamp}
                                    </span>
                                    <p className="text-body-base text-brand-text leading-relaxed font-medium italic">
                                        {selectedMetadata.description}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GalleryView;