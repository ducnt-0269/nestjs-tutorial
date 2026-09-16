declare global {
  namespace Express {
    interface User {
      id: number;
      token: string;
    }
  }
}

// Makes this file a module, which is what allows the augmentation above.
export {};
