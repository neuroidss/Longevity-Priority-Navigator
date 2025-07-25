

import { SearchDataSource, type SearchResult, type GeneSearchedRecord, type OpenGeneSearchResponse } from '../types';
import { GenerateContentResponse } from "@google/genai";

type ProxyUrlBuilder = (url: string) => string;

const PROXY_BUILDERS: ProxyUrlBuilder[] = [
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url:string) => `https://thingproxy.freeboard.io/fetch/${url}`,
];


const PRIMARY_SOURCE_DOMAINS = [
    'pubmed.ncbi.nlm.nih.gov', 'ncbi.nlm.nih.gov/pmc',
    'biorxiv.org', 'medrxiv.org', 'arxiv.org',
    'patents.google.com', 'uspto.gov',
    'nature.com', 'science.org', 'cell.com',
    'jci.org', 'rupress.org',
    'jamanetwork.com', 'bmj.com', 'thelancet.com',
    'nejm.org', 'pnas.org', 'frontiersin.org',
    'plos.org', 'mdpi.com', 'acs.org', 'springer.com',
    'wiley.com', 'elifesciences.org'
];

export const isPrimarySourceDomain = (url: string): boolean => {
    try {
        const hostname = new URL(url).hostname.replace(/^www\./, '');
        return PRIMARY_SOURCE_DOMAINS.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
    } catch (e) {
        return false;
    }
};

const fetchWithCorsFallback = async (url: string, addLog: (message: string) => void): Promise<Response> => {
    // 1. Attempt Direct Fetch
    addLog(`[Fetch] Attempting direct fetch for: ${url}`);
    try {
        const response = await fetch(url);
        if (response.ok) {
            addLog(`[Fetch] Direct fetch successful for: ${url}`);
            return response;
        }
        addLog(`[Fetch] Direct fetch for ${url} failed with status ${response.status}. Falling back to proxy.`);
    } catch (error) {
        if (error instanceof TypeError) {
            addLog(`[Fetch] Direct fetch for ${url} failed, likely due to CORS. Falling back to proxy.`);
        } else {
            const message = error instanceof Error ? error.message : 'Unknown error';
            addLog(`[Fetch] Direct fetch for ${url} failed with non-CORS error: ${message}. Falling back to proxy as a last resort.`);
        }
    }

    // 2. Fallback to Proxies
    const shuffledBuilders = [...PROXY_BUILDERS].sort(() => Math.random() - 0.5);
    for (const buildProxyUrl of shuffledBuilders) {
        const proxyUrl = buildProxyUrl(url);
        const proxyName = proxyUrl.match(/https:\/\/([^/]+)/)?.[1] || 'unknown';
        try {
            addLog(`[Fetch] Attempting fetch via proxy: ${proxyName}`);
            const response = await fetch(proxyUrl, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
            if (!response.ok) {
                const errorText = await response.text();
                addLog(`[Fetch] WARN: Proxy ${proxyName} failed with status ${response.status}. Trying next. Error: ${errorText.substring(0, 150)}`);
                continue;
            }
            addLog(`[Fetch] Success with proxy: ${proxyName}`);
            return response;
        } catch (error) {
            let errorMessage = "Unknown error";
            if (error instanceof Error) errorMessage = error.message;
            addLog(`[Fetch] WARN: Proxy ${proxyName} threw an error: ${errorMessage}. Trying next proxy.`);
        }
    }
    throw new Error(`All direct and proxy fetch attempts failed for URL: ${url}`);
};

const stripTags = (html: string) => html.replace(/<[^>]*>?/gm, '').trim();

export const performGoogleSearch = async (
    query: string,
    addLog: (msg: string) => void,
    performAiCall: () => Promise<GenerateContentResponse>
): Promise<SearchResult[]> => {
    addLog(`[performGoogleSearch] Starting AI-powered web search...`);
    try {
        const response = await performAiCall();
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        
        if (!groundingChunks || !Array.isArray(groundingChunks)) {
            addLog(`[performGoogleSearch] WARN: AI did not return valid grounding chunks from Google Search.`);
             if (response.text && response.text.length > 10) {
                 addLog(`[performGoogleSearch] Grounding chunks absent, but text is present. AI might have summarized instead of grounding. This text will be ignored as it cannot be verified.`);
             }
            return [];
        }

        const searchResults: SearchResult[] = groundingChunks
            .map((chunk: any) => {
                if (chunk.web && chunk.web.uri) { // Title is now optional, will be enriched later
                    try {
                        return {
                            link: chunk.web.uri,
                            title: chunk.web.title || new URL(chunk.web.uri).hostname, // Use hostname as fallback title
                            snippet: `Source from Google Search for: "${query}".`, 
                            source: SearchDataSource.GoogleSearch
                        };
                    } catch (e) {
                         addLog(`[performGoogleSearch] WARN: Invalid URL found in grounding chunk: ${chunk.web.uri}`);
                         return null;
                    }
                }
                return null;
            })
            .filter((r): r is SearchResult => r !== null);

        addLog(`[performGoogleSearch] Found ${searchResults.length} raw sources from Google Search grounding.`);
        const uniqueResults = Array.from(new Map(searchResults.map(item => [item.link, item])).values());

        const GOOGLE_SEARCH_LIMIT = 20;
        if (uniqueResults.length > GOOGLE_SEARCH_LIMIT) {
            addLog(`[performGoogleSearch] Limiting Google Search results from ${uniqueResults.length} to ${GOOGLE_SEARCH_LIMIT}.`);
            return uniqueResults.slice(0, GOOGLE_SEARCH_LIMIT);
        }
        
        return uniqueResults;

    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error during Google Search';
        addLog(`[performGoogleSearch] ERROR: ${message}`);
        return [];
    }
};

/**
 * Performs a web search using DuckDuckGo's non-JS site.
 */
const searchWeb = async (query: string, addLog: (message: string) => void): Promise<SearchResult[]> => {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const results: SearchResult[] = [];
    try {
        const response = await fetchWithCorsFallback(url, addLog);
        const htmlContent = await response.text();
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const resultElements = doc.querySelectorAll('.web-result');
        
        resultElements.forEach(el => {
            const titleLink = el.querySelector<HTMLAnchorElement>('a.result__a');
            const snippetEl = el.querySelector('.result__snippet');

            if (titleLink && snippetEl) {
                const hrefAttr = titleLink.getAttribute('href');
                if (hrefAttr) {
                    const redirectUrl = new URL(hrefAttr, 'https://duckduckgo.com');
                    const actualLink = redirectUrl.searchParams.get('uddg');

                    if (actualLink) {
                        results.push({
                            link: actualLink,
                            title: (titleLink.textContent || '').trim(),
                            snippet: (snippetEl.textContent || '').trim(),
                            source: SearchDataSource.WebSearch
                        });
                    }
                }
            }
        });

    } catch (error) {
        addLog(`[Search.Web] Error searching DuckDuckGo: ${error}`);
    }
    return results.slice(0, 5); // Limit to top 5
};

const searchPubMed = async (query: string, addLog: (message: string) => void): Promise<SearchResult[]> => {
    const results: SearchResult[] = [];
    try {
        const specificQuery = `${query}[Title/Abstract]`;
        addLog(`[Search.PubMed] Using specific query: "${specificQuery}"`);
        const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(specificQuery)}&retmode=json&sort=relevance&retmax=5`;
        
        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok) throw new Error(`PubMed search failed with status ${searchResponse.status}`);
        const searchData = await searchResponse.json();
        const ids: string[] = searchData.esearchresult.idlist;

        if (ids && ids.length > 0) {
            const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`;
            const summaryResponse = await fetch(summaryUrl);
             if (!summaryResponse.ok) throw new Error(`PubMed summary failed with status ${summaryResponse.status}`);
            const summaryData = await summaryResponse.json();
            
            ids.forEach(id => {
                const article = summaryData.result[id];
                if (article) {
                    results.push({
                        link: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
                        title: article.title,
                        snippet: `Authors: ${article.authors.map((a: {name: string}) => a.name).join(', ')}. Journal: ${article.source}. PubDate: ${article.pubdate}`,
                        source: SearchDataSource.PubMed
                    });
                }
            });
             addLog(`[Fetch] Success with PubMed API.`);
        }
    } catch (error) {
        addLog(`[Search.PubMed] Error searching PubMed: ${error}`);
    }
    return results;
};

const searchBioRxivPmcArchive = async (query: string, addLog: (message: string) => void): Promise<SearchResult[]> => {
    addLog(`[Search.BioRxivPmc] Searching via PubMed Central (PMC) API...`);
    const results: SearchResult[] = [];
    try {
        const processedQuery = query
            .split(/\s+/)
            .filter(term => term.length > 2)
            .join(' OR ');
        
        const enhancedQuery = `(("${query}") OR (${processedQuery})) AND biorxiv[journal]`;
        
        const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pmc&term=${encodeURIComponent(enhancedQuery)}&retmode=json&sort=relevance&retmax=5`;
        
        addLog(`[Fetch] Querying PMC for bioRxiv preprints with query: ${enhancedQuery}`);
        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok) throw new Error(`PMC search failed with status ${searchResponse.status}`);
        
        const searchData = await searchResponse.json();
        const ids: string[] = searchData.esearchresult.idlist;

        if (ids && ids.length > 0) {
            const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pmc&id=${ids.join(',')}&retmode=json`;
            const summaryResponse = await fetch(summaryUrl);
            if (!summaryResponse.ok) throw new Error(`PMC summary failed with status ${summaryResponse.status}`);
            
            const summaryData = await summaryResponse.json();
            
            ids.forEach(id => {
                const article = summaryData.result[id];
                if (article) {
                    const pmcId = article.articleids.find((aid: { idtype: string, value: string }) => aid.idtype === 'pmc')?.value;
                    const link = pmcId 
                        ? `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcId}/`
                        : `https://pubmed.ncbi.nlm.nih.gov/${id}/`;

                    results.push({
                        link: link,
                        title: article.title,
                        snippet: `Authors: ${article.authors.map((a: {name: string}) => a.name).join(', ')}. PubDate: ${article.pubdate}.`,
                        source: SearchDataSource.BioRxivPmcArchive
                    });
                }
            });
            addLog(`[Fetch] Success with PMC API. Found ${results.length} preprints.`);
        } else {
            addLog(`[Fetch] No bioRxiv preprints found in PMC for this query.`);
        }
    } catch (error) {
        addLog(`[Search.BioRxivPmc] Error searching via PMC: ${error}`);
    }
    return results;
};


const monitorBioRxivFeed = async (query: string, addLog: (message: string) => void): Promise<SearchResult[]> => {
    const feedUrl = 'https://connect.biorxiv.org/biorxiv_xml.php?subject=all';
    addLog(`[Search.BioRxivFeed] Monitoring live feed from ${feedUrl}`);
    const results: SearchResult[] = [];
    try {
        const response = await fetchWithCorsFallback(feedUrl, addLog);
        
        const xmlText = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, "application/xml");
        const items = doc.querySelectorAll("item");
        
        const MAX_FEED_ITEMS = 50;
        items.forEach((item, index) => {
            if (index >= MAX_FEED_ITEMS) return;

            const title = item.querySelector("title")?.textContent ?? '';
            const link = item.querySelector("link")?.textContent ?? '';
            const description = item.querySelector("description")?.textContent ?? '';

            if (link) {
                results.push({
                    title: stripTags(title),
                    link: stripTags(link),
                    snippet: stripTags(description).substring(0, 300) + '...',
                    source: SearchDataSource.BioRxivFeed,
                });
            }
        });
        
        addLog(`[Search.BioRxivFeed] Fetched ${results.length} raw items from the live feed. They will be filtered by AI.`);
        return results;
    } catch (error) {
        addLog(`[Search.BioRxivFeed] Error monitoring live feed: ${error}`);
        return [];
    }
};

const searchGooglePatents = async (query: string, addLog: (message: string) => void): Promise<SearchResult[]> => {
    const url = `https://patents.google.com/xhr/query?url=q%3D${encodeURIComponent(query)}`;
    const results: SearchResult[] = [];
    try {
        const response = await fetchWithCorsFallback(url, addLog);
        const rawText = await response.text();
        
        const firstBraceIndex = rawText.indexOf('{');
        if (firstBraceIndex === -1) {
            throw new Error(`No JSON object found in response. Body starts with: ${rawText.substring(0, 150)}`);
        }
        const jsonText = rawText.substring(firstBraceIndex);
        const data = JSON.parse(jsonText);
        
        const patents = data.results?.cluster?.[0]?.result || [];
        patents.slice(0, 5).forEach((item: any) => {
            if (item && item.patent) {
                const patent = item.patent;
                const inventors = (patent.inventor_normalized && Array.isArray(patent.inventor_normalized)) 
                    ? stripTags(patent.inventor_normalized.join(', ')) 
                    : (patent.inventor ? stripTags(patent.inventor) : 'N/A');

                const assignees = (patent.assignee_normalized && Array.isArray(patent.assignee_normalized))
                    ? stripTags(patent.assignee_normalized.join(', '))
                    : (patent.assignee ? stripTags(patent.assignee) : 'N/A');

                results.push({
                    link: `https://patents.google.com/patent/${patent.publication_number}/en`,
                    title: stripTags(patent.title || 'No Title'),
                    snippet: `Inventor: ${inventors}. Assignee: ${assignees}. Publication Date: ${patent.publication_date || 'N/A'}`,
                    source: SearchDataSource.GooglePatents
                });
            }
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        addLog(`[Search.Patents] Error searching Google Patents: ${message}`);
    }
    return results;
};

const searchOpenGenesAPI = async (query: string, addLog: (message: string) => void): Promise<SearchResult[]> => {
    const mapGeneSearchedToSearchResult = (record: GeneSearchedRecord): SearchResult => {
        const firstLifespanResearch = record.researches?.increaseLifespan?.[0];
        let lifespanChange = 'N/A';
        let lifespanEffect = 'unclear';

        if (firstLifespanResearch) {
            lifespanEffect = firstLifespanResearch.interventionResultForLifespan || 'unclear';
            const min = firstLifespanResearch.lifespanMinChangePercent;
            const max = firstLifespanResearch.lifespanMaxChangePercent;
            const mean = firstLifespanResearch.lifespanMeanChangePercent;
            
            if (min !== undefined && max !== undefined) {
                 lifespanChange = (min === max) ? `${max}%` : `${min}% to ${max}%`;
            } else if (max !== undefined) {
                lifespanChange = `${max}%`;
            } else if (mean !== undefined) {
                lifespanChange = `~${mean}%`;
            }
        }
        
        const hallmark = record.agingMechanisms?.[0]?.name || 'N/A';
        const intervention = firstLifespanResearch?.interventions?.experiment?.[0]?.interventionMethod || 'N/A';
        const organism = firstLifespanResearch?.modelOrganism || 'N/A';

        const snippet = `Organism: ${organism}. Effect: ${lifespanEffect} (${lifespanChange}). Hallmark: ${hallmark}. Intervention: ${intervention}.`;

        return {
            title: `${record.symbol} (${record.name})`,
            link: `https://open-genes.com/api/gene/${record.symbol}`,
            snippet: snippet,
            source: SearchDataSource.OpenGenes,
        };
    };

    const apiUrl = `https://open-genes.com/api/gene/search?bySuggestions=${encodeURIComponent(query)}&pageSize=10`;
    addLog(`[Search.OpenGenes] Querying live API at: ${apiUrl}`);
    try {
        const response = await fetchWithCorsFallback(apiUrl, addLog);
        const data: OpenGeneSearchResponse = await response.json();
        const results = data.items.map(mapGeneSearchedToSearchResult);
        addLog(`[Search.OpenGenes] Found ${results.length} matches from API.`);
        return results.slice(0, 5);
    } catch (error) {
        addLog(`[Search.OpenGenes] Error querying OpenGenes API: ${error}`);
        return [];
    }
};

export const performFederatedSearch = async (
    query: string,
    sources: SearchDataSource[],
    addLog: (message: string) => void
): Promise<SearchResult[]> => {
    let allResults: SearchResult[] = [];
    
    addLog(`[Search] Starting federated search for "${query}" across sources: ${sources.join(', ')}`);

    const searchPromises = sources.map(source => {
        switch(source) {
            case SearchDataSource.PubMed: return searchPubMed(query, addLog);
            case SearchDataSource.BioRxivFeed: return monitorBioRxivFeed(query, addLog);
            case SearchDataSource.BioRxivPmcArchive: return searchBioRxivPmcArchive(query, addLog);
            case SearchDataSource.GooglePatents: return searchGooglePatents(query, addLog);
            case SearchDataSource.WebSearch: return searchWeb(query, addLog);
            case SearchDataSource.OpenGenes: return searchOpenGenesAPI(query, addLog);
            default: return Promise.resolve([]);
        }
    });

    const resultsBySource = await Promise.allSettled(searchPromises);

    resultsBySource.forEach((result, index) => {
        const sourceName = sources[index];
        if (result.status === 'fulfilled' && result.value) {
            addLog(`[Search] ${sourceName} returned ${result.value.length} results.`);
            allResults.push(...result.value);
        } else {
            addLog(`[Search] WARN: ${sourceName} search failed: ${result.status === 'rejected' ? result.reason : 'No value returned'}`);
        }
    });

    const uniqueResults = Array.from(new Map(allResults.map(item => [item.link, item])).values());
    addLog(`[Search] Federated search complete. Total unique results: ${uniqueResults.length}`);
    return uniqueResults;
};


// --- Source Content Enrichment ---

const getContent = (doc: Document, selectors: string[], attribute: string = 'content'): string | null => {
    for (const selector of selectors) {
        const element = doc.querySelector<HTMLMetaElement | HTMLElement>(selector);
        if (element) {
            let content: string | null | undefined = null;
            if (attribute === 'textContent') {
                content = element.textContent;
            } else if ('getAttribute' in element && typeof element.getAttribute === 'function') {
                content = element.getAttribute(attribute);
            }
            if (content) return content.trim();
        }
    }
    return null;
};

const extractDoi = (text: string): string | null => {
    if (!text) return null;
    const doiRegex = /(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i;
    const match = text.match(doiRegex);
    return match ? match[1] : null;
};

export const enrichPrimarySource = async (source: SearchResult, addLog: (message: string) => void): Promise<SearchResult> => {
    if (source.snippet?.startsWith('[DOI Found]') || source.snippet?.startsWith('Fetch failed')) {
        addLog(`[Enricher] Skipping enrichment for ${source.link} as it appears to be already processed.`);
        return source;
    }

    const doi = extractDoi(source.link);
    let server = '';
    if (source.link.includes('biorxiv.org')) server = 'biorxiv';
    else if (source.link.includes('medrxiv.org')) server = 'medrxiv';

    // --- Strategy 1: BioRxiv/MedRxiv API ---
    if (doi && server) {
        addLog(`[Enricher] Found ${server} DOI: ${doi}. Attempting to use official API.`);
        try {
            const apiUrl = `https://api.biorxiv.org/details/${server}/${doi}`;
            const response = await fetchWithCorsFallback(apiUrl, addLog);
            if (!response.ok) {
                throw new Error(`API returned status ${response.status}`);
            }
            const data = await response.json();
            const article = data?.collection?.[0];
            if (article?.doi && article?.title && article?.abstract) {
                addLog(`[Enricher] Successfully enriched via ${server} API for DOI ${article.doi}.`);
                return {
                    ...source,
                    link: `https://www.${server}.org/content/${article.doi}`,
                    title: article.title,
                    snippet: `[DOI Found] ${article.abstract}`,
                };
            } else {
                throw new Error(`No valid article data found in API response for DOI ${doi}`);
            }
        } catch (error) {
            addLog(`[Enricher] WARN: ${server} API fetch failed for DOI ${doi}: ${error instanceof Error ? error.message : String(error)}. Falling back to HTML scraping.`);
        }
    }

    // --- Strategy 2: HTML Scraping (Fallback) ---
    addLog(`[Enricher] Using HTML scraping fallback for: ${source.link}`);
    const urlToScrape = doi ? `https://doi.org/${doi}` : source.link;

    try {
        const response = await fetchWithCorsFallback(urlToScrape, addLog);
        const finalUrl = response.url;
        const linkToSave = (finalUrl && !finalUrl.includes('corsproxy') && !finalUrl.includes('allorigins') && !finalUrl.includes('thingproxy'))
            ? finalUrl
            : urlToScrape;

        if (linkToSave !== urlToScrape) {
            addLog(`[Enricher] URL redirected to canonical: "${linkToSave}"`);
        }

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        let title: string | null = null;
        let abstract: string | null = null;
        let doiFound = !!doi;

        try {
            const jsonLdElement = doc.querySelector('script[type="application/ld+json"]');
            if (jsonLdElement && jsonLdElement.textContent) {
                const jsonLdData = JSON.parse(jsonLdElement.textContent);
                const articles = Array.isArray(jsonLdData) ? jsonLdData : [jsonLdData];
                const scholarlyArticle = articles.find(item => item && (item['@type'] === 'ScholarlyArticle' || (Array.isArray(item['@type']) && item['@type'].includes('ScholarlyArticle'))));
                if (scholarlyArticle) {
                    title = scholarlyArticle.headline || scholarlyArticle.name || null;
                    abstract = scholarlyArticle.description || scholarlyArticle.abstract || null;
                    if (scholarlyArticle.doi || extractDoi(scholarlyArticle.url || '')) doiFound = true;
                    if (title && abstract) {
                        addLog(`[Enricher] Found title and abstract via JSON-LD for ${linkToSave}`);
                    }
                }
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : "Unknown error";
            addLog(`[Enricher] WARN: Could not parse JSON-LD from ${linkToSave}. Error: ${message}`);
        }

        if (!title) {
            title = getContent(doc, ['meta[property="og:title"]', 'meta[name="twitter:title"]'], 'content');
            if (!title) title = doc.querySelector('title')?.textContent || null;
        }
        if (!abstract) {
            abstract = getContent(doc, [
                'meta[name="citation_abstract"]',
                'meta[property="og:description"]',
                'meta[name="twitter:description"]',
                'meta[name="description"]'
            ], 'content');
        }
        if (!doiFound) {
            const doiMeta = getContent(doc, ['meta[name="citation_doi"]', 'meta[name="DC.identifier"]'], 'content');
            if (doiMeta && doiMeta.startsWith('10.')) {
                doiFound = true;
                addLog(`[Enricher] Found DOI in meta tag for ${linkToSave}`);
            }
        }

        if (!title) {
            title = getContent(doc, ['h1'], 'textContent');
        }
        if (!abstract) {
            abstract = getContent(doc, [
                'div[class*="abstract"]',
                'section[id*="abstract"]',
                '.abstract-content',
                '#abstract',
                'p.abstract'
            ], 'textContent');
        }

        if (!doiFound && doc.body?.textContent) {
            const foundDoi = extractDoi(doc.body.textContent);
            if (foundDoi) {
                doiFound = true;
                addLog(`[Enricher] Found DOI via regex in body text for ${linkToSave}`);
            }
        }

        const enrichedTitle = title ? stripTags(title) : source.title;
        let enrichedSnippet = abstract ? stripTags(abstract) : `No abstract could be extracted. Original snippet: ${source.snippet}`;

        if (doiFound) {
            enrichedSnippet = `[DOI Found] ${enrichedSnippet}`;
        }

        if (abstract) {
            addLog(`[Enricher] Successfully enriched snippet via HTML scraping for ${linkToSave}. DOI found: ${doiFound}`);
        } else {
            addLog(`[Enricher] WARN: Could not enrich snippet via HTML scraping for ${linkToSave}. Using fallback snippet. DOI found: ${doiFound}`);
        }

        return {
            ...source,
            link: linkToSave,
            title: enrichedTitle,
            snippet: enrichedSnippet,
        };

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        addLog(`[Enricher] ERROR: Failed to fetch or parse ${urlToScrape}: ${message}.`);
        const fallbackTitle = doi ? `DOI: ${doi}` : source.title;

        return {
            ...source,
            title: fallbackTitle,
            snippet: `Fetch failed. Could not retrieve content from the source.`
        };
    }
};

export const enrichPrimarySources = async (sources: SearchResult[], addLog: (message: string) => void): Promise<SearchResult[]> => {
    if (!sources || sources.length === 0) return [];

    addLog(`[Enricher] Starting enrichment for ${sources.length} primary sources.`);
    
    const enrichmentPromises = sources.map(source => enrichPrimarySource(source, addLog));
    
    const results = await Promise.all(enrichmentPromises);
    
    addLog(`[Enricher] Enrichment process finished.`);
    return results;
};
