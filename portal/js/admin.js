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

const durationMinutesInput =
    document.getElementById("durationMinutes");

const durationPreview =
    document.getElementById("durationPreview");

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
let unsubscribeRecentLogs = null;

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

logoutButton.addEventListener(
    "click",
    async () => {
        try {
            if (unsubscribeRecentLogs) {
                unsubscribeRecentLogs();
            }

            await signOut(auth);
            window.location.replace("./index.html");
        } catch (error) {
            console.error(
                "Çıkış işlemi gerçekleştirilemedi:",
                error
            );
        }
    }
);

durationMinutesInput.addEventListener(
    "input",
    updateDurationPreview
);

logForm.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        clearMessage();

        const selectedProject =
            projects.find(
                (project) =>
                    project.id ===
                    projectSelect.value
            );

        if (!selectedProject) {
            showMessage(
                "Lütfen bir proje seçin.",
                "error"
            );

            return;
        }

        const durationMinutes =
            Number(durationMinutesInput.value);

        if (
            !Number.isInteger(durationMinutes) ||
            durationMinutes < 1 ||
            durationMinutes > 1440
        ) {
            showMessage(
                "Harcanan süre 1 ile 1440 dakika arasında olmalıdır.",
                "error"
            );

            durationMinutesInput.focus();
            return;
        }

        const itemNumber =
            itemNumberInput.value.trim()
                ? Number(itemNumberInput.value)
                : null;

        if (
            itemNumber !== null &&
            (
                !Number.isInteger(itemNumber) ||
                itemNumber < 1
            )
        ) {
            showMessage(
                "Madde numarası pozitif bir tam sayı olmalıdır.",
                "error"
            );

            itemNumberInput.focus();
            return;
        }

        const title =
            titleInput.value.trim();

        const description =
            descriptionInput.value.trim();

        const nextStep =
            nextStepInput.value.trim();

        if (!title || !description) {
            showMessage(
                "Çalışma başlığı ve yapılan çalışma alanları zorunludur.",
                "error"
            );

            return;
        }

        setLoading(true);

        try {
            await addDoc(
                collection(db, "workLogs"),
                {
                    projectId:
                        selectedProject.id,

                    clientId:
                        selectedProject.clientId,

                    workDate:
                        workDateInput.value,

                    durationMinutes,

                    itemNumber,

                    status:
                        statusInput.value,

                    title,

                    description,

                    nextStep,

                    createdBy:
                        auth.currentUser.uid,

                    createdByName:
                        currentAdminProfile
                            .displayName ||
                        auth.currentUser.email,

                    createdAt:
                        serverTimestamp(),

                    updatedAt:
                        serverTimestamp()
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
                "Çalışma kaydı oluşturulamadı. Yetkilerinizi ve internet bağlantınızı kontrol edin.",
                "error"
            );
        } finally {
            setLoading(false);
        }
    }
);

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
    updateDurationPreview();

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

    projects.sort(
        (firstProject, secondProject) =>
            String(firstProject.name || "")
                .localeCompare(
                    String(
                        secondProject.name || ""
                    ),
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
            `${project.clientName || "Müşteri"} — ` +
            `${project.name || "Proje"}`;

        projectSelect.appendChild(option);
    });
}

function listenToRecentLogs() {
    const recentLogsQuery = query(
        collection(db, "workLogs"),
        orderBy("createdAt", "desc"),
        limit(10)
    );

    unsubscribeRecentLogs = onSnapshot(
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
                ${formatDuration(
                    getLogDurationMinutes(log)
                )}
            </span>
        `;

        adminLogsContainer.appendChild(element);
    });
}

function getLogDurationMinutes(log) {
    /*
     * Yeni kayıtlar durationMinutes kullanır.
     * Eski test kayıtlarında hours varsa
     * onları da geçici olarak destekler.
     */
    if (
        Number.isFinite(
            Number(log.durationMinutes)
        )
    ) {
        return Number(log.durationMinutes);
    }

    if (
        Number.isFinite(
            Number(log.hours)
        )
    ) {
        return Math.round(
            Number(log.hours) * 60
        );
    }

    return 0;
}

function updateDurationPreview() {
    const minutes =
        Number(durationMinutesInput.value);

    if (
        !Number.isInteger(minutes) ||
        minutes < 1
    ) {
        durationPreview.textContent =
            "Süreyi dakika olarak girin.";

        return;
    }

    durationPreview.textContent =
        `Müşteriye ${formatDuration(minutes)} olarak gösterilecek.`;
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
    updateDurationPreview();

    titleInput.focus();
}

function setDefaultDate() {
    const now = new Date();

    const year =
        now.getFullYear();

    const month =
        String(
            now.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            now.getDate()
        ).padStart(2, "0");

    workDateInput.value =
        `${year}-${month}-${day}`;
}

function formatDuration(totalMinutes) {
    const safeMinutes =
        Math.max(
            0,
            Math.round(
                Number(totalMinutes) || 0
            )
        );

    const hours =
        Math.floor(safeMinutes / 60);

    const minutes =
        safeMinutes % 60;

    if (hours === 0) {
        return `${minutes} dakika`;
    }

    if (minutes === 0) {
        return `${hours} saat`;
    }

    return `${hours} saat ${minutes} dakika`;
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

    if (Number.isNaN(date.getTime())) {
        return escapeHtml(dateValue);
    }

    return new Intl.DateTimeFormat(
        "tr-TR",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    ).format(date);
}

function escapeHtml(value) {
    const element =
        document.createElement("div");

    element.textContent =
        String(value ?? "");

    return element.innerHTML;
}