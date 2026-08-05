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
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp
} from
    "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const adminName =
    document.getElementById("adminName");

const logoutButton =
    document.getElementById("logoutButton");

const logForm =
    document.getElementById("logForm");

const projectSelect =
    document.getElementById("projectSelect");

const workDateInput =
    document.getElementById("workDate");

const hoursInput =
    document.getElementById("hours");

const itemNumberInput =
    document.getElementById("itemNumber");

const statusInput =
    document.getElementById("status");

const titleInput =
    document.getElementById("title");

const descriptionInput =
    document.getElementById("description");

const nextStepInput =
    document.getElementById("nextStep");

const saveButton =
    document.getElementById("saveButton");

const formMessage =
    document.getElementById("formMessage");

const adminLogsContainer =
    document.getElementById("adminLogsContainer");

let currentAdminProfile = null;
let projects = [];

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace("./index.html");
        return;
    }

    try {
        await initializeAdmin(user);
    } catch (error) {
        console.error(
            "Admin ekranı yüklenemedi:",
            error
        );

        await signOut(auth);

        window.location.replace("./index.html");
    }
});

logoutButton.addEventListener("click", async () => {
    await signOut(auth);
    window.location.replace("./index.html");
});

logForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    clearMessage();

    const selectedProject =
        projects.find(
            (project) =>
                project.id === projectSelect.value
        );

    if (!selectedProject) {
        showMessage(
            "Lütfen bir proje seçin.",
            "error"
        );

        return;
    }

    const hours = Number(hoursInput.value);

    if (
        !Number.isFinite(hours) ||
        hours <= 0 ||
        hours > 24
    ) {
        showMessage(
            "Harcanan süre 0 ile 24 saat arasında olmalıdır.",
            "error"
        );

        return;
    }

    const itemNumber =
        itemNumberInput.value
            ? Number(itemNumberInput.value)
            : null;

    setLoading(true);

    try {
        await addDoc(
            collection(db, "workLogs"),
            {
                projectId: selectedProject.id,
                clientId: selectedProject.clientId,

                workDate: workDateInput.value,
                hours,
                itemNumber,

                status: statusInput.value,

                title: titleInput.value.trim(),

                description:
                    descriptionInput.value.trim(),

                nextStep:
                    nextStepInput.value.trim(),

                createdBy: auth.currentUser.uid,

                createdByName:
                    currentAdminProfile.displayName ||
                    auth.currentUser.email,

                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            }
        );

        showMessage(
            "Çalışma kaydı başarıyla oluşturuldu.",
            "success"
        );

        resetForm();
    } catch (error) {
        console.error(
            "Çalışma kaydı oluşturulamadı:",
            error
        );

        showMessage(
            "Çalışma kaydı oluşturulamadı.",
            "error"
        );
    } finally {
        setLoading(false);
    }
});

async function initializeAdmin(user) {
    const profileReference = doc(
        db,
        "users",
        user.uid
    );

    const profileSnapshot =
        await getDoc(profileReference);

    if (!profileSnapshot.exists()) {
        throw new Error(
            "Admin profili bulunamadı."
        );
    }

    currentAdminProfile = {
        id: profileSnapshot.id,
        ...profileSnapshot.data()
    };

    if (
        currentAdminProfile.active !== true ||
        currentAdminProfile.role !== "admin"
    ) {
        throw new Error(
            "Admin yetkisi bulunamadı."
        );
    }

    adminName.textContent =
        currentAdminProfile.displayName ||
        user.email ||
        "Yönetici";

    await loadProjects();
    listenToRecentLogs();

    setDefaultDate();

    document.body.classList.remove(
        "auth-loading"
    );
}

async function loadProjects() {
    const projectsSnapshot =
        await getDocs(
            collection(db, "projects")
        );

    projects = projectsSnapshot.docs.map(
        (projectDocument) => ({
            id: projectDocument.id,
            ...projectDocument.data()
        })
    );

    projects.sort((a, b) =>
        String(a.name).localeCompare(
            String(b.name),
            "tr"
        )
    );

    projectSelect.innerHTML = `
        <option value="">
            Proje seçin
        </option>
    `;

    projects.forEach((project) => {
        const option =
            document.createElement("option");

        option.value = project.id;

        option.textContent =
            `${project.clientName} — ${project.name}`;

        projectSelect.appendChild(option);
    });
}

function listenToRecentLogs() {
    const recentLogsQuery = query(
        collection(db, "workLogs"),
        orderBy("createdAt", "desc"),
        limit(10)
    );

    onSnapshot(
        recentLogsQuery,
        (snapshot) => {
            const logs = snapshot.docs.map(
                (documentSnapshot) => ({
                    id: documentSnapshot.id,
                    ...documentSnapshot.data()
                })
            );

            renderRecentLogs(logs);
        },
        (error) => {
            console.error(
                "Admin log listesi yüklenemedi:",
                error
            );

            adminLogsContainer.textContent =
                "Kayıtlar yüklenemedi.";
        }
    );
}

function renderRecentLogs(logs) {
    adminLogsContainer.innerHTML = "";

    if (logs.length === 0) {
        adminLogsContainer.innerHTML = `
            <div class="empty-state">
                Henüz çalışma kaydı bulunmuyor.
            </div>
        `;

        return;
    }

    logs.forEach((log) => {
        const project =
            projects.find(
                (item) =>
                    item.id === log.projectId
            );

        const element =
            document.createElement("div");

        element.className =
            "admin-log-item";

        element.innerHTML = `
            <div>
                <strong>
                    ${escapeHtml(log.title || "")}
                </strong>

                <span>
                    ${escapeHtml(
                        project?.clientName ||
                        "Müşteri"
                    )}
                    ·
                    ${formatDate(log.workDate)}
                </span>
            </div>

            <span class="hours-badge">
                ${formatNumber(log.hours)} saat
            </span>
        `;

        adminLogsContainer.appendChild(element);
    });
}

function resetForm() {
    const selectedProjectId =
        projectSelect.value;

    logForm.reset();

    projectSelect.value =
        selectedProjectId;

    statusInput.value =
        "in_progress";

    setDefaultDate();
}

function setDefaultDate() {
    const now = new Date();

    const year = now.getFullYear();

    const month = String(
        now.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        now.getDate()
    ).padStart(2, "0");

    workDateInput.value =
        `${year}-${month}-${day}`;
}

function setLoading(isLoading) {
    saveButton.disabled = isLoading;

    saveButton.textContent =
        isLoading
            ? "Kaydediliyor..."
            : "Çalışma Kaydını Oluştur";
}

function showMessage(message, type) {
    formMessage.textContent = message;

    formMessage.className =
        `form-message ${type}`;
}

function clearMessage() {
    formMessage.textContent = "";
    formMessage.className =
        "form-message";
}

function formatDate(dateValue) {
    if (!dateValue) {
        return "—";
    }

    const date = new Date(
        `${dateValue}T12:00:00`
    );

    return new Intl.DateTimeFormat(
        "tr-TR",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    ).format(date);
}

function formatNumber(value) {
    return new Intl.NumberFormat(
        "tr-TR",
        {
            maximumFractionDigits: 2
        }
    ).format(Number(value || 0));
}

function escapeHtml(value) {
    const element =
        document.createElement("div");

    element.textContent = String(value);

    return element.innerHTML;
}