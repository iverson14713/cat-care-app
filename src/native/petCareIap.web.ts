import type { PetCareIapPlugin } from './petCareIap';

const PetCareIapWeb: PetCareIapPlugin = {
  async getProducts() {
    return { products: [] };
  },
  async purchase() {
    throw new Error('IAP_NOT_AVAILABLE');
  },
  async restorePurchases() {
    throw new Error('IAP_NOT_AVAILABLE');
  },
  async getEntitlements() {
    return { isActive: false };
  },
};

export default PetCareIapWeb;
