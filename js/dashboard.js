import { injectIcons } from './icons.js';
import * as state from './state.js';
import * as ai from './ai-engine.js';
import { initCalendar, renderCalendar } from './calendar.js';
import { initVoice } from './voice.js';

// Timer State
let timerInterval = null;
let timerTimeLeft = 25 * 60; // 25 minutes
let timerDuration = 25 * 60;
let timerMode = 'focus'; // 'focus' or 'break'
let timerIsRunning = false;

// Active goal planner output
let activeGeneratedPlan = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  // Inject Icons
  injectIcons();

  // Navigation Logic
  setupNavigation();

  // Initialize Sub-Modules
  initCalendar(onStateChange);
  initVoice(onStateChange, switchTab, toggleFocusTimer);

  // Focus Timer Logic
  setupFocusTimer();

  // Tasks Board Logic
  setupTasksBoard();

  // Habits Tracker Logic
  setupHabitsTracker();

  // Agent Planning Logic
  setupAgentPlanner();

  // Settings Logic
  setupSettings();

  // Initial State Rendering
  renderDashboard();

  // Reset focus timer custom event listener
  document.addEventListener('reset-focus-timer', () => {
    resetFocusTimer();
  });
});

// Navigation Handling
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tabName = item.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
}

function switchTab(tabName) {
  // Update sidebar active status
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    if (item.getAttribute('data-tab') === tabName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Switch content section
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(content => {
    if (content.getAttribute('id') === tabName) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });

  // Perform view specific updates
  if (tabName === 'dashboard') {
    renderDashboard();
  } else if (tabName === 'tasks') {
    renderTasksBoardView();
  } else if (tabName === 'calendar') {
    renderCalendar(onStateChange);
  } else if (tabName === 'habits') {
    renderHabits();
  }

  // Re-inject icons in case new elements were added
  injectIcons();
}

function onStateChange() {
  // Sync all visual views that depend on state
  renderDashboard();
  renderTasksBoardView();
  renderCalendar(onStateChange);
  renderHabits();
}

// ----------------- 1. DASHBOARD RENDERER -----------------
function renderDashboard() {
  const settings = state.getSettings();
  const tasks = state.getTasks();
  const habits = state.getHabits();
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Set Welcome Text
  const welcomeMsg = document.getElementById('welcomeMessage');
  if (welcomeMsg) {
    const hours = new Date().getHours();
    let salutation = 'Good evening';
    if (hours < 12) salutation = 'Good morning';
    else if (hours < 18) salutation = 'Good afternoon';
    welcomeMsg.textContent = `${salutation}, ${settings.username}`;
  }

  // 2. Task Completion Stats
  const statsCompleted = document.getElementById('statsCompletedCount');
  if (statsCompleted) {
    const totalTodayTasks = tasks.filter(t => t.dueDate === todayStr || t.dateScheduled === todayStr).length;
    const completedTodayTasks = tasks.filter(t => (t.dueDate === todayStr || t.dateScheduled === todayStr) && t.status === 'done').length;
    statsCompleted.textContent = `${completedTodayTasks}/${totalTodayTasks}`;
  }

  // 3. Habit Streak Stats
  const statsHabit = document.getElementById('statsHabitStreak');
  if (statsHabit) {
    const maxStreak = habits.reduce((max, h) => h.streak > max ? h.streak : max, 0);
    statsHabit.textContent = `${maxStreak} Days`;
  }

  // 4. Cognitive Load bar
  const todayTasks = tasks.filter(t => t.status !== 'done' && (t.dueDate === todayStr || t.dateScheduled === todayStr));
  const todayLoadMinutes = todayTasks.reduce((sum, t) => sum + (parseInt(t.duration) || 60), 0);

  // Max energy limit is roughly 300 minutes (5 hours) of intense focus
  const loadPercentage = Math.min(100, Math.round((todayLoadMinutes / 300) * 100));
  const loadPercentageEl = document.getElementById('cognitiveLoadPercentage');
  const loadBarEl = document.getElementById('cognitiveLoadBar');
  const adviceEl = document.getElementById('cognitiveAdvice');

  if (loadPercentageEl && loadBarEl && adviceEl) {
    loadPercentageEl.textContent = `${loadPercentage}%`;
    loadBarEl.style.width = `${loadPercentage}%`;

    if (loadPercentage === 0) {
      adviceEl.textContent = 'No tasks scheduled today. Enjoy your day, or schedule a growth habit!';
      loadPercentageEl.style.color = 'var(--success)';
    } else if (loadPercentage <= 40) {
      adviceEl.textContent = 'Cognitive load is light. Great day to solve high priority tasks!';
      loadPercentageEl.style.color = 'var(--secondary)';
    } else if (loadPercentage <= 75) {
      adviceEl.textContent = 'Moderate load. Focus on your top 2 priorities and avoid multitasking.';
      loadPercentageEl.style.color = 'var(--warning)';
    } else {
      adviceEl.textContent = 'Warning: High cognitive load. Postpone administrative work. Focus only on critical paths.';
      loadPercentageEl.style.color = 'var(--danger)';
    }
  }

  // 5. Active Focus Task List for Today
  const focusList = document.getElementById('todayFocusTaskList');
  if (focusList) {
    focusList.innerHTML = '';
    const activeTasks = tasks.filter(t => t.status !== 'done' && (t.dueDate === todayStr || t.dateScheduled === todayStr));

    if (activeTasks.length === 0) {
      focusList.innerHTML = `
        <div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.85rem;">
          No active tasks scheduled for today. You’re fully caught up!
        </div>
      `;
    } else {
      // Sort: High priority first
      activeTasks.sort((a, b) => {
        const order = { high: 3, medium: 2, low: 1 };
        return order[b.priority] - order[a.priority];
      });

      activeTasks.forEach(task => {
        const item = document.createElement('div');
        item.className = 'list-view-row';
        item.style.padding = '0.75rem 1rem';
        item.style.borderLeft = `3px solid ${task.priority === 'high' ? 'var(--danger)' : task.priority === 'medium' ? 'var(--warning)' : 'var(--secondary)'}`;

        item.innerHTML = `
          <div style="display:flex; align-items:center; gap:0.75rem; flex-grow:1;">
            <input type="checkbox" class="task-checkbox" data-id="${task.id}" style="width:16px; height:16px; cursor:pointer;">
            <div style="display:flex; flex-direction:column;">
              <span style="font-weight:600; font-size:0.9rem;">${task.title}</span>
              <span style="font-size:0.75rem; color:var(--text-muted);">${task.category} • ${task.duration}m</span>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <span class="tag" style="background:rgba(255,255,255,0.03); color:var(--text-secondary);">${task.dueDate === todayStr ? 'Today' : 'Scheduled'}</span>
          </div>
        `;

        // Checkbox complete action
        item.querySelector('.task-checkbox').addEventListener('change', () => {
          state.updateTask(task.id, { status: 'done' });
          onStateChange();
        });

        focusList.appendChild(item);
      });
    }
  }

  // 6. Proactive AI Recommendations panel
  const recList = document.getElementById('aiRecommendationsList');
  if (recList) {
    recList.innerHTML = '';
    const recs = ai.getProactiveRecommendations();

    recs.forEach(rec => {
      const item = document.createElement('div');
      item.className = 'rec-item';

      let badgeClass = 'rec-badge';
      if (rec.type === 'warning') badgeClass += ' warning';
      else if (rec.type === 'action') badgeClass += ' action';
      else badgeClass += ' tip';

      item.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.5rem; flex-grow:1;">
          <div class="flex-between">
            <span class="${badgeClass}">${rec.badge}</span>
          </div>
          <div class="rec-content">
            <h4 class="rec-title">${rec.title}</h4>
            <p class="rec-desc">${rec.desc}</p>
          </div>
        </div>
        <div>
          <button class="rec-btn" data-action="${rec.action}" data-param="${rec.param}">${rec.actionText}</button>
        </div>
      `;

      // Handle click recommendation action
      item.querySelector('.rec-btn').addEventListener('click', (e) => {
        const action = e.target.getAttribute('data-action');
        const param = e.target.getAttribute('data-param');

        if (action === 'schedule-task') {
          switchTab('calendar');
        } else if (action === 'start-focus') {
          toggleFocusTimer(true);
        } else if (action === 'complete-habit') {
          state.toggleHabitDay(param, todayStr);
          onStateChange();
        } else if (action === 'show-tips') {
          alert('Cognitive load coaching tips:\n1. Limit multitasking: block single hours for specific goals.\n2. Take 5-minute movement breaks between deep work sessions.\n3. Complete high priority items early to lower baseline stress.');
        }
      });

      recList.appendChild(item);
    });
  }

  // 7. Dynamic User UI labels
  const usernameDisplay = document.getElementById('usernameDisplay');
  if (usernameDisplay) usernameDisplay.textContent = settings.username;

  const quickTaskBtn = document.getElementById('dashboardQuickTaskBtn');
  if (quickTaskBtn && !quickTaskBtn.dataset.listenerSetup) {
    quickTaskBtn.dataset.listenerSetup = 'true';
    quickTaskBtn.addEventListener('click', () => {
      openTaskModal();
    });
  }
}

// ----------------- 2. FOCUS POMODORO TIMER -----------------
function setupFocusTimer() {
  const playBtn = document.getElementById('timerPlayBtn');
  const resetBtn = document.getElementById('timerResetBtn');

  if (playBtn) {
    playBtn.addEventListener('click', () => {
      toggleFocusTimer();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetFocusTimer();
    });
  }

  updateTimerDisplay();
}

function toggleFocusTimer(forcePlay = null) {
  const playBtn = document.getElementById('timerPlayBtn');
  if (!playBtn) return;

  if (forcePlay !== null) {
    timerIsRunning = !forcePlay; // will toggle to the correct state
  }

  if (timerIsRunning) {
    // Pause
    clearInterval(timerInterval);
    timerInterval = null;
    timerIsRunning = false;
    playBtn.innerHTML = '';
    const span = document.createElement('span');
    span.setAttribute('data-icon', 'play');
    playBtn.appendChild(span);
    injectIcons();
  } else {
    // Start
    timerIsRunning = true;
    playBtn.innerHTML = '';
    const span = document.createElement('span');
    span.setAttribute('data-icon', 'pause');
    playBtn.appendChild(span);
    injectIcons();

    timerInterval = setInterval(() => {
      timerTimeLeft--;
      if (timerTimeLeft <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        timerIsRunning = false;

        // Mode finished alert & swap
        if (timerMode === 'focus') {
          speakOutput('Focus block complete. Take a 5-minute recovery break.');
          timerMode = 'break';
          timerDuration = 5 * 60;
          timerTimeLeft = 5 * 60;
        } else {
          speakOutput('Break session complete. Ready to begin your next focus sprint.');
          timerMode = 'focus';
          timerDuration = 25 * 60;
          timerTimeLeft = 25 * 60;
        }

        const statusEl = document.getElementById('timerStatus');
        if (statusEl) statusEl.textContent = timerMode.toUpperCase();

        playBtn.innerHTML = '';
        const playSpan = document.createElement('span');
        playSpan.setAttribute('data-icon', 'play');
        playBtn.appendChild(playSpan);
        injectIcons();

        updateTimerDisplay();
      }
      updateTimerDisplay();
    }, 1000);
  }
}

function resetFocusTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerIsRunning = false;
  timerMode = 'focus';
  timerDuration = 25 * 60;
  timerTimeLeft = 25 * 60;

  const statusEl = document.getElementById('timerStatus');
  if (statusEl) statusEl.textContent = 'FOCUS';

  const playBtn = document.getElementById('timerPlayBtn');
  if (playBtn) {
    playBtn.innerHTML = '';
    const span = document.createElement('span');
    span.setAttribute('data-icon', 'play');
    playBtn.appendChild(span);
    injectIcons();
  }

  updateTimerDisplay();
}

function updateTimerDisplay() {
  const timeEl = document.getElementById('timerTime');
  const ring = document.getElementById('timerProgressRing');
  if (!timeEl || !ring) return;

  const mins = Math.floor(timerTimeLeft / 60);
  const secs = timerTimeLeft % 60;
  timeEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  // Update circular dash-offset (length is 440)
  const ratio = timerTimeLeft / timerDuration;
  const offset = 440 - (ratio * 440);
  ring.style.strokeDashoffset = offset;
}

function speakOutput(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  }
}

// ----------------- 3. TASK BOARD & WORKSPACE -----------------
let boardViewMode = 'kanban'; // 'kanban' or 'list'

function setupTasksBoard() {
  const kanbanToggle = document.getElementById('kanbanToggleBtn');
  const listToggle = document.getElementById('listToggleBtn');
  const searchInput = document.getElementById('taskSearchInput');
  const createBtn = document.getElementById('createTaskBtn');

  const closeTaskModal = document.getElementById('closeTaskModalBtn');
  const cancelTaskForm = document.getElementById('cancelTaskFormBtn');
  const taskForm = document.getElementById('taskForm');

  if (kanbanToggle) {
    kanbanToggle.addEventListener('click', () => {
      boardViewMode = 'kanban';
      kanbanToggle.classList.add('active');
      listToggle.classList.remove('active');
      document.getElementById('kanbanView').style.display = 'grid';
      document.getElementById('listView').style.display = 'none';
      renderTasksBoardView();
    });
  }

  if (listToggle) {
    listToggle.addEventListener('click', () => {
      boardViewMode = 'list';
      listToggle.classList.add('active');
      kanbanToggle.classList.remove('active');
      document.getElementById('kanbanView').style.display = 'none';
      document.getElementById('listView').style.display = 'flex';
      renderTasksBoardView();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderTasksBoardView();
    });
  }

  if (createBtn) {
    createBtn.addEventListener('click', () => {
      openTaskModal();
    });
  }

  if (closeTaskModal) {
    closeTaskModal.addEventListener('click', () => closeTaskModalFn());
  }
  if (cancelTaskForm) {
    cancelTaskForm.addEventListener('click', () => closeTaskModalFn());
  }

  if (taskForm) {
    taskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveTaskForm();
    });
  }

  // Setup Kanban Columns drag events
  const columns = document.querySelectorAll('.board-column');
  columns.forEach(col => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      col.style.background = 'rgba(255,255,255,0.02)';
    });

    col.addEventListener('dragleave', () => {
      col.style.background = '';
    });

    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.style.background = '';
      const taskId = e.dataTransfer.getData('text/plain');
      const status = col.getAttribute('data-status');
      if (taskId && status) {
        state.updateTask(taskId, { status: status });
        onStateChange();
      }
    });
  });

  renderTasksBoardView();
}

function openTaskModal(task = null) {
  const modal = document.getElementById('taskModal');
  const titleInput = document.getElementById('taskTitle');
  const descInput = document.getElementById('taskDesc');
  const priorityInput = document.getElementById('taskPriority');
  const categoryInput = document.getElementById('taskCategory');
  const dateInput = document.getElementById('taskDueDate');
  const durationInput = document.getElementById('taskDuration');
  const editIdInput = document.getElementById('editTaskId');
  const modalTitle = document.getElementById('taskModalTitle');

  if (!modal) return;

  if (task) {
    modalTitle.textContent = 'Edit Productivity Task';
    editIdInput.value = task.id;
    titleInput.value = task.title;
    descInput.value = task.desc;
    priorityInput.value = task.priority;
    categoryInput.value = task.category;
    dateInput.value = task.dueDate;
    durationInput.value = task.duration;
  } else {
    modalTitle.textContent = 'Create Productivity Task';
    editIdInput.value = '';
    titleInput.value = '';
    descInput.value = '';
    priorityInput.value = 'medium';
    categoryInput.value = 'Work';
    dateInput.value = new Date().toISOString().split('T')[0];
    durationInput.value = '60';
  }

  modal.classList.add('active');
}

function closeTaskModalFn() {
  const modal = document.getElementById('taskModal');
  if (modal) modal.classList.remove('active');
}

function saveTaskForm() {
  const title = document.getElementById('taskTitle').value;
  const desc = document.getElementById('taskDesc').value;
  const priority = document.getElementById('taskPriority').value;
  const category = document.getElementById('taskCategory').value;
  const dueDate = document.getElementById('taskDueDate').value;
  const duration = document.getElementById('taskDuration').value;
  const editId = document.getElementById('editTaskId').value;

  if (editId) {
    // Edit existing
    state.updateTask(editId, { title, desc, priority, category, dueDate, duration });
  } else {
    // Create new
    state.addTask({ title, desc, priority, category, dueDate, duration });
  }

  closeTaskModalFn();
  onStateChange();
}

function renderTasksBoardView() {
  const tasks = state.getTasks();
  const searchInput = document.getElementById('taskSearchInput');
  const filterText = searchInput ? searchInput.value.toLowerCase().trim() : '';

  // Filter tasks based on query
  const filteredTasks = tasks.filter(t => {
    return t.title.toLowerCase().includes(filterText) ||
      t.desc.toLowerCase().includes(filterText) ||
      t.category.toLowerCase().includes(filterText);
  });

  if (boardViewMode === 'kanban') {
    // Render Columns
    const lists = {
      'todo': document.getElementById('list-todo'),
      'in-progress': document.getElementById('list-inprogress'),
      'done': document.getElementById('list-done')
    };

    const counts = {
      'todo': document.getElementById('count-todo'),
      'in-progress': document.getElementById('count-inprogress'),
      'done': document.getElementById('count-done')
    };

    // Clear lists
    Object.keys(lists).forEach(key => {
      if (lists[key]) lists[key].innerHTML = '';
      if (counts[key]) counts[key].textContent = '0';
    });

    const countsTracker = { 'todo': 0, 'in-progress': 0, 'done': 0 };

    filteredTasks.forEach(task => {
      const targetList = lists[task.status];
      if (!targetList) return;

      countsTracker[task.status]++;

      const card = document.createElement('div');
      card.className = 'task-card';
      card.draggable = true;
      card.dataset.id = task.id;

      const priorityScore = ai.calculatePriorityScore(task);
      const reasoning = ai.getPriorityReasoning(task, priorityScore);

      card.innerHTML = `
        <div class="task-tags">
          <span class="tag priority-${task.priority}">${task.priority} Priority</span>
          <span class="tag category">${task.category}</span>
        </div>
        <h4 class="task-card-title">${task.title}</h4>
        <p style="font-size:0.75rem; color:var(--text-secondary); line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${task.desc}</p>
        
        <div style="font-size:0.7rem; color:var(--text-muted); margin-top:0.5rem; font-style:italic;">
          AI: ${reasoning}
        </div>

        <div class="task-card-meta">
          <span class="task-due-date">
            <span style="display:inline-flex; width:12px; height:12px;" data-icon="clock"></span>
            Due ${task.dueDate}
          </span>
          <div class="task-card-actions">
            <button class="task-action-btn edit-btn" title="Edit Task">
              <span style="display:inline-flex; width:12px; height:12px;" data-icon="edit-2"></span>
            </button>
            <button class="task-action-btn delete-btn" title="Delete Task">
              <span style="display:inline-flex; width:12px; height:12px;" data-icon="trash-2"></span>
            </button>
          </div>
        </div>
      `;

      // Handle card Drag Start
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', task.id);
        card.style.opacity = '0.4';
      });

      card.addEventListener('dragend', () => {
        card.style.opacity = '1';
      });

      // Bind button events
      card.querySelector('.edit-btn').addEventListener('click', () => {
        openTaskModal(task);
      });

      card.querySelector('.delete-btn').addEventListener('click', () => {
        if (confirm(`Are you sure you want to delete task: "${task.title}"?`)) {
          state.deleteTask(task.id);
          onStateChange();
        }
      });

      targetList.appendChild(card);
    });

    // Update counts Labels
    Object.keys(counts).forEach(key => {
      if (counts[key]) counts[key].textContent = countsTracker[key];
    });

  } else {
    // Render List View
    const container = document.getElementById('listView');
    if (!container) return;
    container.innerHTML = '';

    if (filteredTasks.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:3rem; color:var(--text-muted);">
          No tasks found matching filter criteria.
        </div>
      `;
      return;
    }

    filteredTasks.forEach(task => {
      const row = document.createElement('div');
      row.className = 'list-view-row';
      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:1.25rem;">
          <input type="checkbox" class="task-checkbox" ${task.status === 'done' ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer;">
          <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <span style="font-weight:600; ${task.status === 'done' ? 'text-decoration:line-through; opacity:0.5;' : ''}">${task.title}</span>
            <span style="font-size:0.75rem; color:var(--text-muted);">${task.desc}</span>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:1.5rem;">
          <span class="tag priority-${task.priority}">${task.priority}</span>
          <span class="tag category">${task.category}</span>
          <span style="font-size:0.8rem; color:var(--text-secondary); width:90px; text-align:right;">Due ${task.dueDate}</span>
          <div class="task-card-actions">
            <button class="task-action-btn edit-btn">
              <span style="display:inline-flex; width:14px; height:14px;" data-icon="edit-2"></span>
            </button>
            <button class="task-action-btn delete-btn">
              <span style="display:inline-flex; width:14px; height:14px;" data-icon="trash-2"></span>
            </button>
          </div>
        </div>
      `;

      row.querySelector('.task-checkbox').addEventListener('change', (e) => {
        const nextStatus = e.target.checked ? 'done' : 'todo';
        state.updateTask(task.id, { status: nextStatus });
        onStateChange();
      });

      row.querySelector('.edit-btn').addEventListener('click', () => {
        openTaskModal(task);
      });

      row.querySelector('.delete-btn').addEventListener('click', () => {
        if (confirm(`Delete task: "${task.title}"?`)) {
          state.deleteTask(task.id);
          onStateChange();
        }
      });

      container.appendChild(row);
    });
  }

  injectIcons();
}

// ----------------- 4. HABITS TRACKING -----------------
function setupHabitsTracker() {
  const createHabitBtn = document.getElementById('addHabitBtn');
  const closeHabitModal = document.getElementById('closeHabitModalBtn');
  const cancelHabitForm = document.getElementById('cancelHabitFormBtn');
  const habitForm = document.getElementById('habitForm');

  if (createHabitBtn) {
    createHabitBtn.addEventListener('click', () => {
      document.getElementById('habitModal').classList.add('active');
    });
  }

  const closeFn = () => {
    document.getElementById('habitModal').classList.remove('active');
  };

  if (closeHabitModal) closeHabitModal.addEventListener('click', closeFn);
  if (cancelHabitForm) cancelHabitForm.addEventListener('click', closeFn);

  if (habitForm) {
    habitForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('habitName').value;
      const category = document.getElementById('habitCategory').value;

      state.addHabit({ name, category });
      habitForm.reset();
      closeFn();
      onStateChange();
    });
  }

  renderHabits();
}

function renderHabits() {
  const container = document.getElementById('habitsContainer');
  if (!container) return;
  container.innerHTML = '';

  const habits = state.getHabits();

  if (habits.length === 0) {
    container.innerHTML = `
      <div style="grid-column: span 2; text-align:center; padding:3rem; color:var(--text-muted);">
        No habits tracked yet. Consistency is the foundation of high productivity!
      </div>
    `;
    return;
  }

  // Get last 7 days starting from today (reverse order so today is far right or far left, let's render left-to-right: Mon to Sun or last 7 days ending today)
  const daysToShow = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    daysToShow.push({
      dateStr: d.toISOString().split('T')[0],
      dayName: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
      dayNum: d.getDate()
    });
  }

  habits.forEach(habit => {
    const card = document.createElement('div');
    card.className = 'card-glass habit-card';

    let daysHtml = '';
    daysToShow.forEach(day => {
      const isCompleted = habit.history.includes(day.dateStr);
      daysHtml += `
        <button class="habit-day-btn ${isCompleted ? 'completed' : ''}" 
                data-habit-id="${habit.id}" data-date="${day.dateStr}" 
                title="${isCompleted ? 'Mark incomplete' : 'Mark complete'} for ${day.dateStr}">
          <span class="habit-day-name">${day.dayName}</span>
          <span class="habit-day-date">${day.dayNum}</span>
        </button>
      `;
    });

    card.innerHTML = `
      <div class="habit-header">
        <div class="habit-title-wrap">
          <span class="habit-title">${habit.name}</span>
          <span style="font-size:0.75rem; color:var(--text-muted);">${habit.category}</span>
        </div>
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <div class="habit-streak">
            <span style="display:inline-flex;" data-icon="sparkles"></span>
            ${habit.streak} Day streak
          </div>
          <button class="task-action-btn delete-habit-btn" style="padding:4px;" title="Delete Habit">
            <span style="display:inline-flex; width:12px; height:12px;" data-icon="trash-2"></span>
          </button>
        </div>
      </div>

      <div class="habit-days">
        ${daysHtml}
      </div>
    `;

    // Bind Day check events
    card.querySelectorAll('.habit-day-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        // Prevent event bubbling issues
        const habitId = btn.getAttribute('data-habit-id');
        const date = btn.getAttribute('data-date');
        state.toggleHabitDay(habitId, date);
        onStateChange();
      });
    });

    // Bind Delete habit event
    card.querySelector('.delete-habit-btn').addEventListener('click', () => {
      if (confirm(`Delete habit "${habit.name}"?`)) {
        state.deleteHabit(habit.id);
        onStateChange();
      }
    });

    container.appendChild(card);
  });

  injectIcons();
}

// ----------------- 5. AI AUTONOMOUS GOAL PLANNER -----------------
function setupAgentPlanner() {
  const runBtn = document.getElementById('runAgentBtn');
  const syncBtn = document.getElementById('agentSyncBtn');

  if (runBtn) {
    runBtn.addEventListener('click', () => {
      triggerAgentPlanner();
    });
  }

  if (syncBtn) {
    syncBtn.addEventListener('click', () => {
      syncAgentTasks();
    });
  }
}

async function triggerAgentPlanner() {
  const goalInput = document.getElementById('agentGoalInput');
  const durationSelect = document.getElementById('agentDuration');
  const statusPanel = document.getElementById('agentStatusPanel');
  const welcomeScreen = document.getElementById('agentWelcomeScreen');
  const timelineWrapper = document.getElementById('timelineWrapper');
  const nodesContainer = document.getElementById('timelineNodesContainer');
  const syncControls = document.getElementById('agentSyncControls');

  if (!goalInput || !goalInput.value.trim()) {
    alert('Please enter a goal details before starting the planner!');
    return;
  }

  const goal = goalInput.value.trim();
  const targetDays = parseInt(durationSelect.value) || 3;
  const settings = state.getSettings();

  // Reset UI View
  welcomeScreen.style.display = 'none';
  timelineWrapper.style.display = 'none';
  syncControls.style.display = 'none';
  nodesContainer.innerHTML = '';
  statusPanel.style.display = 'flex';

  // Reset Progress Steps Visuals
  const stepIds = ['agentStep1', 'agentStep2', 'agentStep3', 'agentStep4'];
  stepIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.className = 'agent-progress-step';
      const icon = el.querySelector('.agent-step-icon');
      // Set to normal numbers
      if (id === 'agentStep1') icon.textContent = '1';
      if (id === 'agentStep2') icon.textContent = '2';
      if (id === 'agentStep3') icon.textContent = '3';
      if (id === 'agentStep4') icon.textContent = '4';
    }
  });

  // Step 1 Active
  setActiveStep('agentStep1');

  // Trigger countdown animations for visual steps
  setTimeout(() => {
    setCompletedStep('agentStep1');
    setActiveStep('agentStep2');
  }, 800);

  setTimeout(() => {
    setCompletedStep('agentStep2');
    setActiveStep('agentStep3');
  }, 1600);

  setTimeout(() => {
    setCompletedStep('agentStep3');
    setActiveStep('agentStep4');
  }, 2200);

  try {
    // Generate AI Breakdown
    const plan = await ai.getAutonomousGoalPlan(goal, targetDays, settings.apiKey);

    // Complete Step 4
    setCompletedStep('agentStep4');
    setTimeout(() => {
      statusPanel.style.display = 'none';
    }, 400);

    // Save active plan to reference
    activeGeneratedPlan = plan;

    // Render Timeline Nodes
    nodesContainer.innerHTML = '';
    plan.steps.forEach((step, index) => {
      const node = document.createElement('div');
      node.className = 'timeline-node';

      node.innerHTML = `
        <div class="timeline-badge">${index + 1}</div>
        <div class="timeline-card card-glass">
          <div class="flex-between" style="margin-bottom:0.4rem;">
            <h4 style="font-weight:700;">${step.title}</h4>
            <span class="tag priority-${step.priority}">${step.priority}</span>
          </div>
          <p style="font-size:0.8rem; color:var(--text-secondary); line-height:1.4;">${step.desc}</p>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-muted); margin-top:0.75rem; border-top:1px solid rgba(255,255,255,0.03); padding-top:0.4rem;">
            <span>Target date: <strong style="color:var(--text-secondary);">${step.dueDate}</strong></span>
            <span>Est: ${step.duration} mins</span>
          </div>
        </div>
      `;
      nodesContainer.appendChild(node);
    });

    timelineWrapper.style.display = 'block';
    syncControls.style.display = 'flex';

  } catch (err) {
    console.error('Agent plan creation failed:', err);
    statusPanel.style.display = 'none';
    welcomeScreen.style.display = 'block';
    alert('AI Planner failed to generate breakdown. Check your network or configurations.');
  }
}

function setActiveStep(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function setCompletedStep(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('active');
    el.classList.add('completed');
    const icon = el.querySelector('.agent-step-icon');
    icon.innerHTML = '✓';
  }
}

function syncAgentTasks() {
  if (!activeGeneratedPlan || !activeGeneratedPlan.steps) return;

  activeGeneratedPlan.steps.forEach(step => {
    state.addTask({
      title: step.title,
      desc: step.desc,
      priority: step.priority,
      category: step.category,
      dueDate: step.dueDate,
      duration: step.duration,
      status: 'todo'
    });
  });

  alert(`Sprint "${activeGeneratedPlan.title}" synced! added ${activeGeneratedPlan.steps.length} tasks to your workspace.`);

  // Clear planner output state
  activeGeneratedPlan = null;
  document.getElementById('agentGoalInput').value = '';
  document.getElementById('agentWelcomeScreen').style.display = 'block';
  document.getElementById('timelineWrapper').style.display = 'none';
  document.getElementById('agentSyncControls').style.display = 'none';

  onStateChange();

  // Switch to task board view so they can see them
  switchTab('tasks');
}

// ----------------- 6. SETTINGS & KEY MANAGEMENT -----------------
function setupSettings() {
  const settingsBtn = document.getElementById('settingsBtn');
  const closeSettingsBtn = document.getElementById('closeSettingsModalBtn');
  const cancelSettingsBtn = document.getElementById('cancelSettingsFormBtn');
  const settingsForm = document.getElementById('settingsForm');

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      openSettingsModal();
    });
  }

  const closeFn = () => {
    document.getElementById('settingsModal').classList.remove('active');
  };

  if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeFn);
  if (cancelSettingsBtn) cancelSettingsBtn.addEventListener('click', closeFn);

  if (settingsForm) {
    settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('settingsUsername').value;
      const apiKey = document.getElementById('settingsApiKey').value;
      const wakeTime = document.getElementById('settingsWakeTime').value;
      const sleepTime = document.getElementById('settingsSleepTime').value;

      state.updateSettings({ username, apiKey, wakeTime, sleepTime });
      closeFn();
      onStateChange();
    });
  }
}

function openSettingsModal() {
  const settings = state.getSettings();

  document.getElementById('settingsUsername').value = settings.username || '';
  document.getElementById('settingsApiKey').value = settings.apiKey || '';
  document.getElementById('settingsWakeTime').value = settings.wakeTime || '07:00';
  document.getElementById('settingsSleepTime').value = settings.sleepTime || '23:00';

  document.getElementById('settingsModal').classList.add('active');
}
