// Determine the server URL based on environment
export const SERVER_URL = process.env.NODE_ENV === 'production'
  ? window.location.origin  // Use the same origin in production
  : 'http://localhost:8080'; // Use localhost in development

// Define language options centrally
export const SPEAKER_LANGUAGES = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'it-IT', label: 'Italian' },
  { value: 'cs-CZ', label: 'Czech' },
  // Add more speaker languages as needed
];
export const DEFAULT_SPEAKER_LANG = SPEAKER_LANGUAGES[0].value;

export const VIEWER_LANGUAGES = [
  { value: '', label: 'Original Language' }, // Option to view original
  { value: 'EN-US', label: 'English (US)' },
  { value: 'IT', label: 'Italian' },
  { value: 'CS', label: 'Czech' },
  // Add more viewer languages as needed
];
export const DEFAULT_VIEWER_LANG = VIEWER_LANGUAGES[0].value;