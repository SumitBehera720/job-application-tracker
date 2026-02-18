const API = "https://job-application-tracker-5kjd.onrender.com";
let allJobs = [];
let chartInstance = null;

// ===== Check Login =====
window.onload = async () => {
    const res = await fetch(`${API}/me`, { credentials: 'include' });
    const data = await res.json();
    if (!data.logged_in) {
        window.location.href = "login.html";
        return;
    }
    document.getElementById("usernameDisplay").textContent = data.username;

    // Load saved theme
    const savedTheme = localStorage.getItem("theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    updateThemeIcon(savedTheme);

    loadJobs();
};

// ===== Theme Toggle =====
function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    updateThemeIcon(next);
}

function updateThemeIcon(theme) {
    const icon = document.getElementById("themeIcon");
    const btn = document.getElementById("themeBtn");
    if (theme === "dark") {
        icon.className = "fas fa-sun";
        btn.title = "Switch to Light Mode";
    } else {
        icon.className = "fas fa-moon";
        btn.title = "Switch to Dark Mode";
    }
}

// ===== Logout =====
async function logout() {
    await fetch(`${API}/logout`, { method: 'POST', credentials: 'include' });
    window.location.href = "login.html";
}

// ===== Toast =====
function showToast(message, type = "success") {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => { toast.className = `toast ${type}`; }, 3000);
}

// ===== Load Jobs =====
async function loadJobs() {
    try {
        const res = await fetch(`${API}/jobs`, { credentials: 'include' });
        if (res.status === 401) { window.location.href = "login.html"; return; }
        allJobs = await res.json();
        renderJobs(allJobs);
        updateStats(allJobs);
        updateChart(allJobs);
    } catch (err) {
        showToast("❌ Could not connect to server!", "error");
    }
}

// ===== Render Jobs =====
function renderJobs(jobs) {
    const table = document.getElementById("jobsTable");
    const emptyState = document.getElementById("emptyState");

    if (jobs.length === 0) {
        table.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    table.innerHTML = jobs.map(job => `
        <tr>
            <td><strong style="color: var(--text)">${job.company}</strong></td>
            <td>${job.role}</td>
            <td>${formatDate(job.date_applied)}</td>
            <td><span class="badge ${job.status}">${job.status}</span></td>
            <td style="max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${job.notes || ''}">${job.notes || '—'}</td>
            <td>
                <button class="btn-edit" onclick="openModal(${job.id}, '${job.status}', \`${(job.notes || '').replace(/`/g, "'")}\`)">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-delete" onclick="deleteJob(${job.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ===== Update Stats =====
function updateStats(jobs) {
    document.getElementById("total").textContent = jobs.length;
    document.getElementById("interviews").textContent = jobs.filter(j => j.status === "Interview").length;
    document.getElementById("offers").textContent = jobs.filter(j => j.status === "Offer").length;
    document.getElementById("rejected").textContent = jobs.filter(j => j.status === "Rejected").length;
}

// ===== Chart =====
function updateChart(jobs) {
    const counts = {
        Applied: jobs.filter(j => j.status === "Applied").length,
        Interview: jobs.filter(j => j.status === "Interview").length,
        Offer: jobs.filter(j => j.status === "Offer").length,
        Rejected: jobs.filter(j => j.status === "Rejected").length,
    };

    const colors = ['#7c6bff', '#f5a623', '#2ecc71', '#e74c3c'];
    const labels = Object.keys(counts);
    const values = Object.values(counts);

    const ctx = document.getElementById('statusChart').getContext('2d');

    if (chartInstance) chartInstance.destroy();

    if (jobs.length === 0) {
        // Show placeholder chart
        chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['No Data'],
                datasets: [{ data: [1], backgroundColor: ['#2a2a4a'], borderWidth: 0 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                cutout: '70%'
            }
        });
        document.getElementById('chartLegend').innerHTML = '<p style="color: var(--muted); font-size: 0.85rem; text-align:center;">Add jobs to see stats</p>';
        return;
    }

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` ${ctx.label}: ${ctx.raw} (${Math.round(ctx.raw / jobs.length * 100)}%)`
                    }
                }
            },
            cutout: '68%'
        }
    });

    // Custom legend
    document.getElementById('chartLegend').innerHTML = labels.map((label, i) => `
        <div class="legend-item">
            <div class="legend-dot" style="background: ${colors[i]}"></div>
            <span class="legend-label">${label}</span>
            <span class="legend-count">${values[i]}</span>
        </div>
    `).join('');
}

// ===== Add Job =====
async function addJob() {
    const company = document.getElementById("company").value.trim();
    const role = document.getElementById("role").value.trim();
    const date_applied = document.getElementById("date_applied").value;
    const status = document.getElementById("status").value;
    const notes = document.getElementById("notes").value.trim();

    if (!company || !role || !date_applied) {
        showToast("⚠️ Please fill in Company, Role, and Date!", "error");
        return;
    }

    await fetch(`${API}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ company, role, date_applied, status, notes })
    });

    document.getElementById("company").value = "";
    document.getElementById("role").value = "";
    document.getElementById("date_applied").value = "";
    document.getElementById("notes").value = "";

    showToast("✅ Application added successfully!");
    loadJobs();
}

// ===== Delete Job =====
async function deleteJob(id) {
    if (!window.confirm("Are you sure you want to delete this application?")) return;

    await fetch(`${API}/jobs/${id}`, {
        method: "DELETE",
        credentials: 'include'
    });

    showToast("🗑️ Application deleted!", "info");
    loadJobs();
}

// ===== Modal =====
function openModal(id, status, notes) {
    document.getElementById("editId").value = id;
    document.getElementById("editStatus").value = status;
    document.getElementById("editNotes").value = notes === "undefined" ? "" : notes;
    document.getElementById("modal").classList.add("active");
}

function closeModal() {
    document.getElementById("modal").classList.remove("active");
}

// Close modal on backdrop click
document.getElementById("modal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("modal")) closeModal();
});

// ===== Update Job =====
async function updateJob() {
    const id = document.getElementById("editId").value;
    const status = document.getElementById("editStatus").value;
    const notes = document.getElementById("editNotes").value;

    await fetch(`${API}/jobs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ status, notes })
    });

    showToast("✏️ Application updated!", "success");
    closeModal();
    loadJobs();
}

// ===== Filter & Search =====
function filterJobs() {
    const search = document.getElementById("search").value.toLowerCase();
    const status = document.getElementById("filterStatus").value;

    const filtered = allJobs.filter(job => {
        const matchSearch = job.company.toLowerCase().includes(search) || job.role.toLowerCase().includes(search);
        const matchStatus = status === "All" || job.status === status;
        return matchSearch && matchStatus;
    });

    renderJobs(filtered);
    updateStats(filtered);

}
