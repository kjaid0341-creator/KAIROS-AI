import { getTasks, updateTask } from './state.js';
import { getIconSvg } from './icons.js';

let currentDate = new Date(); // Tracks the currently viewed calendar month

export function initCalendar(onStateChangeCallback) {
  const prevBtn = document.getElementById('prevMonthBtn');
  const nextBtn = document.getElementById('nextMonthBtn');
  const todayBtn = document.getElementById('calendarTodayBtn');
  const autoScheduleBtn = document.getElementById('aiAutoScheduleBtn');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() - 1);
      renderCalendar(onStateChangeCallback);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() + 1);
      renderCalendar(onStateChangeCallback);
    });
  }

  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      currentDate = new Date();
      renderCalendar(onStateChangeCallback);
    });
  }

  if (autoScheduleBtn) {
    autoScheduleBtn.addEventListener('click', () => {
      triggerAiAutoSchedule(onStateChangeCallback);
    });
  }

  renderCalendar(onStateChangeCallback);
}

export function renderCalendar(onStateChangeCallback) {
  const grid = document.getElementById('calendarGrid');
  const monthYearLabel = document.getElementById('calendarMonthYear');
  if (!grid || !monthYearLabel) return;

  grid.innerHTML = '';
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Set header label (e.g. "July 2026")
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  monthYearLabel.textContent = `${monthNames[month]} ${year}`;

  // 1. Add Day Labels (Mon, Tue, Wed, etc.)
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  dayNames.forEach(day => {
    const label = document.createElement('div');
    label.className = 'calendar-day-label';
    label.textContent = day;
    grid.appendChild(label);
  });

  // Get first day of the month and total days
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  // Tasks mapped by date
  const tasks = getTasks();
  const tasksByDate = {};
  tasks.forEach(task => {
    if (task.dateScheduled) {
      if (!tasksByDate[task.dateScheduled]) {
        tasksByDate[task.dateScheduled] = [];
      }
      tasksByDate[task.dateScheduled].push(task);
    }
  });

  const todayStr = new Date().toISOString().split('T')[0];

  // 2. Render previous month cells (buffer days)
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = prevMonthTotalDays - i;
    const prevMonthDate = new Date(year, month - 1, dayNum);
    const dateStr = prevMonthDate.toISOString().split('T')[0];
    createCell(dayNum, dateStr, true, false, tasksByDate[dateStr] || [], grid, onStateChangeCallback);
  }

  // 3. Render current month cells
  for (let day = 1; day <= totalDays; day++) {
    const thisDate = new Date(year, month, day);
    const dateStr = thisDate.toISOString().split('T')[0];
    const isToday = dateStr === todayStr;
    createCell(day, dateStr, false, isToday, tasksByDate[dateStr] || [], grid, onStateChangeCallback);
  }

  // 4. Render next month cells (buffer days)
  const cellsRendered = firstDayIndex + totalDays;
  const remainingCells = cellsRendered % 7 === 0 ? 0 : 7 - (cellsRendered % 7);
  for (let day = 1; day <= remainingCells; day++) {
    const nextMonthDate = new Date(year, month + 1, day);
    const dateStr = nextMonthDate.toISOString().split('T')[0];
    createCell(day, dateStr, true, false, tasksByDate[dateStr] || [], grid, onStateChangeCallback);
  }
}

function createCell(dayNum, dateStr, isOtherMonth, isToday, dayTasks, container, onStateChangeCallback) {
  const cell = document.createElement('div');
  cell.className = 'calendar-cell';
  if (isOtherMonth) cell.classList.add('other-month');
  if (isToday) cell.classList.add('today');
  cell.dataset.date = dateStr;

  const numLabel = document.createElement('div');
  numLabel.className = 'calendar-cell-num';
  numLabel.textContent = dayNum;
  cell.appendChild(numLabel);

  // Render tasks inside cell
  dayTasks.forEach(task => {
    const taskEl = document.createElement('div');
    taskEl.className = 'calendar-task-item';
    taskEl.textContent = task.title;
    taskEl.draggable = true;
    taskEl.dataset.taskId = task.id;
    
    // Styling tags for calendar items
    if (task.status === 'done') {
      taskEl.style.textDecoration = 'line-through';
      taskEl.style.opacity = '0.5';
      taskEl.style.background = 'rgba(255,255,255,0.05)';
      taskEl.style.color = 'var(--text-muted)';
      taskEl.style.borderLeft = '2px solid var(--text-muted)';
    } else {
      if (task.priority === 'high') {
        taskEl.style.background = 'rgba(239, 68, 68, 0.1)';
        taskEl.style.color = 'var(--danger)';
        taskEl.style.borderLeft = '2px solid var(--danger)';
      } else if (task.priority === 'medium') {
        taskEl.style.background = 'rgba(245, 158, 11, 0.1)';
        taskEl.style.color = 'var(--warning)';
        taskEl.style.borderLeft = '2px solid var(--warning)';
      } else {
        taskEl.style.background = 'rgba(6, 182, 212, 0.1)';
        taskEl.style.color = 'var(--secondary)';
        taskEl.style.borderLeft = '2px solid var(--secondary)';
      }
    }

    // Drag events on calendar tasks
    taskEl.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', task.id);
      e.dataTransfer.effectAllowed = 'move';
      taskEl.style.opacity = '0.4';
    });

    taskEl.addEventListener('dragend', () => {
      taskEl.style.opacity = '1';
    });

    cell.appendChild(taskEl);
  });

  // Enable drag drop on the cell itself
  cell.addEventListener('dragover', (e) => {
    e.preventDefault();
    cell.style.background = 'rgba(255,255,255,0.05)';
  });

  cell.addEventListener('dragleave', () => {
    cell.style.background = '';
  });

  cell.addEventListener('drop', (e) => {
    e.preventDefault();
    cell.style.background = '';
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      updateTask(taskId, { dateScheduled: dateStr });
      if (onStateChangeCallback) onStateChangeCallback();
    }
  });

  container.appendChild(cell);
}

// AI Auto-Scheduler Algorithm
export function triggerAiAutoSchedule(onStateChangeCallback) {
  const tasks = getTasks();
  const today = new Date();
  
  // Get all incomplete, unscheduled tasks
  const unscheduledTasks = tasks.filter(t => t.status !== 'done' && !t.dateScheduled);
  
  if (unscheduledTasks.length === 0) {
    alert('No unscheduled tasks found. All tasks are currently assigned to time blocks!');
    return;
  }

  // Sort: High priority first, then medium, then low
  unscheduledTasks.sort((a, b) => {
    const priorityWeights = { high: 3, medium: 2, low: 1 };
    return priorityWeights[b.priority] - priorityWeights[a.priority];
  });

  // Create list of days starting today for the next 7 days
  const format = (d) => d.toISOString().split('T')[0];
  const dayCapacity = {}; // tracks cumulative duration scheduled for each date
  
  for (let i = 0; i < 7; i++) {
    const nextDay = new Date(today);
    nextDay.setDate(today.getDate() + i);
    const dateStr = format(nextDay);
    
    // Calculate current scheduled load
    const currentTasksForDay = tasks.filter(t => t.dateScheduled === dateStr);
    const loadMinutes = currentTasksForDay.reduce((sum, t) => sum + (parseInt(t.duration) || 60), 0);
    dayCapacity[dateStr] = loadMinutes;
  }

  let scheduledCount = 0;

  // Distribute tasks
  unscheduledTasks.forEach(task => {
    // Find the day with the minimum load capacity
    let optimalDate = null;
    let minLoad = Infinity;

    Object.keys(dayCapacity).forEach(dateStr => {
      // If task priority is High, prefer the next 3 days, don't schedule far out if possible
      const dateObj = new Date(dateStr);
      const daysFromToday = Math.ceil((dateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (task.priority === 'high' && daysFromToday > 3) {
        // High priority tasks shouldn't be pushed past 3 days unless forced
        return; 
      }

      if (dayCapacity[dateStr] < minLoad) {
        minLoad = dayCapacity[dateStr];
        optimalDate = dateStr;
      }
    });

    // Fallback if high priority constraint was too restrictive
    if (!optimalDate) {
      optimalDate = Object.keys(dayCapacity).reduce((minDate, dateStr) => {
        return dayCapacity[dateStr] < dayCapacity[minDate] ? dateStr : minDate;
      }, Object.keys(dayCapacity)[0]);
    }

    // Schedule the task
    updateTask(task.id, { dateScheduled: optimalDate });
    const duration = parseInt(task.duration) || 60;
    dayCapacity[optimalDate] += duration;
    scheduledCount++;
  });

  // Visual success feedback: glowing flash on grid
  const grid = document.getElementById('calendarGrid');
  if (grid) {
    grid.style.boxShadow = '0 0 30px var(--secondary-glow)';
    grid.style.borderColor = 'var(--secondary)';
    setTimeout(() => {
      grid.style.boxShadow = '';
      grid.style.borderColor = '';
    }, 1500);
  }

  // Trigger TTS voice confirmation if supported
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(`AI Auto-Schedule complete. Allocated ${scheduledCount} tasks, balancing your workload over the next week.`);
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  }

  // Notify UI
  if (onStateChangeCallback) onStateChangeCallback();
}
