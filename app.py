from extensions import db
from flask import Flask, render_template, request, redirect, url_for, session, jsonify
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
        'POST'])
    def login():
        email = request.form.get('email')
        password = request.form.get('password')

        if not email or not password:
            return "❌ Email и пароль обязательны!", 400

        user = User.query.filter_by(email=email).first()
        if user and check_password_hash(user.password_hash, password):
            session['user_id'] = user.id
            return redirect(url_for('main'))
        else:
            return "❌ Неверный email или пароль!", 401

    def login_required(f):
        from functools import wraps
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_id' not in session:
                return redirect(
                    url_for('registr'))
            return f(*args, **kwargs)

        return decorated_function

    @app.route("/")
    @app.route("/main")
    @login_required
    def main():
        return render_template('main.html')

    @app.route("/mytasks")
    @login_required
    def mytasks():
        return render_template('mytasks.html')

    @app.route("/finished")
    @login_required
    def finished():
        return render_template('finished.html')

    @app.route("/statistics")
    @login_required
    def statistics():
        return render_template('statistics.html')

    @app.route('/logout')
    def logout():
        session.pop('user_id', None)
        return redirect(url_for('registr'))

    @app.route('/api/subjects', methods=['GET'])
    @login_required
    def get_subjects():
        user_id = session['user_id']
        subjects = Subject.query.filter_by(user_id=user_id).all()
        return jsonify([{
            'id': s.id,
            'title': s.title
        } for s in subjects])


    @app.route('/api/subjects', methods=['POST'])
    @login_required
    def create_subject():
        user_id = session['user_id']
        data = request.get_json()
        if not data or 'title' not in data:
            return jsonify({'error': 'Title is required'}), 400

        new_subject = Subject(title=data['title'], user_id=user_id)
        db.session.add(new_subject)
        db.session.commit()

        return jsonify({'id': new_subject.id, 'title': new_subject.title}), 201


    @app.route('/api/tasks', methods=['GET'])
    @login_required
    def get_tasks():
        user_id = session['user_id']
        # filters = {}
        # if request.args.get('status') == 'done':
        #     filters['is_done'] = True
        # elif request.args.get('status') == 'todo':
        #     filters['is_done'] = False
        # tasks = Task.query.filter_by(user_id=user_id, **filters).all()

        subjects = Subject.query.filter_by(user_id=user_id).all()
        all_tasks = []
        for subject in subjects:
            for task in subject.tasks:
                all_tasks.append({
                    'id': task.id,
                    'subject_id': task.subject_id,
                    'subject_title': subject.title,
                    'description': task.description,
                    'deadline': task.deadline.isoformat(),
                    'is_done': task.is_done
                })

        return jsonify(all_tasks)

    @app.route('/api/tasks', methods=['POST'])
    @login_required
    def create_task():
        user_id = session['user_id']
        data = request.get_json()
        if not data or not all(k in data for k in ('subject_id', 'description', 'deadline')):
            return jsonify({'error': 'subject_id, description, and deadline are required'}), 400

        subject = Subject.query.filter_by(id=data['subject_id'], user_id=user_id).first()
        if not subject:
            return jsonify({'error': 'Subject not found or access denied'}), 404

        from datetime import datetime
        try:
            deadline_date = datetime.strptime(data['deadline'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid date format, expected YYYY-MM-DD'}), 400


        new_task = Task(
            subject_id=data['subject_id'],
            description=data['description'],
            deadline=deadline_date,
            is_done=False
        )
        db.session.add(new_task)
        db.session.commit()

        return jsonify({
            'id': new_task.id,
            'subject_id': new_task.subject_id,
            'description': new_task.description,
            'deadline': new_task.deadline.isoformat(),
            'is_done': new_task.is_done
        }), 201

    @app.route('/api/tasks/<int:task_id>', methods=['PUT'])
    @login_required
    def update_task(task_id):
        user_id = session['user_id']
        task = Task.query.join(Subject).filter(Task.id == task_id, Subject.user_id == user_id).first()
        if not task:
            return jsonify({'error': 'Task not found or access denied'}), 404

        data = request.get_json()
        if 'is_done' in data:
            task.is_done = data['is_done']

        db.session.commit()

        return jsonify({
            'id': task.id,
            'subject_id': task.subject_id,
            'description': task.description,
            'deadline': task.deadline.isoformat(),
            'is_done': task.is_done
        })

    @app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
    @login_required
    def delete_task(task_id):
        user_id = session['user_id']
        task = Task.query.join(Subject).filter(Task.id == task_id, Subject.user_id == user_id).first()
        if not task:
            return jsonify({'error': 'Task not found or access denied'}), 404

        db.session.delete(task)
        db.session.commit()

        return '', 204


    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True)