import {
    auth,
    db
} from "./firebase-config.js";

import {
    onAuthStateChanged,
    signOut
} from
    "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";

import {
    collection,
    doc,
    getDoc,
    onSnapshot,
    orderBy,
    query,
    where
} from
    "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const userNameElement =
    document.getElementById("userName");

const userEmailElement =
    document.getElementById("userEmail");

const logoutButton =
    document.getElementById("logoutButton");

const projectNameElement =
    document.getElementById("projectName");

const clientNameElement =
    document.getElementById("clientName");

const projectStatusElement =
    document.getElementById("projectStatus");

const totalHoursElement =
    document.getElementById("totalHours");

const usedHoursElement =
    document.getElementById("usedHours");

const remainingHoursElement =
    document.getElementById("remainingHours");

const logCountElement =
    document.getElementById("logCount");

const progressPercentageElement =
    document.getElementById("progressPercentage");

const progressBarElement =
    document.getElementById("progressBar");

const loadingState =
    document.getElementById("loadingState");

const emptyState =
    document.getElementById("emptyState");

const logsContainer =
    document.getElementById("logsContainer");

let currentProfile = null;
let currentProject = null;
let unsubscribeLogs = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace("./index.html");
        return;
    }

    try {
        await initializeCustomerDashboard(user);
    } catch (error) {
        console.error(
            "Dashboard yüklenemedi:",
            error
        );

        loadingState.textContent =
            "Proje bilgileri yüklenemedi.";
    }
});

logoutButton.addEventListener("click", async () => {
    try {
        if (unsubscribeLogs) {
            unsubscribeLogs();
        }

        await signOut(auth);

        window.location.replace("./index.html");
    } catch (error) {
        console.error("Çıkış hatası:", error);
    }
});

async function initializeCustomerDashboard(user) {
    const profileReference = doc(
        db,
        "users",
        user.uid
    );

    const profileSnapshot =
        await getDoc(profileReference);

    if (!profileSnapshot.exists()) {
        throw new Error(
            "Kullanıcı profili bulunamadı."
        );
    }

    currentProfile = {
        id: profileSnapshot.id,
        ...profileSnapshot.data()
    };

    if (
        currentProfile.active !== true ||
        currentProfile.role !== "customer"
    ) {
        await signOut(auth);
        window.location.replace("./index.html");
        return;
    }

    if (!currentProfile.projectId) {
        throw new Error(
            "Kullanıcıya proje tanımlanmamış."
        );
    }

    const projectReference = doc(
        db,
        "projects",
        currentProfile.projectId
    );

    const projectSnapshot =
        await getDoc(projectReference);

    if (!projectSnapshot.exists()) {
        throw new Error(
            "Proje bulunamadı."
        );
    }

    currentProject = {
        id: projectSnapshot.id,
        ...projectSnapshot.data()
    };

    renderProfile(user);
    renderProject();
    listenToWorkLogs();

    document.body.classList.remove(
        "auth-loading"
    );
}

function renderProfile(user) {
    userNameElement.textContent =
        currentProfile.displayName ||
        "Müşteri Kullanıcısı";

    userEmailElement.textContent =
        currentProfile.email ||
        user.email ||
        "";
}

function renderProject() {
    projectNameElement.textContent =
        currentProject.name ||
        "İsimsiz Proje";

    clientNameElement.textContent =
        currentProject.clientName ||
        "";

    const isActive =
        currentProject.status === "active";

    projectStatusElement.textContent =
        isActive
            ? "Aktif Proje"
            : "Pasif Proje";

    projectStatusElement.className =
        `status-pill ${
            isActive ? "active" : "passive"
        }`;

    totalHoursElement.textContent =
        formatNumber(
            currentProject.totalHours || 0
        );
}

function listenToWorkLogs() {
    const workLogsQuery = query(
        collection(db, "workLogs"),

        where(
            "projectId",
            "==",
            currentProject.id
        ),

        orderBy(
            "workDate",
            "desc"
        )
    );

    unsubscribeLogs = onSnapshot(
        workLogsQuery,

        (snapshot) => {
            const logs = snapshot.docs.map(
                (documentSnapshot) => ({
                    id: documentSnapshot.id,
                    ...documentSnapshot.data()
                })
            );

            loadingState.classList.add("hidden");

            renderSummary(logs);
            renderLogs(logs);
        },

        (error) => {
            console.error(
                "Log sorgulama hatası:",
                error
            );

            loadingState.classList.remove("hidden");

            loadingState.textContent =
                "Çalışma kayıtları yüklenemedi.";
        }
    );
}

function renderSummary(logs) {
    const totalHours = Number(
        currentProject.totalHours || 0
    );

    const usedHours = logs.reduce(
        (total, log) =>
            total + Number(log.hours || 0),
        0
    );

    const remainingHours =
        Math.max(totalHours - usedHours, 0);

    const percentage =
        totalHours > 0
            ? Math.min(
                (usedHours / totalHours) * 100,
                100
            )
            : 0;

    totalHoursElement.textContent =
        formatNumber(totalHours);

    usedHoursElement.textContent =
        formatNumber(usedHours);

    remainingHoursElement.textContent =
        formatNumber(remainingHours);

    logCountElement.textContent =
        String(logs.length);

    progressPercentageElement.textContent =
        `%${percentage.toFixed(0)}`;

    progressBarElement.style.width =
        `${percentage}%`;
}

function renderLogs(logs) {
    logsContainer.innerHTML = "";

    if (logs.length === 0) {
        emptyState.classList.remove("hidden");
        return;
    }

    emptyState.classList.add("hidden");

    logs.forEach((log) => {
        const logElement =
            document.createElement("article");

        logElement.className = "log-item";

        const safeTitle =
            escapeHtml(log.title || "");

        const safeDescription =
            escapeHtml(log.description || "");

        const safeNextStep =
            escapeHtml(log.nextStep || "");

        const itemText =
            log.itemNumber
                ? `Madde ${escapeHtml(
                    String(log.itemNumber)
                )}`
                : "Genel Çalışma";

        logElement.innerHTML = `
            <div class="log-date-column">
                <strong>
                    ${formatDate(log.workDate)}
                </strong>

                <span>${itemText}</span>
            </div>

            <div class="log-content-column">
                <h3>${safeTitle}</h3>

                <p>${safeDescription}</p>

                ${
                    safeNextStep
                        ? `
                            <div class="next-step">
                                <strong>Sonraki adım:</strong>
                                <span>${safeNextStep}</span>
                            </div>
                        `
                        : ""
                }
            </div>

            <div class="log-badges">
                <span class="hours-badge">
                    ${formatNumber(log.hours)} saat
                </span>

                <span class="status-badge ${getStatusClass(log.status)}">
                    ${getStatusText(log.status)}
                </span>
            </div>
        `;

        logsContainer.appendChild(logElement);
    });
}

function formatNumber(value) {
    return new Intl.NumberFormat(
        "tr-TR",
        {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }
    ).format(Number(value || 0));
}

function formatDate(dateValue) {
    if (!dateValue) {
        return "—";
    }

    const date = new Date(
        `${dateValue}T12:00:00`
    );

    if (Number.isNaN(date.getTime())) {
        return dateValue;
    }

    return new Intl.DateTimeFormat(
        "tr-TR",
        {
            day: "2-digit",
            month: "long",
            year: "numeric"
        }
    ).format(date);
}

function getStatusText(status) {
    const statusTexts = {
        analysis: "Analiz",
        in_progress: "Devam Ediyor",
        completed: "Tamamlandı",
        waiting: "Bilgi Bekleniyor"
    };

    return statusTexts[status] || "Devam Ediyor";
}

function getStatusClass(status) {
    const statusClasses = {
        analysis: "analysis",
        in_progress: "in-progress",
        completed: "completed",
        waiting: "waiting"
    };

    return statusClasses[status] ||
        "in-progress";
}

function escapeHtml(value) {
    const element =
        document.createElement("div");

    element.textContent = String(value);

    return element.innerHTML;
}