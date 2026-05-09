from extensions import db
from flask import Flask, render_template, request, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

def create_app():
    app = Flask(__name__)
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

    @app.route("/main")
    def main():
        return render_template('main.html')

    @app.route("/mytasks")
    def mytasks():
        return render_template('mytasks.html')

    @app.route("/finished")
    def finished():
        return render_template('finished.html')

    @app.route("/statistics")
    def statistics():
        return render_template('statistics.html')

    return app

# Для запуска через python app.py
if __name__ == '__main__':
    app = create_app()
    app.run(debug=True)