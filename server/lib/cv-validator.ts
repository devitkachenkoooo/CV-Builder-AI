import OpenAI from 'openai';

// Configure OpenRouter client
const openrouter = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY,
});

export interface ValidationResult {
  isValid: boolean;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  message: string;
  suggestions?: string[];
  confidence: number;
  issues?: ValidationIssue[];
}

export interface ValidationIssue {
  type: 'missing_info' | 'inappropriate_content' | 'format_issue' | 'quality_issue';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion?: string;
}

export async function validateCVContent(cvText: string, lang: 'ua' | 'en' = 'ua'): Promise<ValidationResult> {
  try {
    const textSnippet = cvText.trim();
    console.log(`[VALIDATION] Starting CV content analysis. Text length: ${textSnippet.length} chars, Language: ${lang}`);

    if (textSnippet.length < 50) {
      console.log('[VALIDATION] Content too short for meaningful analysis');
      const shortMsg = lang === 'ua'
        ? 'Текст резюме занадто короткий. Будь ласка, додайте більше професійної інформації.'
        : 'CV text is too short. Please add more professional information.';

      return {
        isValid: false,
        quality: 'poor',
        confidence: 1,
        message: shortMsg,
        issues: [{
          type: 'quality_issue',
          severity: 'high',
          description: 'Document content is too sparse',
          suggestion: 'Provide more details about your experience and skills'
        }]
      };
    }

    const languageName = lang === 'ua' ? 'Ukrainian' : 'English';
    const prompt = `You are a professional CV analyzer. Your goal is to determine if the provided text looks like a CV or contains information that can be used to generate a CV.

CV TEXT TO ANALYZE:
"""
${cvText}
"""

VALIDATION RULES:
1. "isValid" should be TRUE if the text contains any professional info: names, contact info, skills, work experience, or education.
2. "isValid" should be FALSE ONLY if the text is:
   - Completely random chars (gibberish)
   - Extremely offensive or inappropriate
   - A completely different type of document (e.g., a cooking recipe, a fictional story, technical manual for a car) with NO personal info.
3. Be lenient. If it looks like a rough draft of a CV, it IS valid.

RESPONSE FORMAT (Return ONLY a raw JSON object):
{
  "isValid": boolean,
  "quality": "excellent" | "good" | "fair" | "poor",
  "confidence": number,
  "message": "Simple explanation in ${languageName}",
  "suggestions": ["suggestion in ${languageName}"],
  "issues": [
    {
      "type": "missing_info" | "quality_issue" | "inappropriate_content",
      "severity": "low" | "medium" | "high",
      "description": "Short description in English",
      "suggestion": "How to fix in English"
    }
  ]
}

Respond with JSON only.`;

    const response = await openrouter.chat.completions.create({
      model: "meta-llama/llama-3.3-70b-instruct",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2048,
      temperature: 0.1, // Lower temperature for more stable JSON
    });

    const content = response.choices[0]?.message?.content || '';
    console.log('[VALIDATION] Raw AI response received');

    // Improved JSON extraction: find the first '{' and last '}'
    const startIndex = content.indexOf('{');
    const endIndex = content.lastIndexOf('}');

    if (startIndex === -1 || endIndex === -1) {
      throw new Error(`No JSON object found in response: ${content.substring(0, 100)}...`);
    }

    const jsonStr = content.substring(startIndex, endIndex + 1);

    try {
      const result = JSON.parse(jsonStr) as ValidationResult;

      // Basic structure validation
      if (typeof result.isValid !== 'boolean') {
        throw new Error('Missing "isValid" field in response');
      }

      console.log('[VALIDATION] Analysis result:', {
        isValid: result.isValid,
        quality: result.quality,
        confidence: result.confidence
      });

      return result;
    } catch (parseError) {
      console.error('[VALIDATION] JSON Parse Error:', parseError);
      console.error('[VALIDATION] Culprit string:', jsonStr);
      throw parseError;
    }
  } catch (error) {
    console.error('[VALIDATION] System Error:', error);

    const fallbackMsg = lang === 'ua'
      ? 'Завантаження успішне. Починаємо обробку.'
      : 'Upload successful. Starting processing.';

    const fallbackSuggestion = lang === 'ua'
      ? 'Система валідації тимчасово недоступна, але ми спробуємо створити ваше CV.'
      : 'Validation system is temporarily unavailable, but we will try to create your CV.';

    return {
      isValid: true,
      quality: 'fair',
      confidence: 0.5,
      message: fallbackMsg,
      suggestions: [fallbackSuggestion],
      issues: []
    };
  }
}

export function generateUserFriendlyMessage(result: ValidationResult, lang: 'ua' | 'en' = 'ua'): string {
  if (result.isValid) {
    switch (result.quality) {
      case 'excellent':
        return lang === 'ua'
          ? '🎉 Ідеально! Ваші дані чудові, створюю професійне CV найвищої якості!'
          : '🎉 Perfect! Your data is great, creating a professional CV of the highest quality!';
      case 'good':
        return lang === 'ua'
          ? '✅ Дуже добре! Маю всю необхідну інформацію для створення якісного CV.'
          : '✅ Very good! I have all the necessary information to create a high-quality CV.';
      case 'fair':
        return lang === 'ua'
          ? '👍 Непогано! Створю CV, але наступного разу можна додати більше деталей.'
          : '👍 Not bad! I\'ll create the CV, but next time you could add more details.';
      default:
        return result.message;
    }
  } else {
    const errorPrefix = lang === 'ua' ? '❌ На жаль, дані непридатні. ' : '❌ Unfortunately, the data is not suitable. ';
    const warningPrefix = lang === 'ua' ? '⚠️ Дані потребують покращення. ' : '⚠️ Data needs improvement. ';

    switch (result.quality) {
      case 'poor':
        return errorPrefix + result.message;
      case 'fair':
        return warningPrefix + result.message;
      default:
        return '❌ ' + result.message;
    }
  }
}

export function formatSuggestionsForUser(suggestions: string[], lang: 'ua' | 'en' = 'ua'): string {
  if (!suggestions || suggestions.length === 0) {
    return '';
  }

  const label = lang === 'ua' ? 'Рекомендації' : 'Suggestions';
  return `\n\n💡 ${label}:\n` + suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n');
}
