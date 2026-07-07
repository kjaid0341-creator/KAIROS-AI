import { getTasks, getHabits } from './state.js';

// Calculate AI Priority Score (0 - 100)
export function calculatePriorityScore(task) {
  if (task.status === 'done') return 0;
  
  let score = 0;
  
  // 1. Priority Base
  if (task.priority === 'high') score += 35;
  else if (task.priority === 'medium') score += 20;
  else score += 8;

  // 2. Proximity to Due Date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.dueDate);
  due.setHours(0, 0, 0, 0);
  
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    // Overdue
    score += 50; 
  } else if (diffDays === 0) {
    // Due today
    score += 40;
  } else if (diffDays === 1) {
    // Due tomorrow
    score += 25;
  } else if (diffDays <= 3) {
    score += 15;
  } else if (diffDays <= 7) {
    score += 5;
  }

  // 3. Duration Impact (Slightly penalize extremely long tasks on high pressure days, or reward completion of quick wins)
  const duration = parseInt(task.duration) || 60;
  if (duration <= 30) {
    score += 5; // Quick wins
  }

  return Math.min(100, score);
}

// Generate Priority Reasoning text
export function getPriorityReasoning(task, score) {
  if (task.status === 'done') return 'Completed';

  const today = new Date();
  today.setHours(0,0,0,0);
  const due = new Date(task.dueDate);
  due.setHours(0,0,0,0);
  
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return `Critical (${score}/100): Overdue by ${Math.abs(diffDays)} days. Needs immediate resolution.`;
  }
  if (diffDays === 0) {
    return `Urgent (${score}/100): Due today. Start a 25-minute Pomodoro session now to lock focus.`;
  }
  if (diffDays === 1) {
    return `High Attention (${score}/100): Due tomorrow. We recommend allocating a block in your calendar today.`;
  }
  if (score > 50) {
    return `Active (${score}/100): High importance with upcoming deadline.`;
  }
  return `Normal (${score}/100): Structured for normal progression.`;
}

// Proactive Recommendation Engine
export function getProactiveRecommendations() {
  const tasks = getTasks();
  const habits = getHabits();
  const todayStr = new Date().toISOString().split('T')[0];
  const recs = [];

  const incompleteTasks = tasks.filter(t => t.status !== 'done');
  const overdueTasks = incompleteTasks.filter(t => {
    const due = new Date(t.dueDate);
    due.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);
    return due.getTime() < today.getTime();
  });

  // 1. Check for Overdue Tasks
  if (overdueTasks.length > 0) {
    const topOverdue = overdueTasks[0];
    recs.push({
      type: 'warning',
      badge: 'deadline warning',
      title: `Overdue: "${topOverdue.title}"`,
      desc: 'This deadline has passed. Let’s auto-schedule a recovery block today to complete it.',
      actionText: 'Schedule Now',
      action: 'schedule-task',
      param: topOverdue.id
    });
  }

  // 2. High cognitive load checking
  const highPriorityToday = incompleteTasks.filter(t => t.priority === 'high' && t.dueDate === todayStr);
  if (highPriorityToday.length >= 2) {
    recs.push({
      type: 'tip',
      badge: 'focus advisory',
      title: 'High Cognitive Load Detected',
      desc: `You have ${highPriorityToday.length} high-priority tasks due today. Block out the morning for deep work and turn off notifications.`,
      actionText: 'Start Pomodoro',
      action: 'start-focus',
      param: null
    });
  }

  // 3. Habit consistency checks
  const incompleteHabitsToday = habits.filter(h => !h.history.includes(todayStr));
  if (incompleteHabitsToday.length > 0) {
    const habit = incompleteHabitsToday[0];
    recs.push({
      type: 'action',
      badge: 'habit prompt',
      title: `Maintain Streak: "${habit.name}"`,
      desc: habit.streak > 0 
        ? `You're on a ${habit.streak}-day streak! Check off this habit today to keep the momentum going.`
        : `Start a new streak today. Doing this daily builds long term neural conditioning.`,
      actionText: 'Check Completed',
      action: 'complete-habit',
      param: habit.id
    });
  }

  // 4. Fallback default advice
  if (recs.length < 3) {
    recs.push({
      type: 'tip',
      badge: 'ai wisdom',
      title: 'Distraction Minimization',
      desc: 'Working in 90-minute ultradian rhythm cycles matches your brain energy peaks. Try it for your next session.',
      actionText: 'Learn More',
      action: 'show-tips',
      param: null
    });
  }

  return recs;
}

// Semantic local backup breakdowns
const LOCAL_PLANNER_DB = [
  {
    keywords: ['code', 'build', 'develop', 'app', 'website', 'software', 'project'],
    title: 'Software Development Sprint Plan',
    steps: [
      { title: 'Define Specs & Architecture', desc: 'Detail system variables, data schema design, and core interfaces.', duration: '60', offset: 0, priority: 'high', category: 'Work' },
      { title: 'Setup Development Environment', desc: 'Initialize git repo, install dependencies, configure styling systems.', duration: '60', offset: 0, priority: 'medium', category: 'Work' },
      { title: 'Implement Core API & Business Logic', desc: 'Write databases hooks, controllers, and integrate base features.', duration: '120', offset: 1, priority: 'high', category: 'Work' },
      { title: 'Build UI Components & Layouts', desc: 'Create styling pages, navigation views, and connect state hooks.', duration: '180', offset: 1, priority: 'high', category: 'Work' },
      { title: 'Debugging & Verification Checks', desc: 'Test logic borders, solve console issues, verify responsiveness.', duration: '60', offset: 2, priority: 'medium', category: 'Work' }
    ]
  },
  {
    keywords: ['interview', 'leetcode', 'algorithms', 'prepare', 'job'],
    title: 'Technical Interview Prep Roadmap',
    steps: [
      { title: 'Review Time/Space Complexity (Big O)', desc: 'Re-familiarize with arrays, hash maps, binary trees, and recursion metrics.', duration: '60', offset: 0, priority: 'high', category: 'Study' },
      { title: 'Solve 2 Array/String LeetCode Exercises', desc: 'Solve Two Sum, Valid Parentheses, or similar sliding window issues.', duration: '60', offset: 0, priority: 'medium', category: 'Study' },
      { title: 'Review Tree/Graph Traversals (BFS/DFS)', desc: 'Study tree algorithms, preorder/inorder visits, and basic graph paths.', duration: '120', offset: 1, priority: 'high', category: 'Study' },
      { title: 'Conduct Mock Coding Session', desc: 'Practice talking out loud under a 45-minute timed exam constraints.', duration: '60', offset: 1, priority: 'high', category: 'Study' },
      { title: 'Review System Design Fundamentals', desc: 'Read on load balancers, database caching, CDN structures, and consistency.', duration: '120', offset: 2, priority: 'medium', category: 'Study' }
    ]
  },
  {
    keywords: ['trip', 'travel', 'vacation', 'flight', 'sf'],
    title: 'Travel Preparation Guide',
    steps: [
      { title: 'Book Flights & Lodging Details', desc: 'Compare options, reserve stays close to focal landmarks, double-check times.', duration: '60', offset: 0, priority: 'high', category: 'Personal' },
      { title: 'Outline Daily Sightseeing Route', desc: 'Identify primary attractions, dinner locations, and transport methods.', duration: '60', offset: 0, priority: 'medium', category: 'Personal' },
      { title: 'Pack Clothes & Tech Gear Essentials', desc: 'Pack chargers, travel power adapters, matching outfits, and documents.', duration: '60', offset: 1, priority: 'medium', category: 'Personal' },
      { title: 'Confirm Check-ins & Security Details', desc: 'Register boarding passes, notify bank of international usage, lock house.', duration: '30', offset: 2, priority: 'high', category: 'Personal' }
    ]
  }
];

// Fallback generator
function generateLocalPlan(goal, targetDays) {
  const lowercaseGoal = goal.toLowerCase();
  let selectedTemplate = null;

  // Search keyword match
  for (const template of LOCAL_PLANNER_DB) {
    if (template.keywords.some(keyword => lowercaseGoal.includes(keyword))) {
      selectedTemplate = template;
      break;
    }
  }

  // Generic Default Template if no match
  if (!selectedTemplate) {
    selectedTemplate = {
      title: 'AI Planned Roadmap',
      steps: [
        { title: 'Initial Analysis & Planning', desc: 'Clarify core goals, research constraints, and list milestones.', duration: '60', offset: 0, priority: 'high', category: 'Work' },
        { title: 'Gather Resources & Assets', desc: 'Download developer libraries, gather documents, set environment details.', duration: '60', offset: 0, priority: 'medium', category: 'Work' },
        { title: 'Execute Primary Action Steps', desc: 'Do the main focus task work, drafting, coding, or prototyping.', duration: '120', offset: 1, priority: 'high', category: 'Work' },
        { title: 'Secondary Phase Refinement', desc: 'Perform review iterations, polish edges, check parameters.', duration: '120', offset: 1, priority: 'medium', category: 'Work' },
        { title: 'Finalization & Delivery check', desc: 'Submit roadmap, verify performance, celebrate completion.', duration: '60', offset: 2, priority: 'high', category: 'Work' }
      ]
    };
  }

  // Adjust offsets based on targetDays
  const steps = selectedTemplate.steps.map((step, index) => {
    // Distribute offsets across the targeted day span
    const stepRatio = index / selectedTemplate.steps.length;
    const computedOffset = Math.floor(stepRatio * targetDays);
    
    // YYYY-MM-DD
    const d = new Date();
    d.setDate(d.getDate() + computedOffset);
    const dueDateStr = d.toISOString().split('T')[0];

    return {
      title: step.title,
      desc: step.desc,
      duration: step.duration,
      priority: step.priority,
      category: step.category,
      dueDate: dueDateStr
    };
  });

  return {
    success: true,
    title: selectedTemplate.title,
    steps: steps
  };
}

// Live Gemini API Plan Generator
async function generateGeminiPlan(goal, targetDays, apiKey) {
  const prompt = `You are an expert project planner. Break down the following user goal: "${goal}" into a structured task sequence spanning ${targetDays} days.
Provide your response strictly in the following JSON format:
{
  "title": "A short summary title of the sprint",
  "steps": [
    {
      "title": "Name of task",
      "desc": "Short explanation of work to do",
      "priority": "high" or "medium" or "low",
      "category": "Work" or "Study" or "Personal" or "Health" or "Life",
      "duration": "estimated minutes (e.g. 30, 60, 120)",
      "dayOffset": integer (from 0 to ${targetDays - 1} indicating which day this task belongs to relative to today)
    }
  ]
}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API Error: Status ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.candidates[0].content.parts[0].text;
    const plan = JSON.parse(rawText);

    // Map dayOffset to actual YYYY-MM-DD strings
    const steps = plan.steps.map(step => {
      const offset = parseInt(step.dayOffset) || 0;
      const d = new Date();
      d.setDate(d.getDate() + offset);
      const dueDateStr = d.toISOString().split('T')[0];

      return {
        title: step.title,
        desc: step.desc,
        duration: String(step.duration || 60),
        priority: step.priority || 'medium',
        category: step.category || 'Work',
        dueDate: dueDateStr
      };
    });

    return {
      success: true,
      title: plan.title || 'Gemini Planned Road',
      steps: steps
    };

  } catch (error) {
    console.error('Failed querying Gemini. Defaulting to local AI simulation.', error);
    // Return local plan as fallback
    return generateLocalPlan(goal, targetDays);
  }
}

// Universal Planner Entrypoint
export async function getAutonomousGoalPlan(goal, targetDays, apiKey) {
  if (apiKey && apiKey.trim() !== '') {
    return await generateGeminiPlan(goal, targetDays, apiKey);
  } else {
    // Simulate thinking lag for nice visual effect in dashboard
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(generateLocalPlan(goal, targetDays));
      }, 2500);
    });
  }
}
