import OpenAI from 'openai';
import { JSONFilePreset } from 'lowdb/node';
import path from 'path'; // To handle file paths
import * as dotenv from 'dotenv'; // Import dotenv
import { FormattedThreadOutput, LowDBData } from './interfaces';

dotenv.config();

const SYSTEM_PROMPT = `You are a forum thread analyst. Based on the provided forum thread data (including title, author, timestamp, and individual posts), write a concise analysis in a short paragraph.

Your analysis should be presented in a concise, flowing narrative style, getting straight to the point. The short paragraph must include:
- The core theme of the discussion. (e.g., Serious, Academic, Light-hearted, Sarcastic, Flame war, Word play).
- A brief summary of the main content of the conversation.
- The overall sentiment of the discussion (e.g., Positive, Negative, Mixed, Neutral).
- A key insight or conclusion, specifically highlighting one or more of the most interesting or important individual viewpoints within it (if applicable).

Directly output the analysis content without including extra opening phrases or formatting titles. Do not use point forms. If a forum username will be quoted, wrap the username in 〔〕.

Analysis of previous pages will be included in prompt if available. DO NOT make duplicate points to previous analysis. Observe only new points in the new page.

**CRITICAL INSTRUCTIONS:** Your analysis short paragraph **MUST be entirely in Hong Kong Cantonese**. Absolutely no English or other languages.`;


const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
});

// const openai = new OpenAI({
//     baseURL: 'http://localhost:11434/v1',
//     apiKey: process.env.OPENROUTER_API_KEY,
// });


async function run() {
    // Initialize lowdb
    const dbPath = path.join(__dirname, '..', 'lowdb.json'); // Use path.join for better cross-platform compatibility
    const defaultLowDBData: LowDBData = { threads: {}, lastId: null };

    // Use JSONFilePreset but we'll handle reading/writing manually for intermittent saves
    const lowdb = await JSONFilePreset<LowDBData>(dbPath, defaultLowDBData);

    // Get the entry to analyze (replace with your logic to select which threads to process)
    const threadOidToAnalyze = '67f7e47a54e08830b5ef54f3';
    const threadEntry = lowdb.data.threads[threadOidToAnalyze];

    if (!threadEntry) {
        console.log(`Thread with OID ${threadOidToAnalyze} not found in lowdb.`);
        return;
    }

    console.log(threadEntry.formatted_thread.formatted_title)

    // Format the thread data nicely for the LLM
    threadEntry.llm_analyze = undefined;
    let trials = 10;
    for (let page = 0; page < threadEntry.formatted_thread.formatted_posts.length; page++) {
        for (let t = 0; t < trials; t++) {
            const formattedThreadForLLM = formatThreadForLLM(threadEntry.formatted_thread, page, threadEntry.llm_analyze);

            const completion = await openai.chat.completions.create({
                // model: 'google/gemini-2.5-pro-preview-03-25',
                model: 'google/gemini-2.5-flash-preview',
                // model: 'gemma3-27b-it-qat-16k',
                messages: [
                    {
                        role: 'system',
                        content: SYSTEM_PROMPT,
                    },
                    {
                        role: 'user',
                        content: formattedThreadForLLM,
                    },
                ],
                temperature: 0.6
            });
    
            try {
                const llmOutput = completion.choices[0].message?.content?.replace(/\n/g, '').trim();
                if (!llmOutput) throw new Error('No output');
                console.log(`LLM Output for page ${page}:`, llmOutput);
                // Save the LLM output to lowdb. We'll store it as an array of strings
                // If there are multiple analyses over time, you can push to the array
                if (threadEntry.llm_analyze == null) {
                    threadEntry.llm_analyze = [llmOutput]; // Store the output as the first element in the array
                } else {
                    threadEntry.llm_analyze.push(llmOutput)
                }
    
                // Save the updated data back to the lowdb file
                await lowdb.write();
            } catch (e) {
                console.log(`LLM did not provide any output. Trying again. ${t + 1}/${trials}`);
                console.error(e, completion);
                continue;
            }
            break;
        }
        
    }

}

// Helper function to format the thread data for the LLM
function formatThreadForLLM(thread: FormattedThreadOutput, part: number, previous: [string] | undefined): string {
    let formattedString = `貼文標題: ${thread.formatted_title}
作者: ${thread.author}
發佈時間: ${thread.create_time}
最後回覆時間: ${thread.last_reply_time}
${(previous?.length || 0) > 0 ? `過往分析\n` : ''}
${(previous || []).map((s, i) => `第${i}頁: ${s}`).join('\n')}
=====
第${part + 1}/${thread.formatted_posts.length}頁
${thread.formatted_posts[part]}`;

    return formattedString;
}


run().catch(console.error);