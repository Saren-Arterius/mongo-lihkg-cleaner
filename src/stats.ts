import { JSONFilePreset } from 'lowdb/node';
import path from 'path'; // To handle file paths
import * as dotenv from 'dotenv'; // Import dotenv
import { FormattedThreadOutput, LowDBData } from './interfaces';

dotenv.config();

async function run() {
    // Initialize lowdb
    const dbPath = path.join(__dirname, '..', 'lowdb.json'); // Use path.join for better cross-platform compatibility
    const defaultLowDBData: LowDBData = { threads: {}, lastId: null };

    // Use JSONFilePreset but we'll handle reading/writing manually for intermittent saves
    const lowdb = await JSONFilePreset<LowDBData>(dbPath, defaultLowDBData);

    let postsTotal = 0;
    let threads = 0;
    for (let t of Object.values(lowdb.data.threads)) {
        postsTotal += t.formatted_thread.posts;
        threads++;
    }
    console.log({threads, postsTotal})
}


run().catch(console.error);