import {
    auth,
    db
} from "./firebase-config.js";

import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from
    "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";

import {
    doc,
    getDoc
} from
    "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");

let loginSubmitted = false;

onAuthStateChanged(auth, async (user) => {
    if (!user || loginSubmitted) {
        return;
    }

    await redirectUserByRole(user.uid);
});

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    clearMessage();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showMessage(
            "E-posta adresinizi ve şifrenizi girin.",
            "error"
        );

        return;
    }

    loginSubmitted = true;
    setLoading(true);

    try {
        const userCredential =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

        await redirectUserByRole(
            userCredential.user.uid
        );
    } catch (error) {
        console.error("Giriş hatası:", error);

        loginSubmitted = false;

        showMessage(
            getLoginErrorMessage(error.code),
            "error"
        );

        setLoading(false);
    }
});

async function redirectUserByRole(userId) {
    try {
        const userReference = doc(
            db,
            "users",
            userId
        );

        const userSnapshot = await getDoc(userReference);

        if (!userSnapshot.exists()) {
            await signOut(auth);

            showMessage(
                "Kullanıcı profiliniz bulunamadı. Lütfen Drealima ile iletişime geçin.",
                "error"
            );

            setLoading(false);
            return;
        }

        const profile = userSnapshot.data();

        if (profile.active !== true) {
            await signOut(auth);

            showMessage(
                "Kullanıcı hesabınız aktif değil.",
                "error"
            );

            setLoading(false);
            return;
        }

        showMessage(
            "Giriş başarılı. Yönlendiriliyorsunuz...",
            "success"
        );

        if (profile.role === "admin") {
            window.location.replace("./admin.html");
            return;
        }

        if (profile.role === "customer") {
            window.location.replace("./dashboard.html");
            return;
        }

        await signOut(auth);

        showMessage(
            "Kullanıcı rolünüz tanımlanmamış.",
            "error"
        );

        setLoading(false);
    } catch (error) {
        console.error("Profil kontrol hatası:", error);

        await signOut(auth);

        showMessage(
            "Kullanıcı bilgileri kontrol edilemedi.",
            "error"
        );

        setLoading(false);
    }
}

function setLoading(isLoading) {
    loginButton.disabled = isLoading;

    loginButton.textContent = isLoading
        ? "Giriş Yapılıyor..."
        : "Giriş Yap";
}

function showMessage(message, type) {
    loginMessage.textContent = message;
    loginMessage.className = `form-message ${type}`;
}

function clearMessage() {
    loginMessage.textContent = "";
    loginMessage.className = "form-message";
}

function getLoginErrorMessage(errorCode) {
    const messages = {
        "auth/invalid-email":
            "Geçerli bir e-posta adresi girin.",

        "auth/invalid-credential":
            "E-posta adresi veya şifre hatalı.",

        "auth/user-disabled":
            "Bu kullanıcı hesabı devre dışı bırakılmış.",

        "auth/too-many-requests":
            "Çok fazla başarısız giriş yapıldı. Daha sonra tekrar deneyin.",

        "auth/network-request-failed":
            "İnternet bağlantısı kurulamadı."
    };

    return messages[errorCode] ??
        "Giriş sırasında beklenmeyen bir hata oluştu.";
}
const togglePasswordButton =
    document.getElementById("togglePasswordButton");

if (togglePasswordButton) {
    togglePasswordButton.addEventListener(
        "click",
        () => {
            const isPasswordVisible =
                passwordInput.type === "text";

            passwordInput.type =
                isPasswordVisible
                    ? "password"
                    : "text";

            togglePasswordButton.textContent =
                isPasswordVisible
                    ? "Göster"
                    : "Gizle";

            togglePasswordButton.setAttribute(
                "aria-label",
                isPasswordVisible
                    ? "Şifreyi göster"
                    : "Şifreyi gizle"
            );
        }
    );
}
const forgotPasswordButton =
    document.getElementById("forgotPasswordButton");

if (forgotPasswordButton) {
    forgotPasswordButton.addEventListener(
        "click",
        () => {
            showMessage(
                "Şifre sıfırlama özelliği kısa süre içinde aktif olacaktır.",
                "error"
            );
        }
    );
}