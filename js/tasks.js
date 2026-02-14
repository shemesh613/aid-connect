// ============================================
// Aid Connect - Task Management
// ============================================

// Task type metadata
const TASK_TYPES = {
  medical: { icon: '🏥', label: 'רפואה / עזרה ראשונה', color: '#E53935' },
  transport: { icon: '🚗', label: 'הסעה / שינוע', color: '#1976D2' },
  shopping: { icon: '🛒', label: 'קניות / משלוחים', color: '#FB8C00' },
  general: { icon: '🤝', label: 'עזרה כללית', color: '#43A047' }
};

const URGENCY_LABELS = {
  high: 'גבוהה',
  medium: 'בינונית',
  low: 'נמוכה'
};

const STATUS_LABELS = {
  open: 'פתוחה',
  taken: 'נלקחה',
  completed: 'הושלמה',
  cancelled: 'בוטלה'
};

// State
let selectedTaskType = null;
let selectedUrgency = null;
let currentFilter = 'all';
let tasksUnsubscribe = null;
let notifyConfig = null;

// Load notification config (for admins)
async function loadNotifyConfig() {
  try {
    const doc = await db.collection('config').doc('notification').get();
    if (doc.exists) notifyConfig = doc.data();
  } catch (e) { /* non-admin or not configured */ }
}

// Trigger push notification via GitHub Actions
async function triggerPushNotification(eventType, taskId, taskData) {
  if (!notifyConfig) await loadNotifyConfig();
  if (!notifyConfig || !notifyConfig.ghToken) return;

  try {
    const resp = await fetch(
      `https://api.github.com/repos/${notifyConfig.ghOwner}/${notifyConfig.ghRepo}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${notifyConfig.ghToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          event_type: eventType,
          client_payload: { eventType, taskId, taskData }
        })
      }
    );
    if (resp.status === 204) {
      console.log('Push notification triggered:', eventType);
    } else {
      console.warn('Push trigger response:', resp.status);
    }
  } catch (err) {
    console.error('Push trigger error:', err);
  }
}

// Select task type (create form)
function selectTaskType(type) {
  selectedTaskType = type;
  document.querySelectorAll('.type-btn').forEach(btn => btn.classList.remove('selected'));
  document.querySelector(`.type-btn[data-type="${type}"]`).classList.add('selected');
}

// Select urgency (create form)
function selectUrgency(urgency) {
  selectedUrgency = urgency;
  document.querySelectorAll('.urgency-btn').forEach(btn => btn.classList.remove('selected'));
  document.querySelector(`.urgency-btn[data-urgency="${urgency}"]`).classList.add('selected');
}

// Create a new task (Admin)
async function createTask() {
  const title = document.getElementById('task-title').value.trim();
  const desc = document.getElementById('task-desc').value.trim();
  const locationFrom = document.getElementById('task-location-from').value.trim();
  const locationTo = document.getElementById('task-location-to').value.trim();
  const contact = document.getElementById('task-contact').value.trim();

  // Validation
  if (!selectedTaskType) { showToast('נא לבחור סוג משימה', 'error'); return; }
  if (!title) { showToast('נא להזין כותרת', 'error'); return; }
  if (!selectedUrgency) { showToast('נא לבחור דחיפות', 'error'); return; }

  const btn = document.getElementById('btn-create-task');
  btn.disabled = true;

  try {
    const user = auth.currentUser;
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();

    const task = {
      type: selectedTaskType,
      title: title,
      description: desc,
      urgency: selectedUrgency,
      locationFrom: locationFrom,
      locationTo: locationTo,
      contact: contact || userData.phone,
      status: 'open',
      createdBy: user.uid,
      createdByName: userData.name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      takenBy: null,
      takenByName: null,
      takenAt: null,
      completedAt: null
    };

    const docRef = await db.collection('tasks').add(task);

    // Update user stats
    await db.collection('users').doc(user.uid).update({
      tasksCreated: firebase.firestore.FieldValue.increment(1)
    });

    // Trigger push notification to volunteers
    triggerPushNotification('task_created', docRef.id, {
      type: task.type,
      title: task.title,
      urgency: task.urgency,
      createdBy: user.uid,
      createdByName: userData.name
    });

    // Clear form
    clearCreateForm();
    showToast('המשימה שוגרה בהצלחה! ✅');
    navigateTo('dashboard');

  } catch (error) {
    console.error('Create task error:', error);
    showToast('שגיאה ביצירת המשימה', 'error');
  } finally {
    btn.disabled = false;
  }
}

function clearCreateForm() {
  document.getElementById('task-title').value = '';
  document.getElementById('task-desc').value = '';
  document.getElementById('task-location-from').value = '';
  document.getElementById('task-location-to').value = '';
  document.getElementById('task-contact').value = '';
  selectedTaskType = null;
  selectedUrgency = null;
  document.querySelectorAll('.type-btn, .urgency-btn').forEach(btn => btn.classList.remove('selected'));
}

// Take a task (Volunteer)
async function takeTask(taskId) {
  try {
    const user = auth.currentUser;
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();

    // Use transaction to prevent race conditions
    await db.runTransaction(async (transaction) => {
      const taskRef = db.collection('tasks').doc(taskId);
      const taskDoc = await transaction.get(taskRef);

      if (!taskDoc.exists) throw new Error('המשימה לא נמצאה');
      if (taskDoc.data().status !== 'open') throw new Error('המשימה כבר נלקחה');

      transaction.update(taskRef, {
        status: 'taken',
        takenBy: user.uid,
        takenByName: userData.name,
        takenAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      transaction.update(db.collection('users').doc(user.uid), {
        tasksTaken: firebase.firestore.FieldValue.increment(1)
      });
    });

    // Notify admin
    const taskDoc = await db.collection('tasks').doc(taskId).get();
    const taskData = taskDoc.data();
    triggerPushNotification('task_taken', taskId, {
      title: taskData.title,
      takenByName: userData.name,
      createdBy: taskData.createdBy
    });

    showToast('לקחת את המשימה! 💪');
    closeModal();

  } catch (error) {
    console.error('Take task error:', error);
    showToast(error.message || 'שגיאה בלקיחת המשימה', 'error');
  }
}

// Complete a task
async function completeTask(taskId) {
  try {
    const user = auth.currentUser;

    await db.collection('tasks').doc(taskId).update({
      status: 'completed',
      completedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await db.collection('users').doc(user.uid).update({
      tasksCompleted: firebase.firestore.FieldValue.increment(1)
    });

    // Notify admin
    const taskDoc = await db.collection('tasks').doc(taskId).get();
    const taskData = taskDoc.data();
    triggerPushNotification('task_completed', taskId, {
      title: taskData.title,
      takenByName: taskData.takenByName,
      createdBy: taskData.createdBy
    });

    showToast('המשימה הושלמה! 🎉');
    closeModal();

  } catch (error) {
    console.error('Complete task error:', error);
    showToast('שגיאה בסיום המשימה', 'error');
  }
}

// Cancel a task (Admin)
async function cancelTask(taskId) {
  if (!confirm('לבטל את המשימה?')) return;

  try {
    await db.collection('tasks').doc(taskId).update({
      status: 'cancelled'
    });
    showToast('המשימה בוטלה');
    closeModal();
  } catch (error) {
    console.error('Cancel task error:', error);
    showToast('שגיאה בביטול המשימה', 'error');
  }
}

// Listen to open tasks (real-time)
function listenToTasks() {
  if (tasksUnsubscribe) tasksUnsubscribe();

  let query = db.collection('tasks')
    .where('status', 'in', ['open', 'taken'])
    .orderBy('createdAt', 'desc');

  tasksUnsubscribe = query.onSnapshot((snapshot) => {
    const tasks = [];
    snapshot.forEach(doc => {
      tasks.push({ id: doc.id, ...doc.data() });
    });
    renderTasks(tasks);
  }, (error) => {
    console.error('Listen tasks error:', error);
  });
}

// Listen to user's tasks
function listenToMyTasks(userId) {
  db.collection('tasks')
    .where('takenBy', '==', userId)
    .orderBy('takenAt', 'desc')
    .onSnapshot((snapshot) => {
      const tasks = [];
      snapshot.forEach(doc => {
        tasks.push({ id: doc.id, ...doc.data() });
      });
      renderMyTasks(tasks);
    });
}

// Listen to all tasks (Admin)
function listenToAllTasks() {
  db.collection('tasks')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .onSnapshot((snapshot) => {
      const tasks = [];
      snapshot.forEach(doc => {
        tasks.push({ id: doc.id, ...doc.data() });
      });
      renderAdminTasks(tasks);
      updateStats(tasks);
    });
}

// Filter tasks
function filterTasks(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-chips .chip').forEach(c => c.classList.remove('active'));
  document.querySelector(`.chip[data-filter="${filter}"]`).classList.add('active');

  // Re-render with filter
  const cards = document.querySelectorAll('#tasks-list .task-card');
  cards.forEach(card => {
    if (filter === 'all' || card.dataset.type === filter) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });
}

// Render open tasks (Volunteer view)
function renderTasks(tasks) {
  const container = document.getElementById('tasks-list');
  const empty = document.getElementById('tasks-empty');
  const counter = document.getElementById('open-tasks-count');

  const openTasks = tasks.filter(t => t.status === 'open');
  counter.textContent = openTasks.length;

  if (openTasks.length === 0) {
    container.innerHTML = '';
    empty.style.display = '';
    return;
  }

  empty.style.display = 'none';
  container.innerHTML = openTasks.map(task => renderTaskCard(task, 'volunteer')).join('');

  // Apply current filter
  if (currentFilter !== 'all') filterTasks(currentFilter);

  // Update nav badge
  const badge = document.getElementById('nav-badge-tasks');
  if (badge) {
    if (openTasks.length > 0) {
      badge.textContent = openTasks.length;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }
}

// Render my tasks (Volunteer view)
function renderMyTasks(tasks) {
  const container = document.getElementById('my-tasks-list');
  const empty = document.getElementById('my-tasks-empty');

  if (tasks.length === 0) {
    container.innerHTML = '';
    empty.style.display = '';
    return;
  }

  empty.style.display = 'none';
  container.innerHTML = tasks.map(task => renderTaskCard(task, 'my')).join('');
}

// Render admin tasks
function renderAdminTasks(tasks) {
  const container = document.getElementById('admin-tasks-list');
  container.innerHTML = tasks.map(task => renderTaskCard(task, 'admin')).join('');
}

// Render a single task card
function renderTaskCard(task, context) {
  const type = TASK_TYPES[task.type] || TASK_TYPES.general;
  const urgencyClass = task.status === 'open' ? `urgent-${task.urgency}` : task.status;
  const time = task.createdAt ? formatTime(task.createdAt.toDate()) : '';

  let actions = '';
  if (context === 'volunteer' && task.status === 'open') {
    actions = `
      <div class="task-actions">
        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); takeTask('${task.id}')">
          <span class="material-icons-round">front_hand</span>
          אני לוקח!
        </button>
        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); showTaskDetail('${task.id}')">
          פרטים
        </button>
      </div>`;
  } else if (context === 'my' && task.status === 'taken') {
    actions = `
      <div class="task-actions">
        <button class="btn btn-success btn-sm" onclick="event.stopPropagation(); completeTask('${task.id}')">
          <span class="material-icons-round">check</span>
          סיימתי!
        </button>
      </div>`;
  } else if (task.status === 'taken') {
    actions = `
      <div class="task-taken-info">
        <span class="material-icons-round">person</span>
        נלקחה ע"י ${task.takenByName || 'מתנדב'}
      </div>`;
  } else if (task.status === 'completed') {
    actions = `
      <div class="task-taken-info" style="background:#E8F5E9; color:#43A047;">
        <span class="material-icons-round">check_circle</span>
        הושלמה
      </div>`;
  }

  const location = (task.locationFrom || task.locationTo) ? `
    <div class="task-location">
      <span class="material-icons-round">location_on</span>
      ${task.locationFrom || ''}${task.locationFrom && task.locationTo ? ' → ' : ''}${task.locationTo || ''}
    </div>` : '';

  return `
    <div class="task-card ${urgencyClass}" data-type="${task.type}" data-id="${task.id}" onclick="showTaskDetail('${task.id}')">
      <div class="task-header">
        <span class="task-type">${type.icon} ${type.label}</span>
        <span class="task-urgency ${task.urgency}">${URGENCY_LABELS[task.urgency]}</span>
      </div>
      <div class="task-title">${escapeHtml(task.title)}</div>
      ${task.description ? `<div class="task-desc">${escapeHtml(task.description)}</div>` : ''}
      ${location}
      <div class="task-meta">
        <span class="task-meta-item">
          <span class="material-icons-round">schedule</span>
          ${time}
        </span>
        <span class="task-meta-item">
          <span class="material-icons-round">person</span>
          ${escapeHtml(task.createdByName || '')}
        </span>
      </div>
      ${actions}
    </div>`;
}

// Update dashboard stats
function updateStats(tasks) {
  const total = tasks.length;
  const open = tasks.filter(t => t.status === 'open').length;
  const urgent = tasks.filter(t => t.urgency === 'high' && t.status === 'open').length;
  const completed = tasks.filter(t => t.status === 'completed').length;

  const el = (id) => document.getElementById(id);
  if (el('stat-total')) el('stat-total').textContent = total;
  if (el('stat-open')) el('stat-open').textContent = open;
  if (el('stat-urgent')) el('stat-urgent').textContent = urgent;
  if (el('stat-completed')) el('stat-completed').textContent = completed;
}

// Show task detail modal
async function showTaskDetail(taskId) {
  try {
    const doc = await db.collection('tasks').doc(taskId).get();
    if (!doc.exists) return;

    const task = { id: doc.id, ...doc.data() };
    const type = TASK_TYPES[task.type] || TASK_TYPES.general;
    const user = auth.currentUser;
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userRole = userDoc.data().role;

    let actions = '';
    if (task.status === 'open' && userRole === 'volunteer') {
      actions = `<button class="btn btn-primary btn-full" onclick="takeTask('${task.id}')">
        <span class="material-icons-round">front_hand</span> אני לוקח!
      </button>`;
    } else if (task.status === 'taken' && task.takenBy === user.uid) {
      actions = `<button class="btn btn-success btn-full" onclick="completeTask('${task.id}')">
        <span class="material-icons-round">check</span> סיימתי!
      </button>`;
    }
    if (userRole === 'admin' && task.status === 'open') {
      actions += `<button class="btn btn-danger btn-full" onclick="cancelTask('${task.id}')" style="margin-top:8px;">
        <span class="material-icons-round">cancel</span> בטל משימה
      </button>`;
    }

    const content = document.getElementById('task-detail-content');
    content.innerHTML = `
      <div class="task-detail-header">
        <div class="task-detail-type-icon">${type.icon}</div>
        <div class="task-detail-info">
          <h2>${escapeHtml(task.title)}</h2>
          <small>${type.label}</small>
        </div>
      </div>
      ${task.description ? `
        <div class="task-detail-row">
          <span class="material-icons-round">description</span>
          <span>${escapeHtml(task.description)}</span>
        </div>` : ''}
      <div class="task-detail-row">
        <span class="material-icons-round">priority_high</span>
        <strong>דחיפות</strong>
        <span class="task-urgency ${task.urgency}">${URGENCY_LABELS[task.urgency]}</span>
      </div>
      <div class="task-detail-row">
        <span class="material-icons-round">info</span>
        <strong>סטטוס</strong>
        <span>${STATUS_LABELS[task.status]}</span>
      </div>
      ${task.locationFrom ? `
        <div class="task-detail-row">
          <span class="material-icons-round">my_location</span>
          <strong>מ-</strong>
          <span>${escapeHtml(task.locationFrom)}</span>
        </div>` : ''}
      ${task.locationTo ? `
        <div class="task-detail-row">
          <span class="material-icons-round">location_on</span>
          <strong>אל-</strong>
          <span>${escapeHtml(task.locationTo)}</span>
        </div>` : ''}
      ${task.contact ? `
        <div class="task-detail-row">
          <span class="material-icons-round">phone</span>
          <strong>טלפון</strong>
          <a href="tel:${task.contact}" style="color:var(--primary);">${task.contact}</a>
        </div>` : ''}
      ${task.takenByName ? `
        <div class="task-detail-row">
          <span class="material-icons-round">person</span>
          <strong>מתנדב</strong>
          <span>${escapeHtml(task.takenByName)}</span>
        </div>` : ''}
      <div class="task-detail-row">
        <span class="material-icons-round">person_outline</span>
        <strong>יוצר</strong>
        <span>${escapeHtml(task.createdByName || '')}</span>
      </div>
      <div class="task-detail-row">
        <span class="material-icons-round">schedule</span>
        <strong>זמן</strong>
        <span>${task.createdAt ? formatDateTime(task.createdAt.toDate()) : ''}</span>
      </div>
      <div style="margin-top:16px;">
        ${actions}
      </div>
    `;

    document.getElementById('modal-task-detail').classList.add('active');
  } catch (error) {
    console.error('Task detail error:', error);
  }
}

function closeModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('modal-task-detail').classList.remove('active');
}

// Utility functions
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(date) {
  if (!date) return '';
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return 'עכשיו';
  if (minutes < 60) return `לפני ${minutes} דק'`;
  if (hours < 24) return `לפני ${hours} שע'`;

  return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

function formatDateTime(date) {
  if (!date) return '';
  return date.toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
