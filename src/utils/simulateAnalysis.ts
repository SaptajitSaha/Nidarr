import type { IncidentFormData, AnalysisResult } from '../types/incident';

export function simulateIncidentAnalysis(data: IncidentFormData): AnalysisResult {
  const descLower = data.description.toLowerCase();
  
  // Calculate simulated severity score (1 to 5)
  let severity = 2; // Default baseline

  if (data.category === 'Assault') {
    severity = descLower.includes('weapon') || descLower.includes('injured') || descLower.includes('severe') ? 5 : 4;
  } else if (data.category === 'Stalking') {
    severity = descLower.includes('following') || descLower.includes('home') || descLower.includes('repeatedly') ? 4 : 3;
  } else if (data.category === 'Harassment') {
    severity = descLower.includes('threat') || descLower.includes('shouting') ? 3 : 2;
  } else if (data.category === 'Unsafe Infrastructure') {
    severity = descLower.includes('dark') || descLower.includes('broken light') || descLower.includes('caved') ? 3 : 2;
  } else if (data.category === 'Suspicious Activity') {
    severity = descLower.includes('loitering') || descLower.includes('car') ? 3 : 2;
  } else {
    severity = descLower.length > 80 ? 3 : 2;
  }

  // Generate a clean concise summary
  let summary = '';
  const locationText = data.location.trim() ? ` near ${data.location.trim()}` : '';
  
  if (data.description.trim().length > 0) {
    const trimmedDesc = data.description.trim();
    const snippet = trimmedDesc.length > 90 ? `${trimmedDesc.substring(0, 87)}...` : trimmedDesc;
    summary = `Reported ${data.category.toLowerCase()}${locationText}: "${snippet}"`;
  } else {
    summary = `Incident of ${data.category.toLowerCase()}${locationText} logged by user for community safety review.`;
  }

  return {
    category: data.category,
    severity,
    summary,
    requiresVerification: true, // Always true for reported incidents as per requirements
  };
}
