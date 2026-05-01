/* ── HELPERS ── */
const $ = id => document.getElementById(id);
const riskClass = r => (r || '').toLowerCase();
const riskPill = r => `<span class="risk-pill ${riskClass(r)}">${r}</span>`;

function showToast(msg, color='') {
  const t = $('accToast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast';
  if (color) t.style.background = color;
  setTimeout(() => t.classList.add('hidden'), 3000);
}

/* ── DASHBOARD ── */
async function loadDashboard() {
  const res = await fetch('/api/dashboard-stats');
  const d = await res.json();

  $('stat-total-patients').textContent = d.total_patients;
  $('stat-active-records').textContent = d.active_records;
  $('stat-high-risk').textContent = d.high_risk;
  $('stat-assessments').textContent = d.assessments_today;

  const rp = $('recentPatients');
  rp.innerHTML = d.recent_patients.map(p => `
    <div class="patient-item">
      <div class="patient-avatar">
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      </div>
      <div class="patient-item-info">
        <strong>${p.name}</strong>
        <span>${p.patient_id} &bull; Age ${p.age}</span>
      </div>
      <div class="patient-item-meta">
        <small>Last Visit<br>${p.last_visit}</small>
        ${riskPill(p.risk_level)}
      </div>
    </div>`).join('');

  const ap = $('appointments');
  ap.innerHTML = d.appointments.map(a => `
    <div class="appt-item">
      <div class="appt-icon">
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </div>
      <div class="appt-info">
        <strong>${a.patient_name}</strong>
        <small>${a.appointment_type}</small>
      </div>
      <span class="appt-time">${a.appointment_time}</span>
    </div>`).join('');
}

/* ── PATIENT RECORDS ── */
let currentPage = 1;
let searchTerm = '';
let searchTimer;

function searchPatients(val) {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchTerm = val;
    currentPage = 1;
    loadPatients();
  }, 300);
}

async function loadPatients(page = currentPage) {
  currentPage = page;
  const res = await fetch(`/api/patients?q=${encodeURIComponent(searchTerm)}&page=${page}`);
  const d = await res.json();

  const tbody = $('patientsBody');
  if (!tbody) return;

  tbody.innerHTML = d.patients.map(p => `
    <tr>
      <td><span class="patient-id-link" onclick="viewPatient('${p.patient_id}')">${p.patient_id}</span></td>
      <td>${p.name}</td>
      <td>${p.age}</td>
      <td>${p.gender}</td>
      <td>${p.contact_number}</td>
      <td>${p.email}</td>
      <td>${p.registered_date}</td>
      <td>${riskPill(p.risk_level)}</td>
      <td><button class="btn-view" onclick="viewPatient('${p.patient_id}')">View</button></td>
    </tr>`).join('');

  $('showingLabel').textContent = `Showing ${d.patients.length} of ${d.total} patients`;

  const pag = $('pagination');
  pag.innerHTML = '';

  const prev = document.createElement('button');
  prev.className = 'page-btn'; prev.textContent = '←';
  prev.disabled = page <= 1;
  prev.onclick = () => loadPatients(page - 1);
  pag.appendChild(prev);

  for (let i = 1; i <= d.pages; i++) {
    const btn = document.createElement('button');
    btn.className = 'page-btn' + (i === page ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => loadPatients(i);
    pag.appendChild(btn);
  }

  const next = document.createElement('button');
  next.className = 'page-btn'; next.textContent = '→';
  next.disabled = page >= d.pages;
  next.onclick = () => loadPatients(page + 1);
  pag.appendChild(next);
}

async function viewPatient(id) {
  const res = await fetch(`/api/patient/${id}`);
  const d = await res.json();
  const p = d.patient;

  $('modalPatientName').textContent = p.name;
  $('modalBody').innerHTML = `
    <div class="detail-grid" style="margin-bottom:18px;">
      <div class="detail-item"><label>Patient ID</label><p>${p.patient_id}</p></div>
      <div class="detail-item"><label>Risk Level</label><p>${riskPill(p.risk_level)}</p></div>
      <div class="detail-item"><label>Age</label><p>${p.age}</p></div>
      <div class="detail-item"><label>Gender</label><p>${p.gender}</p></div>
      <div class="detail-item"><label>Contact</label><p>${p.contact_number}</p></div>
      <div class="detail-item"><label>Email</label><p>${p.email}</p></div>
      <div class="detail-item"><label>Registered</label><p>${p.registered_date}</p></div>
      <div class="detail-item"><label>Last Visit</label><p>${p.last_visit}</p></div>
    </div>
    <div style="margin-bottom:14px;">
      <label style="font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;">Vaccinations</label>
      <p style="font-size:.9rem;margin-top:3px;">${p.vaccination_status || '—'}</p>
    </div>
    <div style="margin-bottom:14px;">
      <label style="font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;">Surgical Procedures</label>
      <p style="font-size:.9rem;margin-top:3px;">${p.surgical_procedures || '—'}</p>
    </div>
    <div style="margin-bottom:14px;">
      <label style="font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;">Current Illnesses</label>
      <p style="font-size:.9rem;margin-top:3px;">${p.illnesses || '—'}</p>
    </div>
    <div style="margin-bottom:14px;">
      <label style="font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;">Family History</label>
      <p style="font-size:.9rem;margin-top:3px;">${p.family_history_diseases || '—'}</p>
    </div>
    ${d.assessments.length ? `
    <div>
      <label style="font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:8px;">Risk Assessments</label>
      ${d.assessments.map(a => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#f8fafc;border-radius:8px;margin-bottom:6px;">
          <span style="font-size:.85rem;font-weight:500;">${a.disease}</span>
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:.8rem;color:var(--muted);">Score: ${a.risk_score}</span>
            ${riskPill(a.risk_level)}
          </div>
        </div>`).join('')}
    </div>` : ''}
  `;
  $('patientModal').classList.remove('hidden');
}

function closeModal() { $('patientModal').classList.add('hidden'); }

/* ── REGISTER PATIENT ── */
let currentStep = 1;

function goStep(n) {
  ['regStep1','regStep2','regStep3'].forEach((id, i) => {
    $(id).classList.toggle('hidden', i + 1 !== n);
  });

  for (let i = 1; i <= 3; i++) {
    const ind = $(`step${i}-ind`);
    if (!ind) continue;
    ind.classList.remove('active','done');
    if (i < n) ind.classList.add('done');
    else if (i === n) ind.classList.add('active');
  }
  for (let i = 1; i <= 2; i++) {
    const line = $(`line${i}`);
    if (line) line.classList.toggle('done', i < n);
  }

  currentStep = n;
}

async function submitPatient() {
  const data = {
    full_name: $('reg-name').value.trim(),
    age: $('reg-age').value,
    gender: $('reg-gender').value,
    contact_number: $('reg-contact').value.trim(),
    email: $('reg-email').value.trim(),
    vaccination_status: $('reg-vax').value.trim(),
    surgical_procedures: $('reg-surgery').value.trim(),
    illnesses: $('reg-illness').value.trim(),
    allergies: $('reg-allergies').value.trim(),
    prescriptions: $('reg-prescriptions').value.trim(),
    parents_history: $('reg-parents').value.trim(),
    grandparents_history: $('reg-grandparents').value.trim(),
    siblings_history: $('reg-siblings').value.trim(),
  };

  if (!data.full_name || !data.age || !data.gender || !data.email) {
    alert('Please fill in all required fields (Name, Age, Gender, Email).');
    return;
  }

  const res = await fetch('/api/register-patient', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(data)
  });
  const result = await res.json();
  if (result.success) {
    $('regStep3').classList.add('hidden');
    $('regSuccess').classList.remove('hidden');
    // Reset form
    ['reg-name','reg-age','reg-contact','reg-email','reg-vax',
     'reg-surgery','reg-illness','reg-allergies','reg-prescriptions',
     'reg-parents','reg-grandparents','reg-siblings'].forEach(id => {
      const el = $(id); if (el) el.value = '';
    });
    $('reg-gender').selectedIndex = 0;
    setTimeout(() => {
      $('regSuccess').classList.add('hidden');
      goStep(1);
    }, 4000);
  } else {
    alert(result.message || 'Registration failed.');
  }
}

/* ── RISK ASSESSMENT ── */
const DISEASES = [
  'Type 2 Diabetes', 'Hypertension', 'Heart Disease',
  'Prostate Cancer', 'Breast Cancer', 'Colorectal Cancer',
  "Alzheimer's Disease", 'Stroke', 'Kidney Disease', 'Asthma'
];

const DISEASE_QUESTIONS = {
  'Type 2 Diabetes': [
    {q: 'Does your father have Type 2 Diabetes?', key: 'father'},
    {q: 'Does your mother have Type 2 Diabetes?', key: 'mother'},
    {q: 'Does your grandfather have Type 2 Diabetes?', key: 'grandfather'},
    {q: 'Does your grandmother have Type 2 Diabetes?', key: 'grandmother'},
    {q: 'Do you have elevated BMI (overweight/obese)?', key: 'bmi'},
  ],
  'Hypertension': [
    {q: 'Does your father have hypertension?', key: 'father'},
    {q: 'Does your mother have hypertension?', key: 'mother'},
    {q: 'Does your grandfather have hypertension?', key: 'grandfather'},
    {q: 'Are you currently borderline hypertensive?', key: 'borderline'},
  ],
  'Heart Disease': [
    {q: 'Did your father have a heart attack?', key: 'father_heart'},
    {q: 'Does your mother have heart disease?', key: 'mother'},
    {q: 'Do you have high cholesterol?', key: 'cholesterol'},
    {q: 'Any sibling with heart disease?', key: 'sibling'},
  ],
  'Prostate Cancer': [
    {q: 'Does your father have prostate cancer?', key: 'father'},
    {q: 'Does your brother have prostate cancer?', key: 'brother'},
    {q: 'Was any paternal uncle affected?', key: 'uncle'},
    {q: 'Are you 65 years or older?', key: 'age'},
  ],
  'Breast Cancer': [
    {q: 'Does your mother have breast cancer?', key: 'mother'},
    {q: 'Does any sister have breast cancer?', key: 'sister'},
    {q: 'Does your father/brother have breast cancer?', key: 'father'},
    {q: 'Any other relative with cancer?', key: 'other'},
  ],
  'Colorectal Cancer': [
    {q: 'Does a parent have colorectal cancer?', key: 'parent'},
    {q: 'Any sibling with colorectal cancer?', key: 'sibling'},
    {q: 'Any grandparent with colorectal cancer?', key: 'grandparent'},
    {q: 'Do you have Type 2 Diabetes?', key: 'diabetes'},
  ],
  "Alzheimer's Disease": [
    {q: 'Does a parent have Alzheimer\'s disease?', key: 'parent'},
    {q: 'Does any sibling have Alzheimer\'s disease?', key: 'sibling'},
    {q: 'Any grandparent with dementia/Alzheimer\'s?', key: 'grandparent'},
  ],
  'Stroke': [
    {q: 'Did your father have a stroke?', key: 'father'},
    {q: 'Did your mother have a stroke?', key: 'mother'},
    {q: 'Do you have hypertension risk factors?', key: 'hypertension'},
    {q: 'Any sibling with stroke history?', key: 'sibling'},
  ],
  'Kidney Disease': [
    {q: 'Does a parent have kidney disease?', key: 'parent'},
    {q: 'Any family history of diabetes?', key: 'diabetes'},
    {q: 'Any grandparent with kidney disease?', key: 'grandparent'},
  ],
  'Asthma': [
    {q: 'Does your father have asthma?', key: 'father'},
    {q: 'Does your mother have asthma?', key: 'mother'},
    {q: 'Does any sibling have asthma?', key: 'sibling'},
    {q: 'Any grandparent with asthma?', key: 'grandparent'},
  ],
};

const HEALTH_ADVICE = {
  high: ['Schedule comprehensive health screening', 'Consult with specialist physicians', 'Begin preventive medication if prescribed'],
  moderate: ['Annual health check-ups', 'Adopt heart-healthy diet', 'Regular exercise (30 min daily)'],
  low: ['Maintain healthy lifestyle', 'Bi-annual check-ups', 'Stay informed about symptoms'],
};

let selectedPatientId = null;
let assessmentResults = [];

async function loadAssessmentPatients() {
  const sel = $('assessPatient');
  if (!sel) return;
  const res = await fetch('/api/patients?page=1');
  const d = await res.json();
  // load all pages
  let all = d.patients;
  for (let p = 2; p <= d.pages; p++) {
    const r2 = await fetch(`/api/patients?page=${p}`);
    const d2 = await r2.json();
    all = all.concat(d2.patients);
  }
  sel.innerHTML = '<option value="">-- Select Patient --</option>' +
    all.map(p => `<option value="${p.patient_id}">${p.patient_id} – ${p.name}</option>`).join('');
}

async function loadPatientAssessment() {
  const sel = $('assessPatient');
  selectedPatientId = sel.value;
  $('runAssessBtn').disabled = !selectedPatientId;
  if (!selectedPatientId) return;

  const res = await fetch(`/api/assessment-results/${selectedPatientId}`);
  const d = await res.json();
  assessmentResults = d.assessments || [];

  const card = $('patientAssessCard');
  card.style.display = 'block';
  $('assessPatientName').textContent = d.patient.name;
  $('assessPatientMeta').textContent = `Age: ${d.patient.age} | Last Assessment: ${d.patient.last_visit}`;

  const badge = $('assessOverallRisk');
  badge.textContent = d.patient.risk_level;
  badge.className = 'risk-badge-lg ' + d.patient.risk_level;

  renderRiskCards(assessmentResults);
}

function renderRiskCards(results) {
  const grid = $('riskCards');
  if (!results.length) {
    grid.innerHTML = `<div class="card" style="grid-column:1/-1;text-align:center;color:var(--muted);padding:30px;">
      No assessments yet. Click "Perform Assessment" to begin.
    </div>`;
    $('recommendationsCard').style.display = 'none';
    return;
  }

  grid.innerHTML = results.map(a => {
    const rl = (a.risk_level || 'low').toLowerCase();
    const icon = rl === 'high'
      ? `<svg class="risk-card-icon" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`
      : rl === 'moderate'
      ? `<svg class="risk-card-icon mod" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`
      : `<svg class="risk-card-icon low" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;

    return `<div class="risk-card ${rl}">
      <div class="risk-card-header">
        <div class="risk-card-title">${icon} ${a.disease}</div>
        <div>
          <span class="risk-score ${rl}">${a.risk_score}</span>
          <div style="font-size:.62rem;color:var(--muted);text-align:right;">Risk Score</div>
        </div>
      </div>
      ${riskPill(a.risk_level)}
      <div class="risk-bar-track"><div class="risk-bar-fill ${rl}" style="width:${a.risk_score}%"></div></div>
      <div class="risk-factors"><strong>Contributing Factors:</strong> ${a.contributing_factors || 'Based on family history'}</div>
    </div>`;
  }).join('');

  // Recommendations
  const hasHigh = results.some(r => r.risk_level.toLowerCase() === 'high');
  const hasMod = results.some(r => r.risk_level.toLowerCase() === 'moderate');
  const level = hasHigh ? 'high' : hasMod ? 'moderate' : 'low';

  $('recommendationsCard').style.display = 'block';
  $('recommendationsContent').innerHTML = `
    <div class="rec-card immediate">
      <h4>${hasHigh ? 'Immediate Actions' : 'Priority Actions'}</h4>
      <ul>${HEALTH_ADVICE.high.map(a => `<li>${a}</li>`).join('')}</ul>
    </div>
    <div class="rec-card lifestyle">
      <h4>Lifestyle Modifications</h4>
      <ul>
        <li>Adopt heart-healthy diet</li>
        <li>Regular exercise (30 min daily)</li>
        <li>Stress management techniques</li>
      </ul>
    </div>
    <div class="rec-card monitoring">
      <h4>Monitoring Plan</h4>
      <ul>
        <li>Quarterly health check-ups</li>
        <li>Monthly blood pressure monitoring</li>
        <li>Annual comprehensive lab work</li>
      </ul>
    </div>`;
}

function runAssessment() {
  if (!selectedPatientId) return;

  const body = $('assessModalBody');
  body.innerHTML = `
    <div class="field">
      <label>Select Disease to Assess</label>
      <select id="diseaseSelect" onchange="loadDiseaseQuestions()">
        <option value="">-- Choose Disease --</option>
        ${DISEASES.map(d => `<option value="${d}">${d}</option>`).join('')}
      </select>
    </div>
    <div id="questionArea"></div>
    <div style="text-align:right;margin-top:16px;">
      <button class="btn-primary" onclick="submitAssessment()">Run Assessment</button>
    </div>
  `;
  $('assessModalTitle').textContent = 'New Risk Assessment';
  $('assessModal').classList.remove('hidden');
}

function loadDiseaseQuestions() {
  const disease = $('diseaseSelect').value;
  const area = $('questionArea');
  if (!disease) { area.innerHTML = ''; return; }

  const qs = DISEASE_QUESTIONS[disease] || [];
  area.innerHTML = `<div style="margin-top:16px;">` +
    qs.map((q, i) => `
      <div class="assess-question">
        <p>${q.q}</p>
        <div class="assess-radio">
          <label><input type="radio" name="q${i}" value="1"> Yes</label>
          <label><input type="radio" name="q${i}" value="0" checked> No</label>
        </div>
      </div>`).join('') +
    `</div>`;
}

async function submitAssessment() {
  const disease = $('diseaseSelect').value;
  if (!disease) { alert('Please select a disease.'); return; }

  const qs = DISEASE_QUESTIONS[disease] || [];
  const flags = [];
  const factors = [];

  qs.forEach((q, i) => {
    const sel = document.querySelector(`input[name="q${i}"]:checked`);
    const val = sel ? parseInt(sel.value) : 0;
    flags.push(val === 1);
    if (val === 1) factors.push(q.q.replace(/\?$/, ''));
  });

  const res = await fetch('/api/perform-assessment', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      patient_id: selectedPatientId,
      disease,
      family_flags: flags,
      contributing_factors: factors.join(', ') || 'No immediate family history'
    })
  });

  const result = await res.json();
  closeAssessModal();
  await loadPatientAssessment();

  // Show result toast
  const colors = {high:'#dc2626', moderate:'#d97706', low:'#16a34a'};
  showToast(`${disease}: ${result.risk_level.toUpperCase()} Risk (Score: ${result.score})`,
    colors[result.risk_level] || '#1a202c');
}

function closeAssessModal() { $('assessModal').classList.add('hidden'); }

function downloadSummary() {
  if (!selectedPatientId || !assessmentResults.length) return;
  let csv = 'Disease,Risk Level,Risk Score,Contributing Factors,Date\n';
  assessmentResults.forEach(a => {
    csv += `"${a.disease}","${a.risk_level}",${a.risk_score},"${a.contributing_factors}","${a.assessment_date}"\n`;
  });
  const blob = new Blob([csv], {type: 'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${selectedPatientId}_risk_summary.csv`;
  a.click();
}

/* ── ACCOUNT ── */
async function saveProfile() {
  const data = {
    full_name: $('acc-name').value,
    email: $('acc-email').value,
    phone: $('acc-phone').value,
  };
  const res = await fetch('/api/update-account', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(data)
  });
  const r = await res.json();
  showToast(r.success ? '✓ Profile updated successfully' : 'Update failed.',
    r.success ? '#16a34a' : '#dc2626');
}

async function changePassword() {
  const cur = $('acc-cur-pw').value;
  const nw = $('acc-new-pw').value;
  const cn = $('acc-confirm-pw').value;
  if (nw !== cn) { showToast('Passwords do not match.', '#dc2626'); return; }
  if (nw.length < 6) { showToast('Password must be at least 6 characters.', '#dc2626'); return; }
  const res = await fetch('/api/change-password', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({current_password: cur, new_password: nw})
  });
  const r = await res.json();
  showToast(r.success ? '✓ Password updated.' : r.message || 'Failed.',
    r.success ? '#16a34a' : '#dc2626');
  if (r.success) { $('acc-cur-pw').value=''; $('acc-new-pw').value=''; $('acc-confirm-pw').value=''; }
}

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', () => {
  const active = document.querySelector('.page.active');
  if (!active) return;
  const id = active.id;

  if (id === 'page-dashboard') loadDashboard();
  if (id === 'page-records') loadPatients();
  if (id === 'page-assessment') loadAssessmentPatients();

  // Close modals on overlay click
  $('patientModal')?.addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });
  $('assessModal')?.addEventListener('click', function(e) {
    if (e.target === this) closeAssessModal();
  });
});
