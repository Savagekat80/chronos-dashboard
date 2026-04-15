import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface TimelineEvent {
  date: string;
  title: string;
  description: string;
  theme: string;
  importance: 'low' | 'medium' | 'high';
  strategicImpact: string;
}

export interface ThematicGroup {
  theme: string;
  summary: string;
  events: TimelineEvent[];
}

export type DocumentCategory = 'PRIMARY' | 'RESEARCH' | 'BACKGROUND';

export interface CategorizedDocument {
  content: string;
  category: DocumentCategory;
  name: string;
  size: number; // in bytes
  deepMetadataAnalysis?: boolean;
  metadataAnalysisResult?: string;
  type?: string; // mime type or extension
}

export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'area';
  title: string;
  description: string;
  data: any[];
  xAxisKey?: string;
  yAxisKey?: string;
}

export interface AnalysisContext {
  state: string;
  field: string;
  lawTypes: string[];
  specificLaws: string;
  additionalContext: string;
}

export interface AnalysisResult {
  events: TimelineEvent[];
  themes: ThematicGroup[];
  masterReport: string;
  recommendations: string[];
  legalImplications: string[];
  attachments: string[];
  charts: ChartData[];
  metadataInsights?: {
    fileName: string;
    insights: string;
  }[];
}

export async function analyzeDocuments(
  documents: CategorizedDocument[],
  context: AnalysisContext,
  focusExplanation?: string
): Promise<AnalysisResult> {
  const primaryDocs = documents.filter(d => d.category === 'PRIMARY').map(d => `[FILE: ${d.name}]\n${d.content}`).join("\n\n");
  const researchDocs = documents.filter(d => d.category === 'RESEARCH').map(d => `[FILE: ${d.name}]\n${d.content}`).join("\n\n");
  const backgroundDocs = documents.filter(d => d.category === 'BACKGROUND').map(d => `[FILE: ${d.name}]\n${d.content}`).join("\n\n");
  
  const prompt = `Analyze the following set of documents which are categorized for context.
${documents.some(d => d.deepMetadataAnalysis) ? `
SPECIAL TASK: DEEP METADATA ANALYSIS REQUESTED
For documents marked with [METADATA_ANALYSIS: TRUE], perform a deep dive into their technical structure:
- For PDFs: Analyze for hidden metadata (author, creation tools, modification history) and potential "malicious coding" or structural anomalies that could impact report integrity.
- For Emails: Analyze headers for inaccuracies, spoofing indicators, or routing inconsistencies.
- Include these findings in the 'metadataInsights' section of the response.
` : ''}

ANALYSIS CONTEXT & FOCUS:
- Jurisdiction/State: ${context.state || 'Not specified'}
- Field of Analysis: ${context.field || 'General'}
- Pertinent Law Types: ${context.lawTypes.join(', ') || 'General'}
- Specific Laws/Citations to Focus On: ${context.specificLaws || 'None specified'}
- Additional Context: ${context.additionalContext || 'None'}
- USER FOCUS EXPLANATION: ${focusExplanation || 'None provided'}

PRIMARY DOCUMENTS (The core material to be analyzed):
${primaryDocs}

EXISTING RESEARCH & PRIOR ANALYSIS (Contextual analysis already performed):
${researchDocs}

BACKGROUND & HISTORICAL DATA (Supporting documentation for context):
${backgroundDocs}

TASKS:
1. Extract all significant events with their dates (use ISO format YYYY-MM-DD where possible, or best estimate).
2. For each event, provide a concise description AND a detailed strategic impact analysis explaining its connection to the overall case/research, specifically how it relates to the primary documents vs the background data.
3. Group these events into logical themes.
4. Generate a comprehensive, research-paper style report that synthesizes the primary analysis with the supporting research and background data. 
   - CRITICAL: Apply the lens of the specified Field of Analysis (${context.field}) and Jurisdiction (${context.state}).
   - CRITICAL: Incorporate the specified laws (${context.specificLaws}) and law types (${context.lawTypes.join(', ')}) into the legal implications and analysis.
5. Identify legal implications, next steps, and recommendations.
6. Suggest a list of accompanying attachments that would strengthen this report.
7. Generate 2-4 data visualizations (charts) that represent trends, distributions, or comparisons found in the data. Provide the data in a format suitable for Recharts.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [
      {
        text: prompt
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          events: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                theme: { type: Type.STRING },
                importance: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
                strategicImpact: { type: Type.STRING }
              },
              required: ['date', 'title', 'description', 'theme', 'importance', 'strategicImpact']
            }
          },
          themes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                theme: { type: Type.STRING },
                summary: { type: Type.STRING }
              },
              required: ['theme', 'summary']
            }
          },
          masterReport: { type: Type.STRING },
          recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
          legalImplications: { type: Type.ARRAY, items: { type: Type.STRING } },
          attachments: { type: Type.ARRAY, items: { type: Type.STRING } },
          metadataInsights: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                fileName: { type: Type.STRING },
                insights: { type: Type.STRING }
              },
              required: ['fileName', 'insights']
            }
          },
          charts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ['bar', 'line', 'pie', 'area'] },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                data: { type: Type.ARRAY, items: { type: Type.OBJECT } },
                xAxisKey: { type: Type.STRING },
                yAxisKey: { type: Type.STRING }
              },
              required: ['type', 'title', 'description', 'data']
            }
          }
        },
        required: ['events', 'themes', 'masterReport', 'recommendations', 'legalImplications', 'attachments', 'charts']
      }
    }
  });

  const result = JSON.parse(response.text || '{}') as any;
  
  // Map events to themes for the ThematicGroup structure
  const themesWithEvents = result.themes.map((t: any) => ({
    ...t,
    events: result.events.filter((e: any) => e.theme === t.theme)
  }));

  return {
    ...result,
    themes: themesWithEvents
  };
}

export async function generateComparison(
  itemA: string,
  itemB: string,
  context: AnalysisContext
): Promise<string> {
  const prompt = `Perform a detailed comparative analysis between the following two items/concepts within the context of ${context.field} in ${context.state}.

ITEM A:
${itemA}

ITEM B:
${itemB}

TASK:
Provide a structured comparison highlighting:
1. Key similarities and differences.
2. Strategic advantages/disadvantages of each.
3. Legal or regulatory implications specific to ${context.state}.
4. A final synthesis/recommendation on which approach or finding is more significant.

Format the output in clean Markdown.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [{ text: prompt }]
  });

  return response.text || '';
}
