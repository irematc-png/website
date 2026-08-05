import {
    auth,
    db
} from "./firebase-config.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";

import {
    collection,
    doc,
    getDoc,
    onSnapshot,
    orderBy,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

/* =====================================================
   DOM
===================================================== */

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

const tableWrapper =
    document.getElementById("tableWrapper");

const logsTableBody =
    document.getElementById("logsTableBody");

const startDateFilter =
    document.getElementById("startDateFilter");

const endDateFilter =
    document.getElementById("endDateFilter");

const pageSizeSelect =
    document.getElementById("pageSizeSelect");

const applyFilterButton =
    document.getElementById("applyFilterButton");

const clearFilterButton =
    document.getElementById("clearFilterButton");

const filterSummary =
    document.getElementById("filterSummary");

const paginationContainer =
    document.getElementById("paginationContainer");

const paginationSummary =
    document.getElementById("paginationSummary");

const firstPageButton =
    document.getElementById("firstPageButton");

const previousPageButton =
    document.getElementById("previousPageButton");

const nextPageButton =
    document.getElementById("nextPageButton");

const lastPageButton =
    document.getElementById("lastPageButton");

const pageNumbers =
    document.getElementById("pageNumbers");

/* =====================================================
   STATE
===================================================== */

let currentProfile = null;
let currentProject = null;
let unsubscribeLogs = null;

let allLogs = [];
let filteredLogs = [];

let currentPage = 1;
let pageSize = 10;

/* =====================================================
   AUTH
===================================================== */

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

        loadingState.classList.remove("hidden");
        loadingState.textContent =
            "Proje bilgileri yüklenemedi.";
    }
});

logoutButton.addEventListener(
    "click",
    async () => {
        try {
            if (unsubscribeLogs) {
                unsubscribeLogs();
            }

            await signOut(auth);
            window.location.replace("./index.html");
        } catch (error) {
            console.error(
                "Çıkış işlemi başarısız:",
                error
            );
        }
    }
);

/* =====================================================
   FILTER EVENTS
===================================================== */

applyFilterButton.addEventListener(
    "click",
    () => {
        currentPage = 1;
        applyFilters();
    }
);

clearFilterButton.addEventListener(
    "click",
    () => {
        startDateFilter.value = "";
        endDateFilter.value = "";

        currentPage = 1;
        applyFilters();
    }
);

pageSizeSelect.addEventListener(
    "change",
    () => {
        pageSize =
            Number(pageSizeSelect.value) || 10;

        currentPage = 1;
        renderTable();
    }
);

startDateFilter.addEventListener(
    "keydown",
    (event) => {
        if (event.key === "Enter") {
            currentPage = 1;
            applyFilters();
        }
    }
);

endDateFilter.addEventListener(
    "keydown",
    (event) => {
        if (event.key === "Enter") {
            currentPage = 1;
            applyFilters();
        }
    }
);

/* =====================================================
   PAGINATION EVENTS
===================================================== */

firstPageButton.addEventListener(
    "click",
    () => {
        if (currentPage === 1) {
            return;
        }

        currentPage = 1;
        renderTable();
    }
);

previousPageButton.addEventListener(
    "click",
    () => {
        if (currentPage <= 1) {
            return;
        }

        currentPage -= 1;
        renderTable();
    }
);

nextPageButton.addEventListener(
    "click",
    () => {
        const totalPages =
            getTotalPages();

        if (currentPage >= totalPages) {
            return;
        }

        currentPage += 1;
        renderTable();
    }
);

lastPageButton.addEventListener(
    "click",
    () => {
        const totalPages =
            getTotalPages();

        if (currentPage === totalPages) {
            return;
        }

        currentPage = totalPages;
        renderTable();
    }
);

/* =====================================================
   INITIALIZE
===================================================== */

async function initializeCustomerDashboard(
    user
) {
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

initializeCurrentMonthFilter();

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
            isActive
                ? "active"
                : "passive"
        }`;

    totalHoursElement.textContent =
        formatDuration(
            getProjectTotalMinutes()
        );
}

/* =====================================================
   FIRESTORE
===================================================== */

function listenToWorkLogs() {
    const workLogsQuery = query(
        collection(db, "workLogs"),

        where(
            "projectId",
            "==",
            currentProfile.projectId
        ),

        orderBy(
            "workDate",
            "desc"
        )
    );

    unsubscribeLogs = onSnapshot(
        workLogsQuery,

        (snapshot) => {
            allLogs = snapshot.docs.map(
                (documentSnapshot) => ({
                    id: documentSnapshot.id,
                    ...documentSnapshot.data()
                })
            );

            loadingState.classList.add(
                "hidden"
            );

            renderSummary(allLogs);

            currentPage = 1;
            applyFilters();
        },

        (error) => {
            console.error(
                "Log sorgulama hatası:",
                error
            );

            loadingState.classList.remove(
                "hidden"
            );

            loadingState.textContent =
                "Çalışma kayıtları yüklenemedi.";
        }
    );
}

/* =====================================================
   SUMMARY
===================================================== */

function renderSummary(logs) {
    const totalMinutes =
        getProjectTotalMinutes();

    const usedMinutes =
        logs.reduce(
            (total, log) =>
                total +
                getLogDurationMinutes(log),
            0
        );

    const remainingMinutes =
        Math.max(
            totalMinutes - usedMinutes,
            0
        );

    const percentage =
        totalMinutes > 0
            ? Math.min(
                (
                    usedMinutes /
                    totalMinutes
                ) * 100,
                100
            )
            : 0;

    totalHoursElement.textContent =
        formatDuration(totalMinutes);

    usedHoursElement.textContent =
        formatDuration(usedMinutes);

    remainingHoursElement.textContent =
        formatDuration(remainingMinutes);

    logCountElement.textContent =
        String(logs.length);

    progressPercentageElement.textContent =
        `%${percentage.toFixed(0)}`;

    progressBarElement.style.width =
        `${percentage}%`;
}

/* =====================================================
   FILTER
===================================================== */

function applyFilters() {
    const startDate =
        startDateFilter.value;

    const endDate =
        endDateFilter.value;

    if (
        startDate &&
        endDate &&
        startDate > endDate
    ) {
        alert(
            "Başlangıç tarihi bitiş tarihinden büyük olamaz."
        );

        return;
    }

    filteredLogs = allLogs.filter(
        (log) => {
            const workDate =
                String(log.workDate || "");

            if (
                startDate &&
                workDate < startDate
            ) {
                return false;
            }

            if (
                endDate &&
                workDate > endDate
            ) {
                return false;
            }

            return true;
        }
    );

    renderFilterSummary(
        startDate,
        endDate
    );

    renderTable();
}

function renderFilterSummary(
    startDate,
    endDate
) {
    if (!startDate && !endDate) {
        filterSummary.classList.add(
            "hidden"
        );

        filterSummary.textContent = "";
        return;
    }

    const startText =
        startDate
            ? formatDate(startDate)
            : "İlk kayıt";

    const endText =
        endDate
            ? formatDate(endDate)
            : "Bugün";

    const totalMinutes =
        filteredLogs.reduce(
            (total, log) =>
                total +
                getLogDurationMinutes(log),
            0
        );

    filterSummary.textContent =
        `${startText} – ${endText} tarihleri arasında ` +
        `${filteredLogs.length} kayıt, toplam ` +
        `${formatDuration(totalMinutes)} çalışma bulunmaktadır.`;

    filterSummary.classList.remove(
        "hidden"
    );
}

/* =====================================================
   TABLE
===================================================== */

function renderTable() {
    logsTableBody.innerHTML = "";

    if (filteredLogs.length === 0) {
        emptyState.classList.remove(
            "hidden"
        );

        tableWrapper.classList.add(
            "hidden"
        );

        paginationContainer.classList.add(
            "hidden"
        );

        return;
    }

    emptyState.classList.add("hidden");
    tableWrapper.classList.remove("hidden");

    const totalPages =
        getTotalPages();

    if (currentPage > totalPages) {
        currentPage = totalPages;
    }

    const startIndex =
        (currentPage - 1) * pageSize;

    const endIndex =
        startIndex + pageSize;

    const pageLogs =
        filteredLogs.slice(
            startIndex,
            endIndex
        );

    pageLogs.forEach((log) => {
        const row =
            document.createElement("tr");

        const itemText =
            log.itemNumber
                ? `Madde ${escapeHtml(
                    String(log.itemNumber)
                )}`
                : "Genel";

        const description =
            escapeHtml(
                log.description || ""
            );

        const nextStep =
            escapeHtml(
                log.nextStep || ""
            );

        row.innerHTML = `
            <td data-label="Tarih">
                <strong class="table-date">
                    ${formatDate(log.workDate)}
                </strong>
            </td>

            <td data-label="Madde">
                <span class="table-item-badge">
                    ${itemText}
                </span>
            </td>

            <td data-label="Konu">
                <strong class="table-title">
                    ${escapeHtml(log.title || "")}
                </strong>
            </td>

            <td data-label="Yapılan Çalışma">
                <div class="table-description">
                    <span>${description}</span>

                    ${
                        nextStep
                            ? `
                                <small>
                                    <strong>Sonraki adım:</strong>
                                    ${nextStep}
                                </small>
                            `
                            : ""
                    }
                </div>
            </td>

            <td data-label="Süre">
                <span class="hours-badge">
                    ${formatDuration(
                        getLogDurationMinutes(log)
                    )}
                </span>
            </td>

            <td data-label="Durum">
                <span class="
                    status-badge
                    ${getStatusClass(log.status)}
                ">
                    ${getStatusText(log.status)}
                </span>
            </td>
        `;

        logsTableBody.appendChild(row);
    });

    renderPagination();
}

/* =====================================================
   PAGINATION
===================================================== */

function renderPagination() {
    const totalPages =
        getTotalPages();

    if (totalPages <= 1) {
        paginationContainer.classList.add(
            "hidden"
        );

        return;
    }

    paginationContainer.classList.remove(
        "hidden"
    );

    const startRecord =
        (currentPage - 1) * pageSize + 1;

    const endRecord =
        Math.min(
            currentPage * pageSize,
            filteredLogs.length
        );

    paginationSummary.textContent =
        `${filteredLogs.length} kayıttan ` +
        `${startRecord}-${endRecord} arası gösteriliyor.`;

    firstPageButton.disabled =
        currentPage === 1;

    previousPageButton.disabled =
        currentPage === 1;

    nextPageButton.disabled =
        currentPage === totalPages;

    lastPageButton.disabled =
        currentPage === totalPages;

    renderPageNumbers(totalPages);
}

function renderPageNumbers(totalPages) {
    pageNumbers.innerHTML = "";

    const visiblePages =
        getVisiblePageNumbers(totalPages);

    visiblePages.forEach((page) => {
        if (page === "...") {
            const dots =
                document.createElement("span");

            dots.className =
                "pagination-dots";

            dots.textContent = "...";

            pageNumbers.appendChild(dots);
            return;
        }

        const button =
            document.createElement("button");

        button.type = "button";

        button.className =
            `pagination-button ${
                page === currentPage
                    ? "active"
                    : ""
            }`;

        button.textContent =
            String(page);

        button.addEventListener(
            "click",
            () => {
                currentPage = page;
                renderTable();
            }
        );

        pageNumbers.appendChild(button);
    });
}

function getVisiblePageNumbers(
    totalPages
) {
    if (totalPages <= 7) {
        return Array.from(
            { length: totalPages },
            (_, index) => index + 1
        );
    }

    if (currentPage <= 4) {
        return [
            1,
            2,
            3,
            4,
            5,
            "...",
            totalPages
        ];
    }

    if (
        currentPage >=
        totalPages - 3
    ) {
        return [
            1,
            "...",
            totalPages - 4,
            totalPages - 3,
            totalPages - 2,
            totalPages - 1,
            totalPages
        ];
    }

    return [
        1,
        "...",
        currentPage - 1,
        currentPage,
        currentPage + 1,
        "...",
        totalPages
    ];
}

function getTotalPages() {
    return Math.max(
        1,
        Math.ceil(
            filteredLogs.length /
            pageSize
        )
    );
}

/* =====================================================
   HELPERS
===================================================== */

function getProjectTotalMinutes() {
    const totalHours =
        Number(
            currentProject?.totalHours || 0
        );

    return Math.round(
        totalHours * 60
    );
}

function getLogDurationMinutes(log) {
    if (
        Number.isFinite(
            Number(log.durationMinutes)
        )
    ) {
        return Math.max(
            0,
            Math.round(
                Number(log.durationMinutes)
            )
        );
    }

    if (
        Number.isFinite(
            Number(log.hours)
        )
    ) {
        return Math.max(
            0,
            Math.round(
                Number(log.hours) * 60
            )
        );
    }

    return 0;
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
            month: "short",
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

    return statusTexts[status] ||
        "Devam Ediyor";
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

    element.textContent =
        String(value ?? "");

    return element.innerHTML;
}
function initializeCurrentMonthFilter() {

    const today = new Date();

    const year = today.getFullYear();
    const month = today.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    startDateFilter.value = firstDay
        .toISOString()
        .split("T")[0];

    endDateFilter.value = lastDay
        .toISOString()
        .split("T")[0];
}