import { ChatOpenAI } from '@langchain/openai';
import { TavilySearchAPIRetriever } from '@langchain/community/retrievers/tavily_search_api';
import { z } from 'zod';

const DEFAULT_SEARCH_QUERIES = [
  '{company} company ceo',
  '{company} headquarters location',
  '{company} official website',
  '{company} LinkedIn profile',
  '{company} company description business',
  '{company} recent news',
];

const NewsStorySchema = z.object({
  headline: z.string().describe('News headline'),
  date: z.string().describe('Date of the news story'),
  url: z.string().describe('URL link to the news article'),
});

const CompanyInfoSchema = z.object({
  company_name: z.string().describe('Official name of the company'),
  ceo: z.string().optional().describe('Name of the current CEO or chief executive'),
  website: z.string().optional().describe('Official company website URL'),
  linkedin_url: z.string().optional().describe('Company LinkedIn profile URL'),
  description: z.string().optional().describe('Brief description of what the company does'),
  headquarters: z.string().optional().describe('Location of the company headquarters'),
  latest_news_stories: z.array(NewsStorySchema).optional().describe('Recent news stories about the company'),
});

export type CompanyInfo = z.infer<typeof CompanyInfoSchema>;

type SearchResult = {
  title: string;
  content: string;
  url: string;
};

// Initialize LangChain components
const llm = new ChatOpenAI({
  model: 'gpt-4.1-nano',
});

/**
 * Generate search queries for company research
 */
function generateQueries(company: string): string[] {
  return DEFAULT_SEARCH_QUERIES.map((query) =>
    query.replace('{company}', company)
  );
}

/**
 * Perform web search using Tavily API via LangChain
 */
async function searchTavily(query: string, maxResults = 3): Promise<SearchResult[]> {
  const retriever = new TavilySearchAPIRetriever({
    k: maxResults,
    includeRawContent: true,
    apiKey: process.env.TAVILY_API_KEY,
  });

  try {
    const documents = await retriever.invoke(query);
    
    return documents.map((doc: any) => ({
      title: doc.metadata?.title || '',
      content: doc.pageContent || '',
      url: doc.metadata?.source || '',
    }));
  } catch (error) {
    console.error(`Tavily search failed for query "${query}":`, error);
    return [];
  }
}

/**
 * Execute concurrent web searches
 */
async function researchCompany(company: string, maxResults = 1): Promise<SearchResult[]> {
  const queries = generateQueries(company);
  const searchPromises = queries.map((query) => searchTavily(query, maxResults));
  const searchResults = await Promise.all(searchPromises);

  // Flatten and deduplicate results
  const allResults = searchResults.flat();
  const seen = new Set<string>();
  const deduplicated: SearchResult[] = [];

  for (const result of allResults) {
    if (!seen.has(result.url)) {
      seen.add(result.url);
      deduplicated.push(result);
    }
  }

  return deduplicated;
}

/**
 * Extract structured company information from search results
 */
async function extractCompanyInfo(company: string, searchResults: SearchResult[]): Promise<CompanyInfo> {
  const searchContext = searchResults
    .map((result, idx) => `[${idx + 1}] ${result.title}\n${result.content.slice(0, 3000)}...\nURL: ${result.url}`)
    .join('\n\n');

  const systemPrompt = `You are an expert at extracting structured information about companies from search results.
Populate every field using the best available facts.
Extract the following information from the search results:
- company_name: Official name of the company
- ceo: Name of the current CEO or chief executive
- website: Official company website URL
- linkedin_url: Company LinkedIn profile URL
- description: Brief description of what the company does and its main business
- headquarters: Location of the company headquarters (city, state/country)
- latest_news_stories: Exactly two news stories about the company from the past 6 months (with headline, date, and url)

Search Results:
${searchContext}

Return the information in the specified schema format. Only include fields where you found reliable information.`;

  // Use LangChain's structured output with Zod schema
  const structuredLlm = llm.withStructuredOutput(CompanyInfoSchema, {
    name: 'company_info_extraction',
  });

  const extracted = await structuredLlm.invoke([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'Extract the company information from the search results.' },
  ]);

  return extracted;
}

/**
 * Main function to research a company
 */
export async function performCompanyResearch(company: string): Promise<CompanyInfo> {
  const searchResults = await researchCompany(company, 3);
  const companyInfo = await extractCompanyInfo(company, searchResults);
  return companyInfo;
}

