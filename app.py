from flask import Flask, render_template

app = Flask(__name__)


@app.route("/")
@app.route("/registration")
def registr():
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


if __name__ == '__main__':
    app.run(debug=True)