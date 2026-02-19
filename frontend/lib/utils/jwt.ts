// Example fix for lib/utils/jwt.ts
export const getStoredToken = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("token");
  }
  return null;
};