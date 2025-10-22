import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { performCompanyResearch } from './research.js';
import type { CompanyInfo } from './research.js';
import packageJson from '../package.json' assert { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appVersion =
  typeof packageJson.version === 'string' && packageJson.version.length > 0
    ? packageJson.version
    : '0.0.0';

const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const WIDGET_RESOURCE_URI = 'ui://widget/company-card.html';

const readPublicAsset = (filename: string): string => {
  const filePath = path.join(PUBLIC_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Expected public asset missing: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
};

const STYLES_PLACEHOLDER = /<link\s+rel="stylesheet"\s+href="\/styles\.css"\s*\/?>/i;
const SCRIPT_PLACEHOLDER = /<script\s+type="module"\s+src="\/app\.js"><\/script>/i;

const buildWidgetHtml = (): string => {
  const rawHtml = readPublicAsset('index.html');
  const css = readPublicAsset('styles.css');
  const js = readPublicAsset('app.js');

  if (!STYLES_PLACEHOLDER.test(rawHtml) || !SCRIPT_PLACEHOLDER.test(rawHtml)) {
    throw new Error('index.html must reference /styles.css and /app.js for widget inlining.');
  }

  return rawHtml
    .replace(STYLES_PLACEHOLDER, `<style>\n${css}\n</style>`)
    .replace(SCRIPT_PLACEHOLDER, `<script type="module">\n${js}\n</script>`);
};

let cachedWidgetHtml: string | null = null;

const getWidgetHtml = (): string => {
  if (process.env.NODE_ENV === 'development') {
    return buildWidgetHtml();
  }

  if (!cachedWidgetHtml) {
    cachedWidgetHtml = buildWidgetHtml();
  }

  return cachedWidgetHtml;
};

const widgetMeta: Record<string, unknown> = {
  'openai/outputTemplate': WIDGET_RESOURCE_URI,
  'openai/toolInvocation/invoking': 'Researching company...',
  'openai/toolInvocation/invoked': 'Company research complete',
  'openai/widgetAccessible': true,
  'openai/resultCanProduceWidget': true,
  'openai/widgetTitle': 'Company Research',
  'openai/widgetPrefersBorder': true,
  'openai/widgetDescription':
    'Renders an interactive card displaying comprehensive company information including company name, CEO, headquarters, website, LinkedIn profile, company logo, description, and latest news stories.',
  'openai/widgetCSP': {
    connect_domains: [],
    resource_domains: [],
  },
};

const companySchema = z.string().min(1).describe('Name of the company to research');

const newsStorySchema = z.object({
  headline: z.string(),
  date: z.string(),
});

const companyInfoSchema = z.object({
  company_name: z.string(),
  ceo: z.string().optional(),
  website: z.string().optional(),
  logourl: z.string().optional(),
  linkedin_url: z.string().optional(),
  description: z.string().optional(),
  headquarters: z.string().optional(),
  latest_news_stories: z.array(newsStorySchema).optional(),
});

const server = new McpServer(
  {
    name: 'company-researcher',
    version: appVersion,
  },
  {
    instructions:
      'Use the research_company tool to retrieve comprehensive information about any company including CEO, headquarters, website, and latest news.',
  }
);

server.registerResource(
  'company-research-widget',
  WIDGET_RESOURCE_URI,
  {
    description: 'Skybridge widget template for the Company Research card.',
    mimeType: 'text/html+skybridge',
    _meta: widgetMeta,
  },
  async () => ({
    contents: [
      {
        uri: WIDGET_RESOURCE_URI,
        mimeType: 'text/html+skybridge',
        text: getWidgetHtml(),
        _meta: widgetMeta,
      },
    ],
  })
);

server.registerTool(
  'research_company',
  {
    title: 'Research Company',
    description:
      'Research a company and return comprehensive structured information including company name, CEO, website, LinkedIn, description, headquarters, logo, and latest news stories.',
    inputSchema: {
      company: companySchema,
    },
    outputSchema: {
      company_info: companyInfoSchema,
    },
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: true,
    },
    _meta: widgetMeta,
  },
  async ({ company }) => {
    const companyName = companySchema.parse(company);
    const companyInfo = await performCompanyResearch(companyName);

    const summary = `Successfully researched ${companyInfo.company_name}. Found information about CEO, headquarters, and latest news.`;

    return {
      content: [
        {
          type: 'text',
          text: summary,
        },
      ],
      structuredContent: {
        company_info: companyInfo,
      },
      _meta: widgetMeta,
    };
  }
);

const app = express();
app.use(express.json());
app.use(express.static('public'));

app.get('/widget.html', (_req, res) => {
  try {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(getWidgetHtml());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate widget markup';
    res.status(500).send(message);
  }
});

app.post('/api/research', async (req, res) => {
  try {
    const company = req.body.company;
    if (!company || typeof company !== 'string') {
      res.status(400).json({ error: 'Missing or invalid company parameter' });
      return;
    }
    const data = await performCompanyResearch(company);
    res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    res.status(500).json({ error: message });
  }
});

app.post('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on('close', () => {
    transport.close().catch((error) => {
      console.error('Error closing transport:', error);
    });
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('MCP transport error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'MCP server error' });
    }
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const listener = app.listen(port, () => {
  console.log('='.repeat(70));
  console.log('Company Researcher - MCP Server');
  console.log('='.repeat(70));
  console.log(`\nServer running at: http://localhost:${port}`);
  console.log(`MCP endpoint:      http://localhost:${port}/mcp`);
  console.log(`\nFor ChatGPT integration, expose this server with ngrok:`);
  console.log(`  ngrok http ${port}`);
  console.log(`\nThen configure in ChatGPT Developer Mode:`);
  console.log(`  URL: https://YOUR-SUBDOMAIN.ngrok.app/mcp`);
  console.log(`\nEnvironment variables:`);
  console.log(`  OPENAI_API_KEY:   ${process.env.OPENAI_API_KEY ? 'Set' : 'NOT SET'}`);
  console.log(`  TAVILY_API_KEY:   ${process.env.TAVILY_API_KEY ? 'Set' : 'NOT SET'}`);
  console.log('='.repeat(70));
});

const gracefulShutdown = async () => {
  console.log('\nShutting down server...');
  listener.close();
  await server.close().catch((error) => {
    console.error('Error closing MCP server:', error);
  });
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

