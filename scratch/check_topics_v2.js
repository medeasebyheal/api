import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const TopicSchema = new mongoose.Schema({
    videoUrls: [String]
}, { strict: false });
const Topic = mongoose.model('Topic', TopicSchema, 'topics');

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const topics = await Topic.find({ videoUrls: { $exists: true, $ne: [] } }).lean();
        console.log(`Checking ${topics.length} topics`);
        for (const t of topics) {
            if (t.videoUrls && Array.isArray(t.videoUrls)) {
                const hasProblem = t.videoUrls.some(v => typeof v !== 'string' || v.includes('ObjectId') || v.includes('{') || v.includes('\n'));
                if (hasProblem) {
                    console.log(`TOPIC MATCH FOUND: ${t._id}`);
                    console.log(JSON.stringify(t.videoUrls, null, 2));
                }
            }
        }

        const Subject = mongoose.model('Subject', TopicSchema, 'subjects');
        const subjects = await Subject.find({ videoUrls: { $exists: true, $ne: [] } }).lean();
        console.log(`Checking ${subjects.length} subjects`);
        for (const s of subjects) {
            if (s.videoUrls && Array.isArray(s.videoUrls)) {
                const hasProblem = s.videoUrls.some(v => typeof v !== 'string' || v.includes('ObjectId') || v.includes('{') || v.includes('\n'));
                if (hasProblem) {
                    console.log(`SUBJECT MATCH FOUND: ${s._id}`);
                    console.log(JSON.stringify(s.videoUrls, null, 2));
                }
            }
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
