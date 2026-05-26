import { registerPlugin } from '@capacitor/core';

export interface PetCareAppleSignInResult {
  identityToken: string;
  user?: string;
  email?: string | null;
  givenName?: string | null;
  familyName?: string | null;
}

export interface PetCareAppleSignInPlugin {
  signIn(): Promise<PetCareAppleSignInResult>;
}

const PetCareAppleSignIn = registerPlugin<PetCareAppleSignInPlugin>('PetCareAppleSignIn', {
  web: () => import('./petCareAppleSignIn.web').then((m) => m.default),
});

export default PetCareAppleSignIn;
