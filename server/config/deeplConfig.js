// server/config/deeplConfig.js
require('dotenv').config();
const deepl = require('deepl-node');

const DEEPL_AUTH_KEY = process.env.DEEPL_AUTH_KEY;

if (!DEEPL_AUTH_KEY && process.env.NODE_ENV !== 'test') { // Added test env check
    console.warn("DEEPL_AUTH_KEY environment variable not set. Translation will not work.");
}

const translator = DEEPL_AUTH_KEY ? new deepl.Translator(DEEPL_AUTH_KEY) : null;

// Supported languages for translation (DeepL format)
// Ensure these match what your translationService expects
const SUPPORTED_LANGUAGES_DEEPL = ['EN-US', 'IT', 'CS']; // Keep as original format if service maps
const DEEPL_TARGET_LANGUAGES = ['EN-US', 'IT', 'CS']; // Assuming these are the codes DeepL expects for target


module.exports = {
    translator,
    SUPPORTED_LANGUAGES_DEEPL, // Or the mapped versions if you prefer
    DEEPL_TARGET_LANGUAGES,
    isDeeplConfigured: !!DEEPL_AUTH_KEY,
};