import type { PetCareAppleSignInPlugin } from './petCareAppleSignIn';

const PetCareAppleSignInWeb: PetCareAppleSignInPlugin = {
  async signIn() {
    throw new Error('PetCareAppleSignIn is only available on iOS');
  },
};

export default PetCareAppleSignInWeb;
