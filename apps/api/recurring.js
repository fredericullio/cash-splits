// run daily (scheduler comes with deploy in stage 4); safe to run any number of times
import { sql, generateRecurring } from './server.js';

console.log(`recurring: ${await generateRecurring()} expenses created`);
await sql.end();
