## ChatGPT App - Tavily Company Lookup
This repository includes a **ChatGPT App SDK** implementation that lets you research companies directly in ChatGPT powered by Tavily Search. 

### Tavily Search

This app uses the **Tavily Search API** to provide fast and reliable access to real-time web search results. Tavily is a developer-friendly API for searching the internet, specializing in up-to-date information from trusted sources.

### What is the ChatGPT App SDK?
The ChatGPT App SDK lets you build custom apps that run directly inside ChatGPT on web and mobile. Apps can provide rich, interactive experiences and tap into ChatGPT's **800 million weekly active users** — providing massive distribution potential.

<img width="1248" height="814" alt="image" src="https://github.com/user-attachments/assets/4880c3f5-277d-4b92-ad97-6d96128fead3" />
<img width="1243" height="886" alt="image" src="https://github.com/user-attachments/assets/2c117740-f922-4682-8d96-1871e226899c" />

### MCP Server
This app runs as an MCP (Model Context Protocol) server that connects to ChatGPT, enabling the research functionality through natural conversation.

### Mobile Version 
<img width="1179" height="2556" alt="image" src="https://github.com/user-attachments/assets/be51e48d-5bde-4493-84f9-a0c97092d1da" />


### Setup
1. Copy `.env.example` to `.env` and add your [Tavily Search API key](https://app.tavily.com/) and [OpenAI API key](https://platform.openai.com/):
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set:
   ```
   TAVILY_API_KEY=your-tavily-api-key
   OPENAI_API_KEY=your-openai-api-key
   ```

1. Install dependencies and start the server:
```bash
npm run dev
```

2. Expose your local server using ngrok:
```bash
ngrok http 3000
```

3. In ChatGPT, enable developer mode and add your app using the ngrok URL.


### Returned Data Schema

The Company Researcher Agent returns information about a company in a **structured JSON format** based on this schema:

```jsonc
{
  "company_name": "string",           // Official name of the company
  "ceo": "string",                    // Name of the current CEO or chief executive (if available)
  "website": "string",                // Official website URL (if available)
  "linkedin_url": "string",           // LinkedIn profile URL (if available)
  "description": "string",            // Brief company description (if available)
  "headquarters": "string",           // Headquarters location (if available)
  "latest_news_stories": [            // Up to two recent news stories (if available)
    {
      "headline": "string",
      "date": "string",
      "url": "string"
    }
  ]
}
```

Fields are included only if reliable information is found. This structured output makes it easy to display, filter, or use the information further in your own app or workflow.
