const API = "";
let allJobs = [];
let chartInstance = null;

// ===== Check Login =====
window.onload = async () => {
    try {
        const token = localStorage.getItem("username");
        if (!token) {
            window.location.href = "/";
            return;
        }
        const res = await fetch(`${API}/me`, { credentials: 'include' });
        const data = await res.json();
        if (!data.logged_in) {
            localStorage.removeItem("username");
            window.location.href = "/";
            return;
        }
        document.getElementById("usernameDisplay").textContent = data.username;
        const savedTheme = localStorage.getItem("theme") || "dark";
        document.documentElement.setAttribute("data-theme", savedTheme);
        updateThemeIcon(savedTheme);
        loadJobs();
    } catch (err) {
        window.location.href = "/";
    }
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
    localStorage.removeItem("username");
    try {
        await fetch(`${API}/logout`, { method: 'POST', credentials: 'include' });
    } catch (_) {}
    window.location.href = "/";
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
        if (res.status === 401) {
            localStorage.removeItem("username");
            window.location.href = "/";
            return;
        }
        if (!res.ok) {
            showToast("❌ Failed to load jobs!", "error");
            return;
        }
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
            <td><strong style="color: var(--text)">${escapeHtml(job.company)}</strong></td>
            <td>${escapeHtml(job.role)}</td>
            <td>${formatDate(job.date_applied)}</td>
            <td><span class="badge ${job.status}">${job.status}</span></td>
            <td style="max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"
                title="${escapeHtml(job.notes || '')}">${escapeHtml(job.notes) || '—'}</td>
            <td>
                <button class="btn-edit" onclick="openModal(${job.id})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-delete" onclick="deleteJob(${job.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Safely escape HTML to prevent XSS in job fields
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    // dateStr arrives as "YYYY-MM-DD"; append T00:00 to avoid timezone shifts
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Clamp the year part of a date input to max 4 digits
function clampYear(input) {
    if (!input.value) return;
    const parts = input.value.split('-');
    if (parts[0] && parts[0].length > 4) {
        parts[0] = parts[0].slice(0, 4);
        input.value = parts.join('-');
    }
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
    const date_applied = document.getElementById("date_applied").value.trim();
    const status = document.getElementById("status").value;
    const notes = document.getElementById("notes").value.trim();

    // Validate all required fields individually for better user feedback
    if (!company && !role && !date_applied) {
        showToast("⚠️ Please fill in all required fields!", "error");
        return;
    }
    if (!company) {
        showToast("⚠️ Company name is required!", "error");
        return;
    }
    if (!role) {
        showToast("⚠️ Job role is required!", "error");
        return;
    }
    if (!date_applied) {
        showToast("⚠️ Please pick an application date!", "error");
        return;
    }

    // Disable add button to prevent double-submit
    const addBtn = document.querySelector(".form-container button");
    if (addBtn) addBtn.disabled = true;

    try {
        const res = await fetch(`${API}/jobs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: 'include',
            body: JSON.stringify({ company, role, date_applied, status, notes })
        });

        if (res.status === 401) {
            localStorage.removeItem("username");
            window.location.href = "/";
            return;
        }

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            showToast("❌ " + (err.error || "Failed to add job!"), "error");
            return;
        }

        // Clear the form only on success
        document.getElementById("company").value = "";
        document.getElementById("role").value = "";
        document.getElementById("date_applied").value = "";
        document.getElementById("notes").value = "";
        document.getElementById("status").value = "Applied";

        showToast("✅ Application added successfully!");
        loadJobs();

    } catch (err) {
        showToast("❌ Could not connect to server!", "error");
    } finally {
        if (addBtn) addBtn.disabled = false;
    }
}

// ===== Delete Job =====
let pendingDeleteId = null;

function deleteJob(id) {
    pendingDeleteId = id;
    document.getElementById("confirmModal").classList.add("active");
}

function closeConfirmModal() {
    pendingDeleteId = null;
    document.getElementById("confirmModal").classList.remove("active");
}

// Wire up the confirm delete button
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", async () => {
        if (!pendingDeleteId) return;
        const id = pendingDeleteId;
        closeConfirmModal();
        try {
            const res = await fetch(`${API}/jobs/${id}`, {
                method: "DELETE",
                credentials: 'include'
            });
            if (res.status === 401) {
                localStorage.removeItem("username");
                window.location.href = "/";
                return;
            }
            if (!res.ok) {
                showToast("\u274C Failed to delete job!", "error");
                return;
            }
            showToast("\uD83D\uDDD1\uFE0F Application deleted!", "info");
            loadJobs();
        } catch (err) {
            showToast("\u274C Could not connect to server!", "error");
        }
    });
}

// Close confirm modal on backdrop click
const confirmModalEl = document.getElementById("confirmModal");
if (confirmModalEl) {
    confirmModalEl.addEventListener("click", (e) => {
        if (e.target === confirmModalEl) closeConfirmModal();
    });
}

// ===== Modal =====
// openModal now takes just the job ID and reads data from allJobs
// This avoids passing strings with quotes into onclick HTML attributes
function openModal(id) {
    const job = allJobs.find(j => j.id === id);
    if (!job) return;
    document.getElementById("editId").value = id;
    document.getElementById("editStatus").value = job.status;
    document.getElementById("editNotes").value = job.notes || "";
    document.getElementById("modal").classList.add("active");
}

function closeModal() {
    document.getElementById("modal").classList.remove("active");
}

// Close modal on backdrop click (only on dashboard page)
const modalEl = document.getElementById("modal");
if (modalEl) {
    modalEl.addEventListener("click", (e) => {
        if (e.target === modalEl) closeModal();
    });
}

// ===== Update Job =====
async function updateJob() {
    const id = document.getElementById("editId").value;
    const status = document.getElementById("editStatus").value;
    const notes = document.getElementById("editNotes").value;

    try {
        const res = await fetch(`${API}/jobs/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: 'include',
            body: JSON.stringify({ status, notes })
        });

        if (res.status === 401) {
            localStorage.removeItem("username");
            window.location.href = "/";
            return;
        }

        if (!res.ok) {
            showToast("❌ Failed to update job!", "error");
            return;
        }

        showToast("✏️ Application updated!", "success");
        closeModal();
        loadJobs();

    } catch (err) {
        showToast("❌ Could not connect to server!", "error");
    }
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

// ===== Allow ESC key to close modals =====
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
        closeConfirmModal();
    }
});
