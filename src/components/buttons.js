// Shared button styles used across modals and screens.
const base =
  "text-white px-8 py-3 rounded-xl font-semibold cursor-pointer transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100";

export const primaryButton = `bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 ${base}`;
export const secondaryButton = `bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 ${base}`;
