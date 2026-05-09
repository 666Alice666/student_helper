// script.js

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

async function apiRequest(url, options = {}) {
    const sessionCookie = getCookie('session');
    const headers = {
        'Content-Type': 'application/json',
        ...(sessionCookie ? { 'Cookie': `session=${sessionCookie}` } : {})
    };

    const response = await fetch(`http://127.0.0.1:5000${url}`, {
        ...options,
        headers: { ...headers, ...options.headers }
    });

    // Если ответ без тела (204, 205), возвращаем null
    if (response.status === 204 || response.status === 205) {
        return null;
    }

    // Иначе парсим JSON
    try {
        return await response.json();
    } catch (err) {
        console.warn('Не удалось распарсить JSON (возможно, пустой ответ)', response.status, response.statusText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
}

// --- Для главной страницы (main.html) ---
if (window.location.pathname === '/main' || window.location.pathname === '/') {
    document.addEventListener('DOMContentLoaded', async () => {
        // 1. Загрузить предметы
        async function loadSubjects() {
            try {
                const subjects = await apiRequest('/api/subjects', { method: 'GET' });
                const select = document.getElementById('subjectSelect');
                if (!select) return;
                select.innerHTML = '<option value="">Выберите предмет</option>';
                subjects.forEach(subject => {
                    const option = document.createElement('option');
                    option.value = subject.id;
                    option.textContent = subject.title;
                    select.appendChild(option);
                });
            } catch (err) {
                console.error('Ошибка загрузки предметов:', err);
            }
        }

        // 2. Добавить предмет
        const addSubjectForm = document.getElementById('addSubjectForm');
        if (addSubjectForm) {
            addSubjectForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const nameInput = document.getElementById('subjectName');
                const name = nameInput.value.trim();
                if (!name) return;

                try {
                    await apiRequest('/api/subjects', {
                        method: 'POST',
                        body: JSON.stringify({ title: name })
                    });
                    alert(`✅ Предмет "${name}" добавлен!`);
                    nameInput.value = '';
                    await loadSubjects();
                } catch (err) {
                    alert(`❌ Ошибка: ${err.message}`);
                }
            });
        }

        // 3. Добавить задачу
        const addTaskForm = document.getElementById('addTaskForm');
        if (addTaskForm) {
            addTaskForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const subjectId = document.getElementById('subjectSelect').value;
                const description = document.getElementById('taskDescription').value.trim();
                const deadline = document.getElementById('taskDeadline').value;

                if (!subjectId || !description || !deadline) {
                    alert('⚠️ Пожалуйста, заполните все поля.');
                    return;
                }

                try {
                    await apiRequest('/api/tasks', {
                        method: 'POST',
                        body: JSON.stringify({
                            subject_id: parseInt(subjectId),
                            description,
                            deadline
                        })
                    });
                    alert(`✅ Задача "${description}" добавлена!`);
                    document.getElementById('taskDescription').value = '';
                    document.getElementById('taskDeadline').value = '';
                    await loadClosestTasks();
                } catch (err) {
                    alert(`❌ Ошибка: ${err.message}`);
                }
            });
        }

        // 4. Загрузить ближайшие дедлайны
        async function loadClosestTasks() {
            try {
                const tasks = await apiRequest('/api/tasks', { method: 'GET' });
                const unfinished = tasks.filter(t => !t.is_done);
                unfinished.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
                const closest = unfinished.slice(0, 5);

                const container = document.getElementById('deadlineList');
                if (!container) return;

                if (closest.length === 0) {
                    container.innerHTML = '<p>Нет ближайших задач.</p>';
                    return;
                }

                const html = closest.map(t => `
                    <div>
                        <p><strong>${t.subject_title}</strong>: ${t.description}<br> 📅 ${new Date(t.deadline).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                    </div>
                `).join('');
                container.innerHTML = html;
            } catch (err) {
                console.error('Ошибка загрузки дедлайнов:', err);
                document.getElementById('deadlineList').innerHTML = `<p style="color:red">❌ ${err.message}</p>`;
            }
        }

        await loadSubjects();
        await loadClosestTasks();
    });
}

// --- Для страницы "Мои задачи" (mytasks.html) ---
if (window.location.pathname === '/mytasks') {
    document.addEventListener('DOMContentLoaded', async () => {
        async function loadMyTasks() {
            try {
                const tasks = await apiRequest('/api/tasks', { method: 'GET' });
                const unfinished = tasks.filter(t => !t.is_done);

                const container = document.getElementById('tasksList');
                if (!container) return;

                if (unfinished.length === 0) {
                    container.innerHTML = '<p>Нет невыполненных задач. Добавьте новую!</p>';
                    return;
                }

                const html = unfinished.map(t => `
                    <div class="task-card" data-task-id="${t.id}">
                        <div><strong>${t.subject_title}</strong>: ${t.description}</div>
                        <div>
                            📅 ${new Date(t.deadline).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </div>
                        <div>
                            <button class="btn-done" data-id="${t.id}">
                                ✅ Выполнено
                            </button>
                            <button class="btn-delete" data-id="${t.id}">
                                🗑 Удалить
                            </button>
                        </div>
                    </div>
                `).join('');

                container.innerHTML = html;

                // Обработчики кнопок — только после рендера!
                document.querySelectorAll('.btn-done').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const id = parseInt(btn.getAttribute('data-id'));
                        try {
                            await apiRequest(`/api/tasks/${id}`, {
                                method: 'PUT',
                                body: JSON.stringify({ is_done: true })
                            });
                            const card = btn.closest('.task-card');
                            card.remove();
                            alert('✅ Задача отмечена как выполненная!');
                        } catch (err) {
                            alert(`❌ ${err.message}`);
                        }
                    });
                });

                document.querySelectorAll('.btn-delete').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const id = parseInt(btn.getAttribute('data-id'));
                        if (!confirm('Удалить эту задачу?')) return;
                        try {
                            await apiRequest(`/api/tasks/${id}`, { method: 'DELETE' });
                            const card = btn.closest('.task-card');
                            card.remove();
                            alert('🗑 Задача удалена!');
                        } catch (err) {
                            alert(`❌ ${err.message}`);
                        }
                    });
                });

            } catch (err) {
                console.error('Ошибка загрузки задач:', err);
                document.getElementById('tasksList').innerHTML = `<p style="color:red">❌ ${err.message}</p>`;
            }
        }

        await loadMyTasks();
    });
}

// --- Для страницы "Выполненные задачи" (finished.html) ---
if (window.location.pathname === '/finished') {
    document.addEventListener('DOMContentLoaded', async () => {
        async function loadFinishedTasks() {
            try {
                const tasks = await apiRequest('/api/tasks', { method: 'GET' });
                // Фильтруем только выполненные
                const finished = tasks.filter(t => t.is_done);

                const container = document.getElementById('finishedTasksList');
                if (!container) return;

                if (finished.length === 0) {
                    container.innerHTML = '<p>Нет выполненных задач.</p>';
                    return;
                }

                const html = finished.map(t => `
                    <div class="task-card">
                        <div><strong>${t.subject_title}</strong>: ${t.description}</div>
                        <div style=>
                            📅 ${new Date(t.deadline).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </div>
                        <div>
                            ✅ Выполнено
                        </div>
                    </div>
                `).join('');

                container.innerHTML = html;

            } catch (err) {
                console.error('Ошибка загрузки выполненных задач:', err);
                document.getElementById('finishedTasksList').innerHTML = `<p style="color:red">❌ ${err.message}</p>`;
            }
        }

        await loadFinishedTasks();
    });
}

// --- Для страницы "Статистика" (statistics.html) ---
if (window.location.pathname === '/statistics') {
    document.addEventListener('DOMContentLoaded', async () => {
        async function loadStatistics() {
            try {
                const tasks = await apiRequest('/api/tasks', { method: 'GET' });

                const total = tasks.length;
                const completed = tasks.filter(t => t.is_done).length;
                const pending = total - completed;
                const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

                const container = document.getElementById('statsContainer');
                if (!container) return;

                container.innerHTML = `
                    <div class="stat-card">
                        <h3>Общее количество задач</h3>
                        <p>${total}</p>
                    </div>
                    <div class="stat-card completed">
                        <h3>Выполнено задач</h3>
                        <p>${completed}</p>
                    </div>
                    <div class="stat-card pending">
                        <h3>Осталось задач</h3>
                        <p>${pending}</p>
                    </div>
                    <div class="stat-card percentage">
                        <h3>Процент выполненных</h3>
                        <p class="percentage-value">${percentage}%</p>
                    </div>
                `;

            } catch (err) {
                console.error('Ошибка загрузки статистики:', err);
                document.getElementById('statsContainer').innerHTML = `<p style="color:red">❌ Ошибка: ${err.message}</p>`;
            }
        }

        await loadStatistics();
    });
}