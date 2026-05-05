import mongoose from 'mongoose';
import { McqAttempt } from '../models/McqAttempt.js';
import { ContentVisit } from '../models/ContentVisit.js';
import { EaseGPTResponse } from '../models/EaseGPTResponse.js';
import { OspeEaseGPTResponse } from '../models/OspeEaseGPTResponse.js';
import { User } from '../models/User.js';

export const getKpiDashboard = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Default to last 30 days if no date provided
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    const dateFilter = { createdAt: { $gte: start, $lte: end } };
    
    // 1. Total number of MCQs attempted by all students
    const totalMcqsAttempted = await McqAttempt.countDocuments(dateFilter);
    
    // 2. Top 5 students based on MCQs attempted
    const topStudentsAgg = await McqAttempt.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$user', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userDoc' } },
      { $unwind: '$userDoc' },
      { $project: { _id: 1, name: '$userDoc.name', email: '$userDoc.email', count: 1 } }
    ]);
    
    // 3. Most attempted MCQ topics
    const topTopicsAgg = await McqAttempt.aggregate([
      { $match: dateFilter },
      { $lookup: { from: 'mcqs', localField: 'mcq', foreignField: '_id', as: 'mcqDoc' } },
      { $unwind: '$mcqDoc' },
      { $group: { _id: '$mcqDoc.topic', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'topics', localField: '_id', foreignField: '_id', as: 'topicDoc' } },
      { $unwind: '$topicDoc' },
      { $project: { _id: 1, name: '$topicDoc.name', count: 1 } }
    ]);
    
    // 4. Most visited content categorized by topic, subject, and module
    const visitedContentAgg = await ContentVisit.aggregate([
      { $match: dateFilter },
      { $group: { _id: { contentId: '$contentId', contentType: '$contentType' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 }
    ]);
    
    // Populate the names for the visited content based on contentType
    const populatedVisits = [];
    for (const v of visitedContentAgg) {
      const type = v._id.contentType;
      const id = v._id.contentId;
      let name = 'Unknown';
      if (type === 'module') {
        const doc = await mongoose.model('Module').findById(id).select('name').lean();
        if (doc) name = doc.name;
      } else if (type === 'subject') {
        const doc = await mongoose.model('Subject').findById(id).select('name').lean();
        if (doc) name = doc.name;
      } else if (type === 'topic') {
        const doc = await mongoose.model('Topic').findById(id).select('name').lean();
        if (doc) name = doc.name;
      } else if (type === 'ospe') {
        const doc = await mongoose.model('Ospe').findById(id).select('name').lean();
        if (doc) name = doc.name;
      }
      populatedVisits.push({ id, type, name, count: v.count });
    }
    
    // 5. Total usage statistics of EaseGPT
    const [easeGptCount, ospeEaseGptCount] = await Promise.all([
      EaseGPTResponse.countDocuments(dateFilter),
      OspeEaseGPTResponse.countDocuments(dateFilter)
    ]);
    
    // 6. Overall top performer of the month
    // Score logic: 1 pt per MCQ attempt + 2 pt per unique content visited + 5 pt per streak day
    // Calculate for top 10 users with most attempts, then refine score
    const activeUsersAgg = await McqAttempt.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$user', mcqCount: { $sum: 1 } } },
      { $sort: { mcqCount: -1 } },
      { $limit: 20 }
    ]);
    
    let topPerformer = null;
    let maxScore = -1;
    
    for (const userStat of activeUsersAgg) {
      const userId = userStat._id;
      
      const uniqueVisitsCount = (await ContentVisit.distinct('contentId', { user: userId, ...dateFilter })).length;
      const userDoc = await User.findById(userId).select('name email studyStreakDays').lean();
      
      const streak = userDoc?.studyStreakDays || 0;
      const score = (userStat.mcqCount * 1) + (uniqueVisitsCount * 2) + (streak * 5);
      
      if (score > maxScore) {
        maxScore = score;
        topPerformer = {
          user: userDoc,
          score,
          mcqsAttempted: userStat.mcqCount,
          uniqueContentVisited: uniqueVisitsCount,
          streak
        };
      }
    }
    
    res.json({
      totalMcqsAttempted,
      topStudents: topStudentsAgg,
      topTopics: topTopicsAgg,
      mostVisitedContent: populatedVisits,
      easeGptUsage: {
        standard: easeGptCount,
        ospe: ospeEaseGptCount,
        total: easeGptCount + ospeEaseGptCount
      },
      topPerformer
    });
    
  } catch (err) {
    next(err);
  }
};
