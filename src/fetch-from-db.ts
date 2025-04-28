import * as cheerio from 'cheerio';
import { format } from 'date-fns';
import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv'; // Import dotenv
import { FormattedThreadOutput, LowDBData, ThreadData } from './interfaces';
import { JSONFilePreset } from 'lowdb/node';
import path from 'path'; // To handle file paths

dotenv.config();

/**
 * Extracts the inner text from an HTML string using cheerio.
 * @param htmlString The HTML string to parse.
 * @returns The extracted inner text.
 */
function getInnerTextFromHtml(htmlString: string): string {
  if (!htmlString) {
    return '';
  }
  const $ = cheerio.load(htmlString);
  // Use root() to get the text content of the entire parsed HTML string
  // This effectively strips all tags and returns the text content.
  return $.root().text().replace(/\n+/g, '\n').trim();
}

function formatForumThreadWithInnerText(threadData: ThreadData): FormattedThreadOutput {
  let formattedTitle = '';
  const formattedPosts: string[] = [];
  const postsPerChunk = 101;

  // Format the title
  if (threadData.sub_category != null) {
    formattedTitle = `[${threadData.category.name}] [${threadData.sub_category.name}] ${threadData.title}\n\n`;
  } else {
    formattedTitle = `[${threadData.category.name}] ${threadData.title}\n\n`;
  }

  // Format posts and split into chunks
  let currentPostChunk = '';
  let posts = 0;
  threadData.item_data.forEach((post, index) => {
    // const timestamp = new Date(post.reply_time * 1000); // Convert Unix timestamp to Date
    // const formattedTimestamp = format(timestamp, 'yyyy-MM-dd HH:mm'); // Format timestamp
    const postInnerText = getInnerTextFromHtml(post.msg);
    if (postInnerText && postInnerText !== '此回覆已被刪除' && post.user.nickname !== '🗿 用戶已刪除帳號') {
      currentPostChunk += `#${post.msg_num},〔${post.user.nickname}〕\n${postInnerText}\n\n`;
      posts++;
    }

    // If 101 posts have been processed or it's the last post, add the chunk to the array
    if ((index + 1) % postsPerChunk === 0 || index === threadData.item_data.length - 1) {
      let trimmed = currentPostChunk.trim();
      if (trimmed) {
        formattedPosts.push(trimmed); // Trim trailing newline
      }
      currentPostChunk = ''; // Reset for the next chunk
    }
  });

  const formattedCreateTimestamp = format(new Date(threadData.create_time * 1000), 'yyyy-MM-dd HH:mm'); // Format timestamp
  const formattedLastReplyTimestamp = format(new Date(threadData.last_reply_time * 1000), 'yyyy-MM-dd HH:mm'); // Format timestamp

  return {
    formatted_title: formattedTitle.trim(), // Trim trailing newline from title
    author: `〔${threadData.item_data[0].user.nickname}〕`,
    create_time: formattedCreateTimestamp,
    last_reply_time: formattedLastReplyTimestamp,
    posts,
    formatted_posts: formattedPosts,
  };
}



const uri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME;
const collectionName = process.env.COLLECTION_NAME;

if (!uri || !dbName || !collectionName) {
  console.error("Please make sure MONGO_URI, DB_NAME, and COLLECTION_NAME are set in your .env file.");
  process.exit(1);
}

const client = new MongoClient(uri);

async function run() {
  // Initialize lowdb
  const dbPath = path.join(__dirname, '..', 'lowdb.json'); // Use path.join for better cross-platform compatibility
  const defaultLowDBData: LowDBData = { threads: {}, lastId: null };

  // Use JSONFilePreset but we'll handle reading/writing manually for intermittent saves
  const lowdb = await JSONFilePreset<LowDBData>(dbPath, defaultLowDBData);

  // Load the last processed ID from lowdb
  let lastId: ObjectId | null = lowdb.data.lastId;
  console.log(`Starting from last processed ID: ${lastId ? lastId : 'None'}`);

  try {
    await client.connect();
    console.log("Successfully connected to MongoDB Atlas");

    const database = client.db(dbName);
    const collection = database.collection<ThreadData>(collectionName as string);

    const batchSize = 100;
    let documentsFound = true;
    let documentCount = 0; // To keep track of the total number of documents processed

    // Set the initial query based on the lastId from lowdb
    let query: any = {};
    if (lastId) {
      // Filter to get documents created *strictly* after the lastId
      query = { _id: { $gt: new ObjectId(lastId) } };
      console.log(`Filtering MongoDB documents by: ${JSON.stringify(query)}`);
    }

    while (documentsFound) {
      // Find a batch of documents, sorted by _id
      const cursor = collection.find(query).sort({ _id: 1 }).limit(batchSize);

      const batch = await cursor.toArray();

      if (batch.length === 0) {
        // No more documents in the collection
        documentsFound = false;
        console.log("No more documents found in the current batch.");
      } else {
        // Process the current batch
        console.log(`Processing batch of ${batch.length} documents...`);
        for (const doc of batch) {
          documentCount++;
          // console.log(doc)
          console.log(`--- Thread ${documentCount} (ID: ${doc._id.toHexString()}) ---`);

          try {
            const formattedThread = formatForumThreadWithInnerText(doc);
            // console.log(formattedThread); // Optional: log the formatted thread
            if (formattedThread.formatted_posts.length === 0) {
              console.log(`Skipped empty thread: ${doc._id.toHexString()}`);
              continue;
            }
            // Save the formatted thread to lowdb
            lowdb.data.threads[doc._id.toHexString()] = {
              thread_id: doc.thread_id, // Or use the thread_id field from the document if that's what you need
              formatted_thread: formattedThread
            };

            console.log(`Saved formatted thread for ID: ${doc._id.toHexString()}`);

            // Update lastId with the current document's _id.$oid
            lastId = doc._id;

          } catch (error) {
            console.error(`Error processing thread ID ${doc._id.toHexString()}:`, error);
            // Optionally, handle this error (e.g., log it and continue or stop)
          }
        }

        // After processing the batch, write the updated lowdb data (including the new lastId)
        lowdb.data.lastId = lastId;
        await lowdb.write();
        console.log(`Lowdb updated and lastId saved: ${lastId ? lastId : 'None'}`);

        // Prepare the query for the next batch
        if (lastId) {
          query = { _id: { $gt: lastId } };
          console.log(`Preparing query for next batch: ${JSON.stringify(query)}`);
        } else {
           // This case should ideally not be reached if there are documents, but as a fallback
           documentsFound = false;
        }
      }
    }

    if (documentCount === 0) {
      console.log(`No new documents found in the '${collectionName}' collection since the last run.`);
    } else {
      console.log(`Finished processing a total of ${documentCount} new documents.`);
    }

  } catch (error) {
    console.error("An error occurred during processing:", error);
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
    console.log("MongoDB connection closed.");
  }
}

run().catch(console.error);