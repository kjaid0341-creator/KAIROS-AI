const STORAGE_KEY = 'kairos_ai_state';

// Helper to get formatted dates relative to today
const getRelativeDateStr = (daysOffset) => {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
};

const defaultState = {
  settings: {
    username: 'Safak Ali',
    apiKey: '',
    wakeTime: '07:00',
    sleepTime: '23:00'
  },
  tasks: [
    {
      id: 'task-1',
      title: 'Review Hackathon Project Pitch',
      desc: 'Formulate the hook, describe our unique proactive AI agent, and design key presentation slides.',
      priority: 'high',
      category: 'Work',
      dueDate: getRelativeDateStr(1),
      duration: '60',
      status: 'todo',
      dateScheduled: null,
      dateCompleted: null
    },
    {
      id: 'task-2',
      title: 'Design System Architecture & APIs',
      desc: 'Plan components, design state structures, and identify hooks for local voice NLP commands.',
      priority: 'high',
      category: 'Work',
      dueDate: getRelativeDateStr(2),
      duration: '120',
      status: 'in-progress',
      dateScheduled: getRelativeDateStr(2), // Pre-scheduled for visually populated calendar
      dateCompleted: null
    },
    {
      id: 'task-3',
      title: 'Read Gemini API Documentation',
      desc: 'Understand structured outputs, system instructions, and audio prompt context windows.',
      priority: 'medium',
      category: 'Study',
      dueDate: getRelativeDateStr(3),
      duration: '60',
      status: 'todo',
      dateScheduled: null,
      dateCompleted: null
    },
    {
      id: 'task-4',
      title: 'Workout (Cardio & Core)',
      desc: 'Go for a 3km run and complete standard core routine.',
      priority: 'low',
      category: 'Health',
      dueDate: getRelativeDateStr(0),
      duration: '30',
      status: 'done',
      dateScheduled: getRelativeDateStr(0),
      dateCompleted: getRelativeDateStr(0)
    },
    {
      id: 'task-5',
      title: 'Submit Hackathon Draft Proposal',
      desc: 'Upload documentation and initial implementation roadmap for mentor review.',
      priority: 'high',
      category: 'Work',
      dueDate: getRelativeDateStr(0),
      duration: '60',
      status: 'todo',
      dateScheduled: getRelativeDateStr(0),
      dateCompleted: null
    }
  ],
  habits: [
    {
      id: 'habit-1',
      name: 'Write Code Daily',
      category: 'Work',
      streak: 5,
      history: [
        getRelativeDateStr(-1),
        getRelativeDateStr(-2),
        getRelativeDateStr(-3),
        getRelativeDateStr(-4),
        getRelativeDateStr(-5)
      ]
    },
    {
      id: 'habit-2',
      name: 'LeetCode Problem',
      category: 'Study',
      streak: 3,
      history: [
        getRelativeDateStr(-1),
        getRelativeDateStr(-2),
        getRelativeDateStr(-3)
      ]
    },
    {
      id: 'habit-3',
      name: 'Drink 3L Water',
      category: 'Health',
      streak: 0,
      history: []
    }
  ]
};

let appState = null;

export function loadState() {
  if (appState) return appState;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      appState = JSON.parse(raw);
      // Backfill missing fields from defaultState if any (for safety)
      appState.settings = { ...defaultState.settings, ...appState.settings };
      if (!appState.tasks) appState.tasks = [...defaultState.tasks];
      if (!appState.habits) appState.habits = [...defaultState.habits];
    } else {
      appState = JSON.parse(JSON.stringify(defaultState)); // Deep clone
      saveState();
    }
  } catch (e) {
    console.error('Error loading state from localStorage:', e);
    appState = JSON.parse(JSON.stringify(defaultState));
  }
  return appState;
}

export function saveState() {
  if (!appState) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (e) {
    console.error('Error saving state to localStorage:', e);
  }
}

// Tasks Actions
export function getTasks() {
  return loadState().tasks;
}

export function addTask(taskData) {
  const state = loadState();
  const newTask = {
    id: `task-${Date.now()}`,
    title: taskData.title,
    desc: taskData.desc || '',
    priority: taskData.priority || 'medium',
    category: taskData.category || 'Work',
    dueDate: taskData.dueDate,
    duration: taskData.duration || '60',
    status: taskData.status || 'todo',
    dateScheduled: taskData.dateScheduled || null,
    dateCompleted: null
  };
  state.tasks.push(newTask);
  saveState();
  return newTask;
}

export function updateTask(id, updatedFields) {
  const state = loadState();
  const idx = state.tasks.findIndex(t => t.id === id);
  if (idx !== -1) {
    // If completed
    if (updatedFields.status === 'done' && state.tasks[idx].status !== 'done') {
      updatedFields.dateCompleted = getRelativeDateStr(0);
    } else if (updatedFields.status && updatedFields.status !== 'done') {
      updatedFields.dateCompleted = null;
    }
    
    state.tasks[idx] = { ...state.tasks[idx], ...updatedFields };
    saveState();
    return state.tasks[idx];
  }
  return null;
}

export function deleteTask(id) {
  const state = loadState();
  state.tasks = state.tasks.filter(t => t.id !== id);
  saveState();
}

// Habits Actions
export function getHabits() {
  return loadState().habits;
}

export function addHabit(habitData) {
  const state = loadState();
  const newHabit = {
    id: `habit-${Date.now()}`,
    name: habitData.name,
    category: habitData.category || 'Health',
    streak: 0,
    history: []
  };
  state.habits.push(newHabit);
  saveState();
  return newHabit;
}

export function toggleHabitDay(id, dateStr) {
  const state = loadState();
  const habit = state.habits.find(h => h.id === id);
  if (!habit) return null;

  const idx = habit.history.indexOf(dateStr);
  if (idx === -1) {
    // Complete it
    habit.history.push(dateStr);
    habit.history.sort(); // keep sorted
  } else {
    // Uncomplete it
    habit.history.splice(idx, 1);
  }

  // Recalculate streak (consecutive days counting backwards from today or yesterday)
  habit.streak = calculateStreak(habit.history);
  saveState();
  return habit;
}

export function deleteHabit(id) {
  const state = loadState();
  state.habits = state.habits.filter(h => h.id !== id);
  saveState();
}

function calculateStreak(history) {
  if (history.length === 0) return 0;
  
  const completedSet = new Set(history);
  let streak = 0;
  let checkDate = new Date();
  
  // Format check date as YYYY-MM-DD
  const format = (d) => d.toISOString().split('T')[0];
  
  // If not completed today, check starting from yesterday
  if (!completedSet.has(format(checkDate))) {
    checkDate.setDate(checkDate.getDate() - 1);
  }
  
  while (completedSet.has(format(checkDate))) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }
  
  return streak;
}

// Settings Actions
export function getSettings() {
  return loadState().settings;
}

export function updateSettings(newSettings) {
  const state = loadState();
  state.settings = { ...state.settings, ...newSettings };
  saveState();
  return state.settings;
}
