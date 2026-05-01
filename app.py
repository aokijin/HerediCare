from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import sqlite3
import os
from datetime import datetime
import hashlib

app = Flask(__name__)
app.secret_key = 'heredicare_secret_key_2026'

DB_PATH = os.path.join(os.path.dirname(__file__), 'heredicare.db')

# ─── DB INIT ────────────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        phone TEXT,
        role TEXT DEFAULT 'System Administrator'
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS patient_info (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        age INTEGER,
        gender TEXT,
        contact_number TEXT,
        email TEXT UNIQUE,
        vaccination_status TEXT,
        surgical_procedures TEXT,
        illnesses TEXT,
        allergies TEXT,
        prescriptions TEXT,
        parents_history TEXT,
        grandparents_history TEXT,
        siblings_history TEXT,
        family_history_diseases TEXT,
        risk_level TEXT DEFAULT 'Low',
        registered_date TEXT,
        last_visit TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS risk_assessments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id TEXT,
        assessment_date TEXT,
        disease TEXT,
        risk_score INTEGER,
        risk_level TEXT,
        contributing_factors TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_name TEXT,
        appointment_type TEXT,
        appointment_time TEXT,
        appointment_date TEXT
    )''')
    # Seed default admin user
    c.execute("SELECT id FROM users WHERE email='admin@batstateu.edu.ph'")
    if not c.fetchone():
        c.execute("INSERT INTO users (full_name, email, password, phone, role) VALUES (?,?,?,?,?)",
                  ('Dr. Administrator', 'admin@batstateu.edu.ph',
                   hashlib.sha256('admin123'.encode()).hexdigest(),
                   '+63 912 345 6789', 'System Administrator'))
   
    conn.commit()
    conn.close()

# ─── RISK ENGINE ─────────────────────────────────────────────────────────────

def check_family_risk(members, index=0, count=0):
    """Recursive helper that counts how many family members have a condition."""
    if index >= len(members):
        return count
    return check_family_risk(members, index + 1, count + (1 if members[index] else 0))

def evaluate_risk(disease, family_flags):
    count = check_family_risk(family_flags)
    total = len(family_flags)
    if total == 0:
        return 'low', 0
    ratio = count / total

    disease_thresholds = {
        'Type 2 Diabetes': (0.25, 0.5),
        'Hypertension': (0.25, 0.5),
        'Heart Disease': (0.25, 0.5),
        'Prostate Cancer': (0.2, 0.4),
        'Breast Cancer': (0.2, 0.4),
        'Colorectal Cancer': (0.25, 0.5),
        "Alzheimer's Disease": (0.2, 0.4),
        'Stroke': (0.25, 0.5),
        'Kidney Disease': (0.25, 0.5),
        'Asthma': (0.25, 0.5),
    }
    low_thresh, high_thresh = disease_thresholds.get(disease, (0.25, 0.5))
    score = int(ratio * 100)
    if ratio >= high_thresh:
        return 'high', min(score + 20, 99)
    elif ratio >= low_thresh:
        return 'moderate', max(score + 10, 30)
    else:
        return 'low', max(score, 10)

def compute_overall_risk(patient_id):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT risk_level FROM risk_assessments WHERE patient_id=?", (patient_id,))
    rows = c.fetchall()
    conn.close()
    if not rows:
        return 'Low'
    counts = {'high': 0, 'moderate': 0, 'low': 0}
    for r in rows:
        counts[r['risk_level'].lower()] = counts.get(r['risk_level'].lower(), 0) + 1
    if counts['high'] > 0:
        return 'High'
    elif counts['moderate'] > 0:
        return 'Moderate'
    return 'Low'

# ─── ROUTES ──────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return redirect(url_for('dashboard'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = request.get_json()
        email = data.get('email', '')
        password = hashlib.sha256(data.get('password', '').encode()).hexdigest()
        conn = get_db()
        user = conn.execute("SELECT * FROM users WHERE email=? AND password=?", (email, password)).fetchone()
        conn.close()
        if user:
            session['user_id'] = user['id']
            session['user_name'] = user['full_name']
            session['user_email'] = user['email']
            session['user_role'] = user['role']
            session['user_phone'] = user['phone']
            return jsonify({'success': True})
        return jsonify({'success': False, 'message': 'Invalid email or password.'})
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('main.html', active='dashboard', user=session)

@app.route('/register')
def register():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('main.html', active='register', user=session)

@app.route('/records')
def records():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('main.html', active='records', user=session)

@app.route('/assessment')
def assessment():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('main.html', active='assessment', user=session)

@app.route('/account')
def account():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('main.html', active='account', user=session)

# ─── API ENDPOINTS ────────────────────────────────────────────────────────────

@app.route('/api/dashboard-stats')
def api_dashboard_stats():
    conn = get_db()
    total = conn.execute("SELECT COUNT(*) FROM patient_info").fetchone()[0]
    active = conn.execute("SELECT COUNT(*) FROM patient_info WHERE last_visit >= date('now','-30 days')").fetchone()[0]
    high_risk = conn.execute("SELECT COUNT(*) FROM patient_info WHERE risk_level='High'").fetchone()[0]
    assessments_today = conn.execute(
        "SELECT COUNT(*) FROM risk_assessments WHERE assessment_date=?", (datetime.now().strftime('%Y-%m-%d'),)
    ).fetchone()[0]
    recent = conn.execute(
        "SELECT patient_id,name,age,risk_level,last_visit FROM patient_info ORDER BY last_visit DESC LIMIT 4"
    ).fetchall()
    appointments = conn.execute(
        "SELECT patient_name,appointment_type,appointment_time FROM appointments WHERE appointment_date=? ORDER BY appointment_time",
        (datetime.now().strftime('%Y-%m-%d'),)
    ).fetchall()
    conn.close()
    return jsonify({
        'total_patients': total,
        'active_records': active or total,
        'high_risk': high_risk,
        'assessments_today': assessments_today,
        'recent_patients': [dict(r) for r in recent],
        'appointments': [dict(a) for a in appointments],
    })

@app.route('/api/patients')
def api_patients():
    q = request.args.get('q', '')
    page = int(request.args.get('page', 1))
    per_page = 5
    conn = get_db()
    if q:
        rows = conn.execute(
            "SELECT * FROM patient_info WHERE name LIKE ? OR patient_id LIKE ? OR email LIKE ? ORDER BY registered_date DESC",
            (f'%{q}%', f'%{q}%', f'%{q}%')
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM patient_info ORDER BY registered_date DESC").fetchall()
    conn.close()
    total = len(rows)
    start = (page - 1) * per_page
    page_rows = rows[start:start + per_page]
    return jsonify({
        'patients': [dict(r) for r in page_rows],
        'total': total,
        'pages': (total + per_page - 1) // per_page,
        'current_page': page,
    })

@app.route('/api/patient/<patient_id>')
def api_patient_detail(patient_id):
    conn = get_db()
    p = conn.execute("SELECT * FROM patient_info WHERE patient_id=?", (patient_id,)).fetchone()
    assessments = conn.execute(
        "SELECT * FROM risk_assessments WHERE patient_id=? ORDER BY assessment_date DESC",
        (patient_id,)
    ).fetchall()
    conn.close()
    if not p:
        return jsonify({'error': 'Patient not found'}), 404
    return jsonify({
        'patient': dict(p),
        'assessments': [dict(a) for a in assessments],
    })

@app.route('/api/register-patient', methods=['POST'])
def api_register_patient():
    data = request.get_json()
    conn = get_db()
    c = conn.cursor()
    # Generate patient ID
    count = c.execute("SELECT COUNT(*) FROM patient_info").fetchone()[0]
    patient_id = f"P-{datetime.now().year}-{str(count + 1).zfill(3)}"
    today = datetime.now().strftime('%Y-%m-%d')
    try:
        c.execute('''INSERT INTO patient_info
            (patient_id,name,age,gender,contact_number,email,
             vaccination_status,surgical_procedures,illnesses,prescriptions,
             parents_history,grandparents_history,siblings_history,family_history_diseases,
             risk_level,registered_date,last_visit)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''', (
            patient_id,
            data.get('full_name'), data.get('age'), data.get('gender'),
            data.get('contact_number'), data.get('email'),
            data.get('vaccination_status',''), data.get('surgical_procedures',''),
            data.get('illnesses',''), data.get('prescriptions',''),
            data.get('parents_history',''), data.get('grandparents_history',''),
            data.get('siblings_history',''),
            f"{data.get('parents_history','')} {data.get('grandparents_history','')}".strip(),
            'Low', today, today
        ))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'patient_id': patient_id})
    except sqlite3.IntegrityError as e:
        conn.close()
        return jsonify({'success': False, 'message': 'Email already registered.'}), 400

@app.route('/api/perform-assessment', methods=['POST'])
def api_perform_assessment():
    data = request.get_json()
    patient_id = data.get('patient_id')
    disease = data.get('disease')
    family_flags = data.get('family_flags', [])
    contributing = data.get('contributing_factors', '')

    risk_level, score = evaluate_risk(disease, family_flags)
    today = datetime.now().strftime('%Y-%m-%d')

    conn = get_db()
    c = conn.cursor()
    # Save assessment
    c.execute('''INSERT INTO risk_assessments
        (patient_id, assessment_date, disease, risk_score, risk_level, contributing_factors)
        VALUES (?,?,?,?,?,?)''', (patient_id, today, disease, score, risk_level, contributing))
    # Update overall risk
    overall = compute_overall_risk(patient_id)
    c.execute("UPDATE patient_info SET risk_level=?, last_visit=? WHERE patient_id=?",
              (overall, today, patient_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'risk_level': risk_level, 'score': score, 'overall': overall})

@app.route('/api/assessment-results/<patient_id>')
def api_assessment_results(patient_id):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM risk_assessments WHERE patient_id=? ORDER BY assessment_date DESC",
        (patient_id,)
    ).fetchall()
    patient = conn.execute("SELECT * FROM patient_info WHERE patient_id=?", (patient_id,)).fetchone()
    conn.close()
    if not patient:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({
        'patient': dict(patient),
        'assessments': [dict(r) for r in rows],
    })

@app.route('/api/update-account', methods=['POST'])
def api_update_account():
    if 'user_id' not in session:
        return jsonify({'success': False}), 401
    data = request.get_json()
    conn = get_db()
    conn.execute("UPDATE users SET full_name=?, email=?, phone=? WHERE id=?",
                 (data['full_name'], data['email'], data['phone'], session['user_id']))
    conn.commit()
    session['user_name'] = data['full_name']
    session['user_email'] = data['email']
    session['user_phone'] = data['phone']
    conn.close()
    return jsonify({'success': True})

@app.route('/api/change-password', methods=['POST'])
def api_change_password():
    if 'user_id' not in session:
        return jsonify({'success': False}), 401
    data = request.get_json()
    conn = get_db()
    current_hash = hashlib.sha256(data['current_password'].encode()).hexdigest()
    user = conn.execute("SELECT * FROM users WHERE id=? AND password=?",
                        (session['user_id'], current_hash)).fetchone()
    if not user:
        conn.close()
        return jsonify({'success': False, 'message': 'Current password is incorrect.'})
    new_hash = hashlib.sha256(data['new_password'].encode()).hexdigest()
    conn.execute("UPDATE users SET password=? WHERE id=?", (new_hash, session['user_id']))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/export-patients')
def api_export_patients():
    conn = get_db()
    rows = conn.execute("SELECT patient_id,name,age,gender,contact_number,email,registered_date,risk_level FROM patient_info").fetchall()
    conn.close()
    import io
    output = io.StringIO()
    output.write('Patient ID,Name,Age,Gender,Contact,Email,Registered,Risk Level\n')
    for r in rows:
        output.write(','.join([str(x) if x else '' for x in r]) + '\n')
    from flask import Response
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': 'attachment;filename=patients.csv'}
    )

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
