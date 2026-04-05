import React, { useState, useCallback } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import Modal from '../Modal';
import Button from '../Button';
import { Icon } from '../Icon';

interface ImageCropModalProps {
    isOpen: boolean;
    image: string;
    onClose: () => void;
    onCropComplete: (croppedImage: string) => void;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({ isOpen, image, onClose, onCropComplete }) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

    const onCropChange = (crop: { x: number; y: number }) => {
        setCrop(crop);
    };

    const onZoomChange = (zoom: number) => {
        setZoom(zoom);
    };

    const onCropCompleteCallback = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const createImage = (url: string): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
            const image = new Image();
            image.addEventListener('load', () => resolve(image));
            image.addEventListener('error', (error) => reject(error));
            image.setAttribute('crossOrigin', 'anonymous');
            image.src = url;
        });

    const getCroppedImg = async (imageSrc: string, pixelCrop: Area): Promise<string> => {
        const image = await createImage(imageSrc);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            return '';
        }

        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;

        ctx.drawImage(
            image,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            pixelCrop.width,
            pixelCrop.height
        );

        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    return resolve('');
                }
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => {
                    resolve(reader.result as string);
                };
            }, 'image/jpeg');
        });
    };

    const handleApplyCrop = async () => {
        try {
            if (!croppedAreaPixels) return;
            const croppedImage = await getCroppedImg(image, croppedAreaPixels);
            onCropComplete(croppedImage);
            onClose();
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Crop Image"
            maxWidth="md"
            footer={
                <div className="flex gap-4">
                    <Button variant="secondary" onClick={onClose} className="flex-1">
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleApplyCrop} className="flex-1">
                        Apply Crop
                    </Button>
                </div>
            }
        >
            <div className="relative w-full aspect-square bg-black/40 rounded-2xl overflow-hidden mb-6">
                <Cropper
                    image={image}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={onCropChange}
                    onCropComplete={onCropCompleteCallback}
                    onZoomChange={onZoomChange}
                />
            </div>
            
            <div className="space-y-4 px-2">
                <div className="flex items-center gap-4">
                    <Icon name="search" className="w-5 h-5 text-brand-text-muted" />
                    <input
                        type="range"
                        min={1}
                        max={3}
                        step={0.1}
                        value={zoom}
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        className="w-full h-2.5 bg-brand-primary/50 rounded-full appearance-none cursor-pointer accent-brand-accent border border-brand-surface shadow-inner"
                    />
                </div>
                <p className="text-body-xs text-center text-brand-text-muted italic">
                    Drag the image to position and use the slider to zoom
                </p>
            </div>
        </Modal>
    );
};
