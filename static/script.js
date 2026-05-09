// Функция для получения текущего user_id из куки
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

// Универсальная функция для отправки запросов с кукой сессии
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

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
}

// 1. Загрузить предметы и заполнить select
async function loadSubjects() {
    try {
        const subjects = await apiRequest('/api/subjects', { method: 'GET' });
        const select = document.getElementById('subjectSelect');
        select.innerHTML = '<option value="">Выберите предмет</option>';
        subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject.id;
            option.textContent = subject.title;
            select.appendChild(option);
        });
    } catch (err) {
        console.error('Ошибка загрузки предметов:', err);
        document.getElementById('deadlineList').innerHTML = `<p style="color:red">❌ Ошибка: ${err.message}</p>`;
    }
}

// 2. Добавить новый предмет
document.getElementById('addSubjectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('subjectName');
    const name = nameInput.value.trim();
    if (!name) return;

    try {
        const newSubject = await apiRequest('/api/subjects', {
            method: 'POST',
            body: JSON.stringify({ title: name })
        });
        alert(`✅ Предмет "${newSubject.title}" добавлен!`);
        nameInput.value = '';
        await loadSubjects(); // Обновляем список
    } catch (err) {
        alert(`❌ Ошибка: ${err.message}`);
        console.error(err);
    }
});

// 3. Добавить новую задачу
document.getElementById('addTaskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const subjectId = document.getElementById('subjectSelect').value;
    const description = document.getElementById('taskDescription').value.trim();
    const deadline = document.getElementById('taskDeadline').value;

    if (!subjectId || !description || !deadline) {
        alert('⚠️ Пожалуйста, заполните все поля.');
        return;
    }

    try {
        const newTask = await apiRequest('/api/tasks', {
            method: 'POST',
            body: JSON.stringify({
                subject_id: parseInt(subjectId),
                description: description,
                deadline: deadline
            })
        });
        alert(`✅ Задача "${description}" добавлена!`);
        document.getElementById('taskDescription').value = '';
        document.getElementById('taskDeadline').value = '';
        await loadTasks(); // Обновляем список задач
    } catch (err) {
        alert(`❌ Ошибка: ${err.message}`);
        console.error(err);
    }
});

// 4. Загрузить и отобразить только 5 ближайших НЕВЫПОЛНЕННЫХ задач
async function loadTasks() {
    try {
        const tasks = await apiRequest('/api/tasks', { method: 'GET' });

        // Фильтруем: только невыполненные (is_done === false)
        const unfinishedTasks = tasks.filter(task => !task.is_done);

        // Сортируем по дедлайну (ближайшие сверху)
        unfinishedTasks.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

        // Берём только первые 5
        const closestTasks = unfinishedTasks.slice(0, 5);

        const container = document.getElementById('deadlineList');

        if (closestTasks.length === 0) {
            container.innerHTML = '<p>Нет ближайших задач. Добавьте новую!</p>';
            return;
        }

        const html = closestTasks.map(task => `
            <div class="task-item">
                <p><strong>${task.subject_title}</strong>: ${task.description}<br>📅 ${new Date(task.deadline).toLocaleDateString('ru-RU', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short'
                    })}
                </p>
            </div>
        `).join('');

        container.innerHTML = html;

    } catch (err) {
        console.error('Ошибка загрузки задач:', err);
        document.getElementById('deadlineList').innerHTML = `<p style="color:red">❌ Ошибка: ${err.message}</p>`;
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    await loadSubjects();
    await loadTasks();
});