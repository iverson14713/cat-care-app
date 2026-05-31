import { registerPlugin } from '@capacitor/core';

export type PetCareShareResult = {
  shared: boolean;
  cancelled?: boolean;
};

export interface PetCareSharePlugin {
  shareFile(options: {
    base64Data: string;
    filename: string;
    mimeType?: string;
  }): Promise<PetCareShareResult>;
  shareText(options: { title?: string; text: string }): Promise<PetCareShareResult>;
}

const PetCareShare = registerPlugin<PetCareSharePlugin>('PetCareShare', {
  web: () => import('./petCareShare.web').then((m) => m.default),
});

export default PetCareShare;
