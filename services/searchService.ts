
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
    'jamanetwork.com', 'bmj.com', 'thelancet.com',
    'nejm.org', 'pnas.org', 'frontiersin.org',
    'plos.org', 'mdpi.com', 'acs.org'
];

export const isPrimarySourceDomain = (url: string): boolean => {
    try {
        const hostname = new URL(url).hostname;
        return PRIMARY_SOURCE_DOMAINS.some(domain => hostname.endsWith(domain));
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
                    return {
                        link: chunk.web.uri,
                        title: chunk.web.title || new URL(chunk.web.uri).hostname, // Use hostname as fallback title
                        snippet: `Source from Google Search for: "${query}".`, 
                        source: SearchDataSource.GoogleSearch
                    };
                }
                return null;
            })
            .filter((r): r is SearchResult => r !== null);

        addLog(`[performGoogleSearch] Found ${searchResults.length} sources from Google Search grounding.`);
        const uniqueResults = Array.from(new Map(searchResults.map(item => [item.link, item])).values());
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


export const excavatePrimarySources = async (secondarySources: SearchResult[], addLog: (message: string) => void): Promise<SearchResult[]> => {
    addLog(`[Excavator] Starting excavation of ${secondarySources.length} secondary sources.`);
    const excavatedLinks: SearchResult[] = [];

    const fetchAndParse = async (source: SearchResult) => {
        try {
            addLog(`[Excavator] Fetching: ${source.link}`);
            const response = await fetchWithCorsFallback(source.link, addLog);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = doc.querySelectorAll('a');
            
            links.forEach(link => {
                const href = link.href;
                if (isPrimarySourceDomain(href)) {
                    excavatedLinks.push({
                        title: link.textContent?.trim() || href,
                        link: href,
                        snippet: `Excavated from: ${source.title}`,
                        source: source.source,
                    });
                }
            });
        } catch (error) {
            addLog(`[Excavator] Failed to process ${source.link}: ${error}`);
        }
    };

    await Promise.all(secondarySources.map(fetchAndParse));
    
    const uniqueExcavated = Array.from(new Map(excavatedLinks.map(item => [item.link, item])).values());
    addLog(`[Excavator] Finished excavation. Found ${uniqueExcavated.length} unique primary links.`);
    return uniqueExcavated;
};

const enrichPubMedResult = async (result: SearchResult, addLog: (msg: string) => void): Promise<SearchResult> => {
    const pmidMatch = result.link.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/);
    if (!pmidMatch || !pmidMatch[1]) {
        return result; // Not a standard PubMed link
    }
    const pmid = pmidMatch[1];
    addLog(`[Enricher.PubMed] Found PMID ${pmid}. Fetching details...`);
    
    try {
        const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json`;
        const summaryResponse = await fetch(summaryUrl); // Direct fetch is usually fine for NCBI API
        if (!summaryResponse.ok) {
            throw new Error(`NCBI API summary failed with status ${summaryResponse.status}`);
        }
        const summaryData = await summaryResponse.json();
        const article = summaryData.result[pmid];

        if (article) {
            const newTitle = article.title || result.title;
            const newSnippet = `Authors: ${article.authors.map((a: {name: string}) => a.name).join(', ')}. Journal: ${article.source}. PubDate: ${article.pubdate}.`;
            
            addLog(`[Enricher.PubMed] Successfully enriched PMID ${pmid} with title: "${newTitle}"`);
            return {
                ...result,
                title: newTitle,
                snippet: newSnippet,
            };
        }
        return result;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        addLog(`[Enricher.PubMed] WARN: Failed to enrich PMID ${pmid}: ${message}`);
        return result; // Return original on failure
    }
};

export const enrichSearchResults = async (results: SearchResult[], addLog: (message:string) => void): Promise<SearchResult[]> => {
    addLog(`[Enricher] Starting enrichment process for ${results.length} results.`);
    const enrichmentPromises = results.map(async result => {
        const isPrimary = isPrimarySourceDomain(result.link);
        // Condition for enrichment: is a primary source AND has a generic/short snippet.
        const needsEnrichment = isPrimary && (result.snippet.length < 150 || result.snippet.startsWith('Source from'));

        if (!needsEnrichment) {
            return result;
        }

        // Specific enrichment logic for PubMed
        if (result.link.includes('pubmed.ncbi.nlm.nih.gov')) {
            return enrichPubMedResult(result, addLog);
        }
        
        // Future: Add more generic scrapers here for other domains if needed.

        return result; // Return original if no specific enricher matches
    });

    const enriched = await Promise.all(enrichmentPromises);
    addLog(`[Enricher] Enrichment process complete.`);
    return enriched;
};
