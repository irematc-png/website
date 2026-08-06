import {
    auth,
    db
} from "./firebase-config.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const accountForm =
    document.getElementById("accountForm");

const userNameElement =
    document.getElementById("userName");

const userEmailElement =
    document.getElementById("userEmail");

const logoutButton =
    document.getElementById("logoutButton");

const resetFormButton =
    document.getElementById("resetFormButton");

const topSaveButton =
    document.getElementById("topSaveButton");

const cancelButton =
    document.getElementById("cancelButton");

const saveDraftButton =
    document.getElementById("saveDraftButton");

const saveAccountButton =
    document.getElementById("saveAccountButton");

const copyBillingToShippingButton =
    document.getElementById(
        "copyBillingToShippingButton"
    );

const descriptionInput =
    document.getElementById("description");

const descriptionCharacterCount =
    document.getElementById(
        "descriptionCharacterCount"
    );

const formMessage =
    document.getElementById("formMessage");

let currentProfile = null;

onAuthStateChanged(
    auth,
    async (user) => {
        if (!user) {
            window.location.replace(
                "/portal/index.html"
            );

            return;
        }

        try {
            await initializeAccountPage(
                user
            );
        } catch (error) {
            console.error(
                "Account ekranı yüklenemedi:",
                error
            );

            await signOut(auth);

            window.location.replace(
                "/portal/index.html"
            );
        }
    }
);

logoutButton.addEventListener(
    "click",
    async () => {
        await signOut(auth);

        window.location.replace(
            "/portal/index.html"
        );
    }
);

accountForm.addEventListener(
    "submit",
    (event) => {
        event.preventDefault();

        submitAccountForm();
    }
);

topSaveButton.addEventListener(
    "click",
    () => {
        accountForm.requestSubmit();
    }
);

saveDraftButton.addEventListener(
    "click",
    () => {
        const accountData =
            collectAccountData();

        console.log(
            "Account taslağı:",
            accountData
        );

        showFormMessage(
            "Account bilgileri taslak olarak hazırlandı. Henüz Salesforce’a gönderilmedi.",
            "success"
        );
    }
);

resetFormButton.addEventListener(
    "click",
    resetAccountForm
);

cancelButton.addEventListener(
    "click",
    () => {
        window.location.href =
            "/portal/dashboard.html";
    }
);

copyBillingToShippingButton.addEventListener(
    "click",
    copyBillingAddressToShipping
);

descriptionInput.addEventListener(
    "input",
    updateDescriptionCharacterCount
);

async function initializeAccountPage(
    user
) {
    const profileReference = doc(
        db,
        "users",
        user.uid
    );

    const profileSnapshot =
        await getDoc(
            profileReference
        );

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
        currentProfile.active !== true
    ) {
        throw new Error(
            "Kullanıcı hesabı aktif değil."
        );
    }

    userNameElement.textContent =
        currentProfile.displayName ||
        "Kullanıcı";

    userEmailElement.textContent =
        currentProfile.email ||
        user.email ||
        "";

    document.body.classList.remove(
        "auth-loading"
    );
}

function submitAccountForm() {
    clearFormMessage();

    if (!accountForm.checkValidity()) {
        accountForm.reportValidity();

        showFormMessage(
            "Lütfen zorunlu alanları kontrol edin.",
            "error"
        );

        return;
    }

    const accountData =
        collectAccountData();

    console.log(
        "Salesforce Account payload ön izlemesi:",
        accountData
    );

    setSaveLoading(true);

    window.setTimeout(
        () => {
            setSaveLoading(false);

            showFormMessage(
                "Account bilgileri başarıyla hazırlandı. Salesforce bağlantısı kurulduğunda kayıt gönderilebilecek.",
                "success"
            );

            formMessage.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        },
        500
    );
}

function collectAccountData() {
    return {
        Name:
            getInputValue(
                "accountName"
            ),

        Type:
            getInputValue(
                "accountType"
            ),

        Industry:
            getInputValue(
                "industry"
            ),

        TaxNumber:
            getInputValue(
                "taxNumber"
            ),

        TaxOffice:
            getInputValue(
                "taxOffice"
            ),

        NumberOfEmployees:
            getNumberValue(
                "employeeCount"
            ),

        AnnualRevenue:
            getNumberValue(
                "annualRevenue"
            ),

        CurrencyIsoCode:
            getInputValue(
                "revenueCurrency"
            ),

        Phone:
            getInputValue(
                "phone"
            ),

        Email:
            getInputValue(
                "email"
            ),

        Website:
            normalizeWebsite(
                getInputValue(
                    "website"
                )
            ),

        Fax:
            getInputValue(
                "fax"
            ),

        BillingStreet:
            getInputValue(
                "billingStreet"
            ),

        BillingCountry:
            getInputValue(
                "billingCountry"
            ),

        BillingState:
            getInputValue(
                "billingState"
            ),

        BillingCity:
            getInputValue(
                "billingCity"
            ),

        BillingPostalCode:
            getInputValue(
                "billingPostalCode"
            ),

        ShippingStreet:
            getInputValue(
                "shippingStreet"
            ),

        ShippingCountry:
            getInputValue(
                "shippingCountry"
            ),

        ShippingState:
            getInputValue(
                "shippingState"
            ),

        ShippingCity:
            getInputValue(
                "shippingCity"
            ),

        ShippingPostalCode:
            getInputValue(
                "shippingPostalCode"
            ),

        LeadSource:
            getInputValue(
                "leadSource"
            ),

        Description:
            getInputValue(
                "description"
            )
    };
}

function copyBillingAddressToShipping() {
    const fieldPairs = [
        [
            "billingStreet",
            "shippingStreet"
        ],
        [
            "billingCountry",
            "shippingCountry"
        ],
        [
            "billingState",
            "shippingState"
        ],
        [
            "billingCity",
            "shippingCity"
        ],
        [
            "billingPostalCode",
            "shippingPostalCode"
        ]
    ];

    fieldPairs.forEach(
        ([sourceId, targetId]) => {
            const source =
                document.getElementById(
                    sourceId
                );

            const target =
                document.getElementById(
                    targetId
                );

            target.value =
                source.value;
        }
    );

    showFormMessage(
        "Fatura adresi sevk adresine kopyalandı.",
        "success"
    );
}

function resetAccountForm() {
    const confirmation =
        window.confirm(
            "Formdaki bütün bilgileri temizlemek istediğinize emin misiniz?"
        );

    if (!confirmation) {
        return;
    }

    accountForm.reset();

    document.getElementById(
        "billingCountry"
    ).value = "Türkiye";

    document.getElementById(
        "shippingCountry"
    ).value = "Türkiye";

    updateDescriptionCharacterCount();
    clearFormMessage();

    document.getElementById(
        "accountName"
    ).focus();
}

function updateDescriptionCharacterCount() {
    descriptionCharacterCount.textContent =
        String(
            descriptionInput.value.length
        );
}

function getInputValue(
    elementId
) {
    const element =
        document.getElementById(
            elementId
        );

    return (
        element?.value?.trim() ||
        ""
    );
}

function getNumberValue(
    elementId
) {
    const value =
        getInputValue(
            elementId
        );

    if (!value) {
        return null;
    }

    const numberValue =
        Number(value);

    return Number.isFinite(
        numberValue
    )
        ? numberValue
        : null;
}

function normalizeWebsite(
    value
) {
    if (!value) {
        return "";
    }

    if (
        value.startsWith(
            "http://"
        ) ||
        value.startsWith(
            "https://"
        )
    ) {
        return value;
    }

    return `https://${value}`;
}

function setSaveLoading(
    isLoading
) {
    saveAccountButton.disabled =
        isLoading;

    topSaveButton.disabled =
        isLoading;

    saveAccountButton.textContent =
        isLoading
            ? "Hazırlanıyor..."
            : "Hesabı Kaydet";

    topSaveButton.textContent =
        isLoading
            ? "Hazırlanıyor..."
            : "Hesabı Kaydet";
}

function showFormMessage(
    message,
    type
) {
    formMessage.textContent =
        message;

    formMessage.className =
        `crm-form-message ${type}`;
}

function clearFormMessage() {
    formMessage.textContent = "";

    formMessage.className =
        "crm-form-message hidden";
}