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

export async function validateCVContent(cvText: string): Promise<ValidationResult> {
  try {
    console.log('[VALIDATION] Starting CV content analysis...');
    
    const prompt = `You are a CV content quality analyzer. Analyze the provided CV text and determine if it's appropriate and complete for generating a professional CV.

CV TEXT TO ANALYZE:
${cvText}

ANALYSIS CRITERIA:
1. Content completeness (name, contact info, experience, education, skills)
2. Professional appropriateness (no offensive content, no random text, no codes/indices)
3. Information quality (realistic professional details, not gibberish)
4. Structure and readability

RESPONSE FORMAT (JSON only):
{
  "isValid": boolean,
  "quality": "excellent" | "good" | "fair" | "poor",
  "confidence": number (0-1),
  "message": string (user-friendly explanation),
  "suggestions": [string] (improvement suggestions),
  "issues": [
    {
      "type": "missing_info" | "inappropriate_content" | "format_issue" | "quality_issue",
      "severity": "low" | "medium" | "high",
      "description": string,
      "suggestion": string
    }
  ]
}

EXAMPLE RESPONSES:
Good CV:
{
  "isValid": true,
  "quality": "good",
  "confidence": 0.85,
  "message": "Ваші дані виглядають чудово! Маю всю необхідну інформацію для створення професійного CV.",
  "suggestions": ["Можна додати більше деталей про досвід роботи"],
  "issues": []
}

Poor CV:
{
  "isValid": false,
  "quality": "poor",
  "confidence": 0.95,
  "message": "На жаль, надані дані містять неприйнятний контент або недостатньо інформації.",
  "suggestions": ["Будь ласка, надайте повну професійну інформацію"],
  "issues": [
    {
      "type": "inappropriate_content",
      "severity": "high",
      "description": "Виявлено непрофесійний контент",
      "suggestion": "Замініть inappropriate content на професійну інформацію"
    }
  ]
}

Analyze the CV and respond with JSON only.`;

    const response = await openrouter.chat.completions.create({
      model: "meta-llama/llama-3.3-70b-instruct",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2048,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '';
    
    // Clean up response and parse JSON
    const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?$/g, '').trim();
    
    try {
      const result = JSON.parse(jsonContent) as ValidationResult;
      
      // Validate result structure
      if (typeof result.isValid !== 'boolean' || !result.message) {
        throw new Error('Invalid validation result structure');
      }
      
      console.log('[VALIDATION] Analysis completed:', {
        isValid: result.isValid,
        quality: result.quality,
        confidence: result.confidence,
        issuesCount: result.issues?.length || 0
      });
      
      return result;
    } catch (parseError) {
      console.error('[VALIDATION] Failed to parse AI response:', parseError);
      console.error('[VALIDATION] Raw response:', content);
      
      // Fallback response
      return {
        isValid: false,
        quality: 'poor',
        confidence: 0.5,
        message: 'Не вдалося проаналізувати дані. Будь ласка, перевірте формат файлу.',
        suggestions: ['Перевірте, що файл містить текстову інформацію'],
        issues: [{
          type: 'format_issue',
          severity: 'medium',
          description: 'Problem parsing CV content',
          suggestion: 'Ensure the file contains readable text'
        }]
      };
    }
  } catch (error) {
    console.error('[VALIDATION] Error during validation:', error);
    
    return {
      isValid: false,
      quality: 'poor',
      confidence: 0.1,
      message: 'Сталася помилка під час аналізу даних. Спробуйте ще раз.',
      suggestions: ['Перевірте якість файлу та спробуйте завантажити знову'],
      issues: [{
        type: 'format_issue',
        severity: 'high',
        description: 'Validation system error',
        suggestion: 'Try uploading the file again'
      }]
    };
  }
}

export function generateUserFriendlyMessage(result: ValidationResult): string {
  if (result.isValid) {
    switch (result.quality) {
      case 'excellent':
        return '🎉 Ідеально! Ваші дані чудові, створюю професійне CV найвищої якості!';
      case 'good':
        return '✅ Дуже добре! Маю всю необхідну інформацію для створення якісного CV.';
      case 'fair':
        return '👍 Непогано! Створю CV, але наступного разу можна додати більше деталей.';
      default:
        return result.message;
    }
  } else {
    switch (result.quality) {
      case 'poor':
        return '❌ На жаль, дані непридатні. ' + result.message;
      case 'fair':
        return '⚠️ Дані потребують покращення. ' + result.message;
      default:
        return '❌ ' + result.message;
    }
  }
}

export function formatSuggestionsForUser(suggestions: string[]): string {
  if (!suggestions || suggestions.length === 0) {
    return '';
  }
  
  return '\n\n💡 Рекомендації:\n' + suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n');
}
