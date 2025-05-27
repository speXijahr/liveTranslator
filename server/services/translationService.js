// server/services/translationService.js
const { translator, DEEPL_TARGET_LANGUAGES, isDeeplConfigured } = require('../config/deeplConfig');

// Helper to map client-side language codes (e.g., Web Speech API) to DeepL source language codes
function mapToDeepLSourceLang(clientLang) {
    const langMap = {
        'en-US': 'EN', // DeepL uses 'EN' for English, not 'EN-US' as a source usually
        'it-IT': 'IT',
        'cs-CZ': 'CS',
        // Add other mappings as needed
    };
    // Return the mapped value, or the original if not in map (DeepL might handle some variations)
    // Or be stricter: return langMap[clientLang] || null; and handle null upstream
    return langMap[clientLang] || clientLang.substring(0, 2).toUpperCase(); // Fallback to 2-letter code
}

 // Helper to map DeepL target language codes to a consistent client-side format if needed
 // For now, let's assume client can handle DEEPL_TARGET_LANGUAGES directly.
 // Example: If DeepL returns 'EN' but client expects 'EN-US' for display.
 // function mapFromDeepLTargetLang(deepLLang) { ... }


async function translateTextToAllTargets(text, sourceClientLang) {
    if (!isDeeplConfigured || !translator) {
        console.warn('DeepL translator not configured. Skipping translation.');
        const noTranslationResult = {};
        DEEPL_TARGET_LANGUAGES.forEach(lang => {
            noTranslationResult[lang] = { text: text, error: 'Translation service not configured.' };
        });
        return noTranslationResult;
    }

    const translations = {};
    const sourceLangDeepL = mapToDeepLSourceLang(sourceClientLang);

    for (const targetLang of DEEPL_TARGET_LANGUAGES) {
        if (targetLang.startsWith(sourceLangDeepL) || sourceLangDeepL.startsWith(targetLang)) { // Basic check if source is essentially the target
            translations[targetLang] = { text: text }; // Original text for source language
            continue;
        }

        try {
            // console.log(`Translating from ${sourceLangDeepL} to <span class="math-inline">\{targetLang\} for text\: "</span>{text.substring(0,20)}..."`);
            const result = await translator.translateText(text, sourceLangDeepL, targetLang);
            translations[targetLang] = { text: result.text };
        } catch (error) {
            console.error(`Error translating "${text.substring(0,20)}..." from ${sourceLangDeepL} to ${targetLang}:`, error.message);
            translations[targetLang] = { error: error.message, text: text }; // Return original text on error
        }
    }
    return translations;
}

module.exports = {
    translateTextToAllTargets,
    mapToDeepLSourceLang,
};