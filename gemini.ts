import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface TimelineEvent {
  date: string;
  title: string;
  description: string;
  category: string;
  subCategory: string;
  importance: 'low' | 'medium' | 'high';
  strategicImpact: string;
}

export interface ThematicGroup {
  category: string;
  summary: string;
  events: TimelineEvent[];
}

export type DocumentCategory = 'PRIMARY' | 'RESEARCH' | 'BACKGROUND';

export interface CategorizedDocument {
  content: string;
  category: DocumentCategory;
  name: string;
  size: number; // in bytes
  hash: string;
  pageCount?: number;
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

export interface CaseRef {
  label: string;
  value: string;
}

export interface AnalysisContext {
  state: string;
  field: string;
  lawTypes: string[];
  specificLaws: string;
  additionalContext: string;
  adminName?: string;
  caseRefs?: CaseRef[];
}

export interface IntelligenceData {
  researchReports: string[];
  legalAnalysis: string[];
  actionSteps: {
    step: string;
    priority: 'low' | 'medium' | 'high';
  }[];
}

export interface AnalysisResult {
  events: TimelineEvent[];
  categories: ThematicGroup[];
  masterReport: string;
  recommendations: string[];
  legalImplications: string[];
  attachments: string[];
  charts: ChartData[];
  intelligence: IntelligenceData;
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
  const processDoc = (d: CategorizedDocument) => {
    if (d.content.startsWith('data:image/')) {
      return `[IMAGE_FILE: ${d.name}] (Image attached as part of analysis)`;
    }
    return `[FILE: ${d.name}]\n${d.content}`;
  };

  const primaryDocs = documents.filter(d => d.category === 'PRIMARY').map(processDoc).join("\n\n");
  const researchDocs = documents.filter(d => d.category === 'RESEARCH').map(processDoc).join("\n\n");
  const backgroundDocs = documents.filter(d => d.category === 'BACKGROUND').map(processDoc).join("\n\n");
  
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
- Admin/Analyst Name: ${context.adminName || 'Admin_01'}
- Case References: ${context.caseRefs?.map(r => `${r.label}: ${r.value}`).join(', ') || 'None'}

PRIMARY DOCUMENTS (The core material to be analyzed):
${primaryDocs}

EXISTING RESEARCH & PRIOR ANALYSIS (Contextual analysis already performed):
${researchDocs}

BACKGROUND & HISTORICAL DATA (Supporting documentation for context):
${backgroundDocs}

TASKS:
1. Extract all significant events with their dates (use ISO format YYYY-MM-DD where possible, or best estimate).
2. For each event, provide a concise description AND a detailed strategic impact analysis explaining its connection to the overall case/research.
3. Group these events into EXACTLY 7 logical categories. Each event MUST belong to one of these 7 categories. Provide a 'subCategory' for each event to drill down further.
4. Generate a comprehensive, research-paper style report that synthesizes the primary analysis with the supporting research and background data. 
   - CRITICAL: Apply the lens of the specified Field of Analysis (${context.field}) and Jurisdiction (${context.state}).
   - CRITICAL: Incorporate the specified laws (${context.specificLaws}) and law types (${context.lawTypes.join(', ')}) into the legal implications and analysis.
5. Identify legal implications, next steps, and recommendations.
6. Suggest a list of accompanying attachments that would strengthen this report.
7. Generate 2-4 data visualizations (charts) that represent trends, distributions, or comparisons found in the data. Provide the data in a format suitable for Recharts.
8. Populate the 'intelligence' section with detailed research reports, legal analysis, and prioritized action steps.

RESPONSE FORMAT:
You MUST return a JSON object matching the requested schema.`;

  const parts: any[] = [{ text: prompt }];

  // Add images as inlineData parts
  documents.forEach(doc => {
    if (doc.content.startsWith('data:image/')) {
      const [header, base64] = doc.content.split(',');
      const mimeType = header.split(':')[1].split(';')[0];
      // Gemini supports these image formats
      const supportedMimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];
      
      if (supportedMimeTypes.includes(mimeType)) {
        parts.push({
          inlineData: {
            data: base64,
            mimeType: mimeType
          }
        });
      }
    }
  });

  console.log("Starting analysis with prompt length:", prompt.length, "and", parts.length - 1, "images");
  
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [{ parts }],
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
                category: { type: Type.STRING },
                subCategory: { type: Type.STRING },
                importance: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
                strategicImpact: { type: Type.STRING }
              },
              required: ['date', 'title', 'description', 'category', 'subCategory', 'importance', 'strategicImpact']
            }
          },
          categories: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                summary: { type: Type.STRING }
              },
              required: ['category', 'summary']
            }
          },
          masterReport: { type: Type.STRING },
          recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
          legalImplications: { type: Type.ARRAY, items: { type: Type.STRING } },
          attachments: { type: Type.ARRAY, items: { type: Type.STRING } },
          intelligence: {
            type: Type.OBJECT,
            properties: {
              researchReports: { type: Type.ARRAY, items: { type: Type.STRING } },
              legalAnalysis: { type: Type.ARRAY, items: { type: Type.STRING } },
              actionSteps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    step: { type: Type.STRING },
                    priority: { type: Type.STRING, enum: ['low', 'medium', 'high'] }
                  },
                  required: ['step', 'priority']
                }
              }
            },
            required: ['researchReports', 'legalAnalysis', 'actionSteps']
          },
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
        required: ['events', 'categories', 'masterReport', 'recommendations', 'legalImplications', 'attachments', 'charts', 'intelligence']
      }
    }
  });

  let rawText = response.text || '';
  // Strip markdown code blocks if present
  if (rawText.startsWith('```')) {
    rawText = rawText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const result = JSON.parse(rawText) as any;
    console.log("Analysis result parsed successfully");
    
    // Map events to categories for the ThematicGroup structure
    const categoriesWithEvents = (result.categories || []).map((c: any) => ({
      ...c,
      events: (result.events || []).filter((e: any) => e.category === c.category)
    }));

    return {
      ...result,
      categories: categoriesWithEvents
    };
  } catch (e) {
    console.error("Failed to parse Gemini response:", e);
    console.log("Raw response text:", rawText);
    throw new Error("Failed to process analysis results. Please try again.");
  }
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
    contents: [{ parts: [{ text: prompt }] }]
  });

  return response.text || '';
}
