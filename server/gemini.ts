import { GoogleGenAI, Type } from '@google/genai';
import { GEMINI_MODEL, ALLOWED_CATEGORIES, SYSTEM_INSTRUCTIONS, AllowedCategory } from './config.js';

export interface IncidentReportInput {
  category: string;
  description: string;
  location: string;
}

export interface ValidatedAnalysisResult {
  category: AllowedCategory;
  severity: number;
  timeContext: string;
  location: string;
  summary: string;
  isSafetyRelevant: boolean;
  requiresVerification: boolean;
}

export async function analyseIncidentWithGemini(
  input: IncidentReportInput
): Promise<ValidatedAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_key_here') {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const promptContent = `
Incident Category selected by user: ${input.category || 'Unspecified'}
Provided Location: ${input.location || 'Unspecified'}
Incident Description: ${input.description}
`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      category: {
        type: Type.STRING,
        description: 'Incident category: Harassment, Stalking, Assault, Suspicious Activity, Unsafe Infrastructure, or Other',
      },
      severity: {
        type: Type.INTEGER,
        description: 'Severity level from 1 to 5',
      },
      timeContext: {
        type: Type.STRING,
        nullable: true,
        description: 'Time context mentioned in report, or null if omitted',
      },
      location: {
        type: Type.STRING,
        nullable: true,
        description: 'Approximate location described in report, or null if omitted',
      },
      summary: {
        type: Type.STRING,
        description: 'Short neutral summary of the incident in English',
      },
      isSafetyRelevant: {
        type: Type.BOOLEAN,
        description: 'Whether the submission is relevant to personal or community safety',
      },
      requiresVerification: {
        type: Type.BOOLEAN,
        description: 'Whether human or community verification is required',
      },
    },
    required: ['category', 'severity', 'summary', 'isSafetyRelevant', 'requiresVerification'],
  };

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: promptContent,
    config: {
      systemInstruction: SYSTEM_INSTRUCTIONS,
      responseMimeType: 'application/json',
      responseSchema: responseSchema,
      temperature: 0.2,
    },
  });

  const responseText = response.text;
  if (!responseText) {
    throw new Error('Empty response received from Gemini model.');
  }

  let rawJson: any;
  try {
    rawJson = JSON.parse(responseText);
  } catch (err) {
    throw new Error('Failed to parse Gemini response as JSON.');
  }

  // --- COMPREHENSIVE 7-FIELD VALIDATION & NORMALIZATION ---

  // 1. Validate Category (Must be one of the 6 allowed values; fallback to "Other" if invalid)
  let validatedCategory: AllowedCategory = 'Other';
  if (typeof rawJson.category === 'string' && ALLOWED_CATEGORIES.includes(rawJson.category as AllowedCategory)) {
    validatedCategory = rawJson.category as AllowedCategory;
  } else {
    validatedCategory = 'Other';
  }

  // 2. Validate Severity (Integer 1 to 5)
  let validatedSeverity = 2;
  if (typeof rawJson.severity === 'number') {
    validatedSeverity = Math.max(1, Math.min(5, Math.round(rawJson.severity)));
  }

  // 3. Normalize timeContext (Null/empty -> "Unknown")
  let validatedTimeContext = 'Unknown';
  if (typeof rawJson.timeContext === 'string' && rawJson.timeContext.trim().length > 0) {
    validatedTimeContext = rawJson.timeContext.trim();
  }

  // 4. Normalize location (Null/empty -> "Unknown")
  let validatedLocation = 'Unknown';
  if (typeof rawJson.location === 'string' && rawJson.location.trim().length > 0) {
    validatedLocation = rawJson.location.trim();
  } else if (input.location && input.location.trim().length > 0) {
    validatedLocation = input.location.trim();
  }

  // 5. Validate Summary
  let validatedSummary = 'No summary provided.';
  if (typeof rawJson.summary === 'string' && rawJson.summary.trim().length > 0) {
    validatedSummary = rawJson.summary.trim();
  }

  // 6. Validate isSafetyRelevant
  const validatedIsSafetyRelevant = typeof rawJson.isSafetyRelevant === 'boolean' ? rawJson.isSafetyRelevant : true;

  // 7. Validate requiresVerification
  const validatedRequiresVerification = typeof rawJson.requiresVerification === 'boolean' ? rawJson.requiresVerification : true;

  return {
    category: validatedCategory,
    severity: validatedSeverity,
    timeContext: validatedTimeContext,
    location: validatedLocation,
    summary: validatedSummary,
    isSafetyRelevant: validatedIsSafetyRelevant,
    requiresVerification: validatedRequiresVerification,
  };
}
