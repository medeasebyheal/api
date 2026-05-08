import mongoose from 'mongoose';
import { McqAttempt } from '../models/McqAttempt.js';
import { ContentVisit } from '../models/ContentVisit.js';
import { EaseGPTResponse } from '../models/EaseGPTResponse.js';
import { OspeEaseGPTResponse } from '../models/OspeEaseGPTResponse.js';
import { User } from '../models/User.js';
import { TopicAttempt } from '../models/TopicAttempt.js';
import { Topic } from '../models/Topic.js';
import { Mcq } from '../models/Mcq.js';
import { Subject } from '../models/Subject.js';
import { Module } from '../models/Module.js';
import { Year } from '../models/Year.js';
import { UserPackage } from '../models/UserPackage.js';
import { Package } from '../models/Package.js';
import { Payment } from '../models/Payment.js';
import { GeminiUsageLog } from '../models/GeminiUsageLog.js';

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

export const getAdvancedStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const dateFilter = { createdAt: { $gte: start, $lte: end } };

    // 1. Year-wise topic engagement (Visits)
    const yearWiseVisits = await ContentVisit.aggregate([
      { $match: { ...dateFilter, contentType: 'topic' } },
      { $lookup: { from: 'topics', localField: 'contentId', foreignField: '_id', as: 'topic' } },
      { $unwind: '$topic' },
      { $lookup: { from: 'subjects', localField: 'topic.subject', foreignField: '_id', as: 'subject' } },
      { $unwind: '$subject' },
      { $lookup: { from: 'modules', localField: 'subject.module', foreignField: '_id', as: 'module' } },
      { $unwind: '$module' },
      { $lookup: { from: 'years', localField: 'module.year', foreignField: '_id', as: 'year' } },
      { $unwind: '$year' },
      { $group: { _id: '$year.name', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // 2. Year-wise MCQ attempts
    const yearWiseAttempts = await McqAttempt.aggregate([
      { $match: dateFilter },
      { $lookup: { from: 'mcqs', localField: 'mcq', foreignField: '_id', as: 'mcq' } },
      { $unwind: '$mcq' },
      { $lookup: { from: 'topics', localField: 'mcq.topic', foreignField: '_id', as: 'topic' } },
      { $unwind: '$topic' },
      { $lookup: { from: 'subjects', localField: 'topic.subject', foreignField: '_id', as: 'subject' } },
      { $unwind: '$subject' },
      { $lookup: { from: 'modules', localField: 'subject.module', foreignField: '_id', as: 'module' } },
      { $unwind: '$module' },
      { $lookup: { from: 'years', localField: 'module.year', foreignField: '_id', as: 'year' } },
      { $unwind: '$year' },
      { $group: { _id: '$year.name', count: { $sum: 1 }, correct: { $sum: { $cond: ['$correct', 1, 0] } } } },
      { $sort: { _id: 1 } }
    ]);

    // 3. Performance Trends (Success rate over time - monthly)
    const performanceTrends = await McqAttempt.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          total: { $sum: 1 },
          correct: { $sum: { $cond: ['$correct', 1, 0] } }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      yearWiseVisits,
      yearWiseAttempts,
      performanceTrends
    });
  } catch (err) {
    next(err);
  }
};

export const getMcqOptionStats = async (req, res, next) => {
  try {
    const { topicId, search, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    let match = {};
    if (topicId) {
      match.topic = new mongoose.Types.ObjectId(topicId);
    }
    if (search) {
      match.question = { $regex: search, $options: 'i' };
    }

    const totalMcqs = await Mcq.countDocuments(match);
    const mcqs = await Mcq.find(match).skip(skip).limit(limitNum).lean();
    const mcqIds = mcqs.map(m => m._id);

    const attempts = await McqAttempt.aggregate([
      { $match: { mcq: { $in: mcqIds } } },
      {
        $group: {
          _id: { mcq: '$mcq', selectedIndex: '$selectedIndex' },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.mcq',
          options: {
            $push: {
              index: '$_id.selectedIndex',
              count: '$count'
            }
          },
          total: { $sum: '$count' }
        }
      }
    ]);

    const attemptMap = new Map(attempts.map(a => [a._id.toString(), a]));

    const stats = mcqs.map(mcq => {
      const attemptData = attemptMap.get(mcq._id.toString()) || { options: [], total: 0 };
      return {
        _id: mcq._id,
        question: mcq.question,
        correctIndex: mcq.correctIndex,
        options: attemptData.options,
        total: attemptData.total,
        mcqOptions: mcq.options
      };
    });

    res.json({
      stats,
      pagination: {
        total: totalMcqs,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalMcqs / limitNum)
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getStudentReports = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const year = req.query.year ? parseInt(req.query.year) : null;

    // 1. Find all paid packages
    const paidPackages = await Package.find({ 
      type: { $not: /-free$/ },
      deleted: { $ne: true }
    }).select('_id');

    // 2. Find users who have at least one active paid package
    const paidUsers = await UserPackage.distinct('user', { 
      package: { $in: paidPackages.map(p => p._id) },
      status: 'active'
    });

    let match = {
      _id: { $in: paidUsers },
      role: 'student'
    };

    if (search) {
      match.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (year) {
      match['academicDetails.year'] = year;
    }

    const users = await User.find(match)
      .select('name email createdAt studyStreakDays academicDetails')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await User.countDocuments(match);

    const reports = await Promise.all(users.map(async (user) => {
      // Get detailed stats for this user
      const mcqCount = await McqAttempt.countDocuments({ user: user._id });
      const correctCount = await McqAttempt.countDocuments({ user: user._id, correct: true });
      const topicAttempts = await TopicAttempt.countDocuments({ user: user._id });
      const totalTime = await TopicAttempt.aggregate([
        { $match: { user: user._id } },
        { $group: { _id: null, total: { $sum: '$timeTakenSeconds' } } }
      ]);

      // Categorize by year
      const yearWiseStats = await TopicAttempt.aggregate([
        { $match: { user: user._id } },
        { $lookup: { from: 'topics', localField: 'topic', foreignField: '_id', as: 'topic' } },
        { $unwind: '$topic' },
        { $lookup: { from: 'subjects', localField: 'topic.subject', foreignField: '_id', as: 'subject' } },
        { $unwind: '$subject' },
        { $lookup: { from: 'modules', localField: 'subject.module', foreignField: '_id', as: 'module' } },
        { $unwind: '$module' },
        { $lookup: { from: 'years', localField: 'module.year', foreignField: '_id', as: 'year' } },
        { $unwind: '$year' },
        {
          $group: {
            _id: '$year.name',
            count: { $sum: 1 },
            avgScore: { $avg: '$score' }
          }
        }
      ]);

      return {
        ...user,
        mcqCount,
        accuracy: mcqCount > 0 ? (correctCount / mcqCount * 100).toFixed(1) : 0,
        topicAttempts,
        totalTimeSeconds: totalTime[0]?.total || 0,
        yearWiseStats
      };
    }));

    res.json({
      reports,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getStudentDetailedReport = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const user = await User.findById(studentId).select('name email academicDetails').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    // 1. MCQ Attempt History
    const mcqHistory = await McqAttempt.find({ user: studentId })
      .populate('mcq', 'question options correctIndex')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalMcqs = await McqAttempt.countDocuments({ user: studentId });

    // 2. Performance Summary
    const stats = await McqAttempt.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(studentId) } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          correct: { $sum: { $cond: ['$correct', 1, 0] } }
        }
      }
    ]);

    const summary = stats[0] || { total: 0, correct: 0 };
    summary.accuracy = summary.total > 0 ? (summary.correct / summary.total * 100).toFixed(1) : 0;

    // 3. Topic-wise performance
    const topicPerformance = await McqAttempt.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(studentId) } },
      { $lookup: { from: 'mcqs', localField: 'mcq', foreignField: '_id', as: 'mcqDoc' } },
      { $unwind: '$mcqDoc' },
      { $lookup: { from: 'topics', localField: 'mcqDoc.topic', foreignField: '_id', as: 'topic' } },
      { $unwind: '$topic' },
      {
        $group: {
          _id: '$topic._id',
          name: { $first: '$topic.name' },
          total: { $sum: 1 },
          correct: { $sum: { $cond: ['$correct', 1, 0] } }
        }
      },
      { $sort: { total: -1 } },
      { $limit: 10 }
    ]);

    // 4. Activity Insights (attempts over last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const activityHistory = await McqAttempt.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(studentId), createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      user,
      mcqHistory,
      pagination: {
        total: totalMcqs,
        page,
        limit,
        totalPages: Math.ceil(totalMcqs / limit)
      },
      summary,
      topicPerformance,
      activityHistory
    });
  } catch (err) {
    next(err);
  }
};

// ─── Phase 1 KPI Endpoints ─────────────────────────────────────────────────

export const getOverviewKpis = async (req, res, next) => {
  try {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const weekAgo    = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000);
    const monthAgo   = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [dauIds, wauIds, mauIds] = await Promise.all([
      McqAttempt.distinct('user', { createdAt: { $gte: todayStart } }),
      McqAttempt.distinct('user', { createdAt: { $gte: weekAgo } }),
      McqAttempt.distinct('user', { createdAt: { $gte: monthAgo } }),
    ]);
    const paidPkgs   = await Package.find({ type: { $not: /-free$/ }, deleted: { $ne: true } }).select('_id').lean();
    const paidPkgIds = paidPkgs.map(p => p._id);
    const [totalPaidStudents, pendingPayments, revenueAgg, accuracyAgg, easeGptToday, mcqsToday] = await Promise.all([
      UserPackage.distinct('user', { package: { $in: paidPkgIds }, status: 'active' }).then(a => a.length),
      Payment.countDocuments({ status: 'pending' }),
      Payment.aggregate([{ $match: { status: 'approved', createdAt: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      McqAttempt.aggregate([{ $match: { createdAt: { $gte: monthAgo } } }, { $group: { _id: null, total: { $sum: 1 }, correct: { $sum: { $cond: ['$correct', 1, 0] } } } }]),
      GeminiUsageLog.countDocuments({ timestamp: { $gte: todayStart } }),
      McqAttempt.countDocuments({ createdAt: { $gte: todayStart } }),
    ]);
    const acc = accuracyAgg[0] || { total: 0, correct: 0 };
    res.json({ dau: dauIds.length, wau: wauIds.length, mau: mauIds.length, totalPaidStudents, pendingPayments, revenueThisMonth: revenueAgg[0]?.total || 0, avgAccuracy: acc.total > 0 ? ((acc.correct / acc.total) * 100).toFixed(1) : 0, easeGptToday, mcqsToday });
  } catch (err) { next(err); }
};

export const getActiveStudentsTrend = async (req, res, next) => {
  try {
    const days  = Math.min(parseInt(req.query.days) || 30, 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const trend = await McqAttempt.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, activeUsers: { $addToSet: '$user' }, attempts: { $sum: 1 } } },
      { $project: { date: '$_id', activeUsers: { $size: '$activeUsers' }, attempts: 1 } },
      { $sort: { _id: 1 } },
    ]);
    res.json(trend);
  } catch (err) { next(err); }
};

export const getAtRiskStudents = async (req, res, next) => {
  try {
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 15;
    const skip   = (page - 1) * limit;
    const cutoff = new Date(Date.now() - (parseInt(req.query.days) || 7) * 24 * 60 * 60 * 1000);
    const paidPkgs    = await Package.find({ type: { $not: /-free$/ }, deleted: { $ne: true } }).select('_id').lean();
    const paidUserIds = await UserPackage.distinct('user', { package: { $in: paidPkgs.map(p => p._id) }, status: 'active' });
    const recentIds   = await McqAttempt.distinct('user', { user: { $in: paidUserIds }, createdAt: { $gte: cutoff } });
    const recentSet   = new Set(recentIds.map(id => id.toString()));
    const atRiskIds   = paidUserIds.filter(id => !recentSet.has(id.toString()));
    const users = await User.find({ _id: { $in: atRiskIds } })
      .select('name email academicDetails studyStreakDays createdAt')
      .sort({ studyStreakDays: 1, createdAt: -1 })
      .skip(skip).limit(limit).lean();
    const enriched = await Promise.all(users.map(async u => {
      const last = await McqAttempt.findOne({ user: u._id }).sort({ createdAt: -1 }).select('createdAt').lean();
      return { ...u, lastActivityDate: last?.createdAt || null, daysInactive: last ? Math.floor((Date.now() - new Date(last.createdAt)) / 86400000) : null };
    }));
    res.json({ students: enriched, total: atRiskIds.length, page, limit, totalPages: Math.ceil(atRiskIds.length / limit) });
  } catch (err) { next(err); }
};

export const getMcqHeatmap = async (req, res, next) => {
  try {
    const start = req.query.startDate ? new Date(req.query.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end   = req.query.endDate   ? new Date(req.query.endDate)   : new Date();
    const heatmap = await McqAttempt.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $lookup: { from: 'mcqs',     localField: 'mcq',           foreignField: '_id', as: 'mcqDoc'  } }, { $unwind: '$mcqDoc' },
      { $lookup: { from: 'topics',   localField: 'mcqDoc.topic',  foreignField: '_id', as: 'topic'   } }, { $unwind: '$topic' },
      { $lookup: { from: 'subjects', localField: 'topic.subject', foreignField: '_id', as: 'subject' } }, { $unwind: '$subject' },
      { $lookup: { from: 'modules',  localField: 'subject.module',foreignField: '_id', as: 'module'  } }, { $unwind: '$module' },
      { $lookup: { from: 'years',    localField: 'module.year',   foreignField: '_id', as: 'year'    } }, { $unwind: '$year' },
      { $group: { _id: { subjectId: '$subject._id', subjectName: '$subject.name', yearName: '$year.name' }, attempts: { $sum: 1 }, correct: { $sum: { $cond: ['$correct', 1, 0] } } } },
      { $sort: { attempts: -1 } }, { $limit: 120 },
    ]);
    res.json(heatmap);
  } catch (err) { next(err); }
};

export const getMostFailedMcqs = async (req, res, next) => {
  try {
    const minAttempts = parseInt(req.query.minAttempts) || 5;
    const limit       = parseInt(req.query.limit)       || 20;
    const failed = await McqAttempt.aggregate([
      { $group: { _id: '$mcq', total: { $sum: 1 }, correct: { $sum: { $cond: ['$correct', 1, 0] } }, incorrect: { $sum: { $cond: [{ $not: '$correct' }, 1, 0] } } } },
      { $match: { total: { $gte: minAttempts } } },
      { $addFields: { failRate: { $multiply: [{ $divide: ['$incorrect', '$total'] }, 100] } } },
      { $sort: { failRate: -1 } }, { $limit: limit },
      { $lookup: { from: 'mcqs',     localField: '_id',           foreignField: '_id', as: 'mcqDoc'  } }, { $unwind: '$mcqDoc' },
      { $lookup: { from: 'topics',   localField: 'mcqDoc.topic',  foreignField: '_id', as: 'topic'   } }, { $unwind: { path: '$topic',   preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'subjects', localField: 'topic.subject', foreignField: '_id', as: 'subject' } }, { $unwind: { path: '$subject', preserveNullAndEmptyArrays: true } },
      { $project: { question: '$mcqDoc.question', options: '$mcqDoc.options', correctIndex: '$mcqDoc.correctIndex', topicName: '$topic.name', subjectName: '$subject.name', total: 1, correct: 1, incorrect: 1, failRate: 1 } },
    ]);
    res.json(failed);
  } catch (err) { next(err); }
};

export const getRevenueStats = async (req, res, next) => {
  try {
    const months = Math.min(parseInt(req.query.months) || 12, 24);
    const since  = new Date(); since.setMonth(since.getMonth() - months); since.setDate(1); since.setHours(0,0,0,0);
    const paidPkgs = await Package.find({ type: { $not: /-free$/ }, deleted: { $ne: true } }).select('_id').lean();
    const freePkgs = await Package.find({ type: /-free$/ }).select('_id').lean();
    const [monthlyRevenue, packageDistribution, revenueByPackage, totalRegistered, freeTrialCount, paidCount, promoStats] = await Promise.all([
      Payment.aggregate([
        { $match: { status: 'approved', createdAt: { $gte: since } } },
        { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, revenue: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      UserPackage.aggregate([
        { $match: { status: 'active' } },
        { $lookup: { from: 'packages', localField: 'package', foreignField: '_id', as: 'pkg' } }, { $unwind: '$pkg' },
        { $group: { _id: '$pkg.type', count: { $sum: 1 } } }, { $sort: { count: -1 } },
      ]),
      Payment.aggregate([
        { $match: { status: 'approved', createdAt: { $gte: since } } },
        { $lookup: { from: 'packages', localField: 'package', foreignField: '_id', as: 'pkg' } }, { $unwind: '$pkg' },
        { $group: { _id: '$pkg.type', revenue: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { revenue: -1 } },
      ]),
      User.countDocuments({ role: 'student' }),
      UserPackage.distinct('user', { package: { $in: freePkgs.map(p => p._id) } }).then(a => a.length),
      UserPackage.distinct('user', { package: { $in: paidPkgs.map(p => p._id) }, status: 'active' }).then(a => a.length),
      Payment.aggregate([
        { $match: { status: 'approved', promoCode: { $exists: true, $ne: null } } },
        { $group: { _id: null, totalWithPromo: { $sum: 1 }, totalDiscount: { $sum: { $subtract: [{ $ifNull: ['$originalAmount', '$amount'] }, '$amount'] } } } },
      ]),
    ]);
    res.json({ monthlyRevenue, packageDistribution, revenueByPackage, conversionFunnel: { registered: totalRegistered, freeTrial: freeTrialCount, paid: paidCount, conversionRate: freeTrialCount > 0 ? ((paidCount / freeTrialCount) * 100).toFixed(1) : 0 }, promoStats: promoStats[0] || { totalWithPromo: 0, totalDiscount: 0 } });
  } catch (err) { next(err); }
};
