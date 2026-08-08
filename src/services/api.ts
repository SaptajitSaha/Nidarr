import type { IncidentFormData, AnalysisResult } from '../types/incident';

const ANALYSIS_TIMEOUT_MS = 18_000;
export const ANALYSIS_TIMEOUT_MESSAGE = 'Analysis took too long. Please check your connection and try again.';

export async function analyseIncidentReport(data: IncidentFormData): Promise<AnalysisResult> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch('/api/analyse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(ANALYSIS_TIMEOUT_MESSAGE);
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }

  const responseData = await response.json();

  if (!response.ok) {
    throw new Error(
      responseData.error || 'Failed to analyze incident report. Please try again.'
    );
  }

  return responseData as AnalysisResult;
}
