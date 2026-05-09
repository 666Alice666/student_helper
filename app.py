from extensions import db
from flask import Flask, render_template, request, redirect, url_for, session
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

def create_app():
    app = Flask(__name__)
    app.secret_key = 'supersecretkey'
    app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:L$6V#%$&&G@localhost:5432/student_helper'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    db.init_app(app)
    from models import User, Subject, Task

    @app.route("/", methods=['GET', 'POST'])
    @app.route("/registration", methods=['GET', 'POST'])
    def registr():
        if request.method == 'POST':
            name = request.form.get('name')
            email = request.form.get('email')
            password = request.form.get('password')

            if not name or not email or not password:
                return "❌ Все поля обязательны!", 400

            # Важно: используем db.session через app.app_context()
            with app.app_context():
                existing_user = User.query.filter_by(email=email).first()
                if existing_user:
                    return "❌ Пользователь с таким email уже существует!", 409

                hashed_pw = generate_password_hash(password, method='pbkdf2:sha256', salt_length=8)
                new_user = User(name=name, email=email, password_hash=hashed_pw)
                db.session.add(new_user)
                db.session.commit()

            return redirect(url_for('main'))

        return render_template('registr.html')

    @app.route("/login", methods=[
        'POST'])  # Только POST, т.к. данные отправляются из формы
    def login():
        email = request.form.get('email')
        password = request.form.get('password')

        if not email or not password:
            return "❌ Email и пароль обязательны!", 400

        user = User.query.filter_by(email=email).first()
        if user and check_password_hash(user.password_hash, password):
            # Успешный вход - сохраняем ID пользователя в сессии
            session['user_id'] = user.id
            return redirect(url_for('main'))  # Перенаправляем на главную
        else:
            return "❌ Неверный email или пароль!", 401

    # --- Защита маршрутов (проверка сессии) ---
    def login_required(f):
        from functools import wraps
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_id' not in session:
                return redirect(
                    url_for('registr'))  # Если не вошёл - на регистрацию
            return f(*args, **kwargs)

        return decorated_function

    # --- Главная страница (теперь защищена) ---
    @app.route("/")
    @app.route("/main")
    @login_required
    def main():
        return render_template('main.html')

    # --- Остальные страницы тоже защищаем ---
    @app.route("/mytasks")
    @login_required
    def mytasks():
        # Пока что просто возвращаем шаблон, позже будем получать задачи из БД
        return render_template('mytasks.html')

    @app.route("/finished")
    @login_required
    def finished():
        return render_template('finished.html')

    @app.route("/statistics")
    @login_required
    def statistics():
        return render_template('statistics.html')

    # --- Маршрут для выхода ---
    @app.route('/logout')
    def logout():
        session.pop('user_id', None)  # Удаляем user_id из сессии
        return redirect(url_for('registr'))

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True)